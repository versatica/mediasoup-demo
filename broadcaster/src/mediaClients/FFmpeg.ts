import * as util from 'node:util';
import * as childProcess from 'node:child_process';
import * as streamTypes from 'node:stream';
import * as ortc from 'mediasoup-client/ortc';
import type * as mediasoupTypes from 'mediasoup-client/types';

import { Logger } from '../Logger';
import { EnhancedEventEmitter } from '../enhancedEvents';
import {
	MediaClient,
	MediaClientEvents,
	MediaClientProduceMediaFileOptions,
} from '../MediaClient';
import { BroadcasterInvalidStateError, BroadcasterSpawnError } from '../errors';
import * as utils from '../utils';

const logger = new Logger('FFmpeg');
const spawnLogger = new Logger('FFmpeg:spawn');

export type FFmpegCreateOptions = {
	routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
};

type FFmpegConstructorOptions = {
	routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
	rtpCapabilities: mediasoupTypes.RtpCapabilities;
	extendedRtpCapabilities: mediasoupTypes.ExtendedRtpCapabilities;
};

export class FFmpeg
	extends EnhancedEventEmitter<MediaClientEvents>
	implements MediaClient
{
	readonly #routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
	readonly #rtpCapabilities: mediasoupTypes.RtpCapabilities;
	readonly #extendedRtpCapabilities: mediasoupTypes.ExtendedRtpCapabilities;
	readonly #subprocessAbortControllers: Map<
		childProcess.ChildProcessByStdio<
			null,
			streamTypes.Readable,
			streamTypes.Readable
		>,
		AbortController
	> = new Map();
	#closed: boolean = false;

	static async create({
		routerRtpCapabilities,
	}: FFmpegCreateOptions): Promise<FFmpeg> {
		logger.debug('create()');

		// TODO: This must be properly created based on real RTP capabilities of the
		// FFmpeg in the system. Wow...
		const nativeRtpCapabilities: mediasoupTypes.RtpCapabilities = {
			codecs: [
				{
					kind: 'audio',
					mimeType: 'audio/opus',
					preferredPayloadType: 90,
					clockRate: 48000,
					channels: 2,
					rtcpFeedback: [],
				},
				{
					kind: 'video',
					mimeType: 'video/VP8',
					preferredPayloadType: 91,
					clockRate: 90000,
					rtcpFeedback: [
						{ type: 'nack' },
						{ type: 'nack', parameter: 'pli' },
						{ type: 'ccm', parameter: 'fir' },
					],
				},
			],
			headerExtensions: [],
		};

		logger.debug(
			'create() | native RtpCapabilities generated:',
			util.inspect(nativeRtpCapabilities, {
				depth: null,
				colors: true,
				compact: false,
			})
		);

		// This may throw.
		ortc.validateAndNormalizeRtpCapabilities(nativeRtpCapabilities);

		const extendedRtpCapabilities: mediasoupTypes.ExtendedRtpCapabilities =
			ortc.getExtendedRtpCapabilities(
				nativeRtpCapabilities,
				routerRtpCapabilities,
				/* preferLocalCodecsOrder */ false
			);

		logger.debug(
			'create() | ExtendedRtpCapabilities generated:',
			util.inspect(extendedRtpCapabilities, {
				depth: null,
				colors: true,
				compact: false,
			})
		);

		const rtpCapabilities = ortc.getRecvRtpCapabilities(
			extendedRtpCapabilities
		);

		// This may throw.
		ortc.validateAndNormalizeRtpCapabilities(rtpCapabilities);

		logger.debug(
			'create() | RtpCapabilities generated:',
			util.inspect(rtpCapabilities, {
				depth: null,
				colors: true,
				compact: false,
			})
		);

		const ffmpeg = new FFmpeg({
			routerRtpCapabilities,
			rtpCapabilities,
			extendedRtpCapabilities,
		});

		return ffmpeg;
	}

	private constructor({
		routerRtpCapabilities,
		rtpCapabilities,
		extendedRtpCapabilities,
	}: FFmpegConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#routerRtpCapabilities = routerRtpCapabilities;
		this.#rtpCapabilities = rtpCapabilities;
		this.#extendedRtpCapabilities = extendedRtpCapabilities;
	}

	get rtpCapabilities(): mediasoupTypes.RtpCapabilities {
		return this.#rtpCapabilities;
	}

	async close(): Promise<void> {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		const promises: Promise<void>[] = [];

		for (const [subprocess, abortController] of this
			.#subprocessAbortControllers) {
			promises.push(
				new Promise(resolve => {
					subprocess.on('close', resolve);

					abortController.abort();
				})
			);
		}

		await Promise.all(promises);

		this.emit('closed');
	}

	async sendMediaFile({
		mediaFile,
		audioPlainTransportRemoteData,
		videoPlainTransportRemoteData,
		audioSsrc,
		audioPt,
		videoSsrc,
		videoPt,
	}: MediaClientProduceMediaFileOptions): Promise<void> {
		logger.debug('sendMediaFile() [mediaFile:%o]', mediaFile);

		this.assertNotClosed();

		const cmd = 'ffmpeg';
		const args = utils.splitAndFlattenArgs([
			'-re',
			'-v info',
			'-stream_loop -1',
			`-i ${mediaFile}`,
			'-map 0:a:0',
			'-acodec libopus -ab 128k -ac 2 -ar 48000',
			'-map 0:v:0',
			'-pix_fmt yuv420p -c:v libvpx -b:v 1000k -deadline realtime -cpu-used 4',
			'-f tee',
			`"[select=a:f=rtp:ssrc=${audioSsrc}:payload_type=${audioPt}]rtp://${audioPlainTransportRemoteData.ip}:${audioPlainTransportRemoteData.port}?rtcpport=${audioPlainTransportRemoteData.rtcpPort ?? ''}|[select=v:f=rtp:ssrc=${videoSsrc}:payload_type=${videoPt}]rtp://${videoPlainTransportRemoteData.ip}:${videoPlainTransportRemoteData.port}?rtcpport=${videoPlainTransportRemoteData.rtcpPort ?? ''}"`,
		]);

		logger.debug(
			`sendMediaFile() | spawing subprocess: ${cmd} ${args.join(' ')}`
		);

		const abortController = new AbortController();

		const subprocess = childProcess.spawn(cmd, args, {
			stdio: ['ignore', 'overlapped', 'overlapped'],
			signal: abortController.signal,
		});

		this.#subprocessAbortControllers.set(subprocess, abortController);

		subprocess.stdout.setEncoding('utf8');
		subprocess.stderr.setEncoding('utf8');

		subprocess.stdout.on('data', (data: string) => {
			if (!data) {
				return;
			}

			spawnLogger.debug(utils.trimFinalNewline(data));
		});

		// NOTE: ffmpeg sends all its output to stderr so let's not use
		// spawnLogger.error() here.
		subprocess.stderr.on('data', (data: string) => {
			if (!data) {
				return;
			}

			spawnLogger.debug(utils.trimFinalNewline(data));
		});

		try {
			await new Promise<void>((resolve, reject) => {
				subprocess.on('error', error => {
					if (error.name === 'AbortError') {
						resolve();
					} else {
						reject(error);
					}
				});

				subprocess.on('close', (code, signal) => {
					logger.debug(`subprocess closed [code:${code}, signal:${signal}]`);

					this.#subprocessAbortControllers.delete(subprocess);

					if (code === 0) {
						resolve();
					} else {
						reject(
							new Error(`subprocess closed [code:${code}, signal:${signal}]`)
						);
					}
				});
			});
		} catch (error) {
			if (this.#closed) {
				return;
			}

			logger.error('sendMediaFile() | failed:', error);

			throw new BroadcasterSpawnError(String((error as Error).message));
		}
	}

	async consume(): Promise<void> {
		logger.debug('consume()');

		this.assertNotClosed();
	}

	private assertNotClosed(): void {
		if (this.#closed) {
			throw new BroadcasterInvalidStateError('FFmpeg closed');
		}
	}
}
