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
import {
	BroadcasterInvalidStateError,
	BroadcasterNotImplementedError,
	BroadcasterSpawnError,
} from '../errors';
import * as utils from '../utils';

const logger = new Logger('GStreamer');
const spawnLogger = new Logger('GStreamer:spawn');

export type GStreamerCreateOptions = {
	routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
};

type GStreamerConstructorOptions = {
	routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
	rtpCapabilities: mediasoupTypes.RtpCapabilities;
	extendedRtpCapabilities: mediasoupTypes.ExtendedRtpCapabilities;
};

export class GStreamer
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
	}: GStreamerCreateOptions): Promise<GStreamer> {
		logger.debug('create()');

		// TODO: This must be properly created based on real RTP capabilities of the
		// GStreamer in the system. Wow...
		const rtpCapabilities: mediasoupTypes.RtpCapabilities = {
			codecs: [],
			headerExtensions: [],
		};

		logger.debug(
			'create() | local RtpCapabilities generated:',
			util.inspect(rtpCapabilities, {
				depth: null,
				colors: true,
				compact: false,
			})
		);

		const extendedRtpCapabilities: mediasoupTypes.ExtendedRtpCapabilities =
			ortc.getExtendedRtpCapabilities(
				rtpCapabilities,
				routerRtpCapabilities,
				/*preferLocalCodecsOrder*/ true
			);

		logger.debug(
			'create() | local ExtendedRtpCapabilities generated:',
			util.inspect(extendedRtpCapabilities, {
				depth: null,
				colors: true,
				compact: false,
			})
		);

		const gstreamer = new GStreamer({
			routerRtpCapabilities,
			rtpCapabilities,
			extendedRtpCapabilities,
		});

		return gstreamer;
	}

	private constructor({
		routerRtpCapabilities,
		rtpCapabilities,
		extendedRtpCapabilities,
	}: GStreamerConstructorOptions) {
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

	getRtpCapabilities(): mediasoupTypes.RtpCapabilities {
		throw new BroadcasterNotImplementedError(
			`getRtpCapabilities() not implemented in ${this.constructor.name}`
		);
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

		const cmd = 'gst-launch-1.0';
		const args = utils.splitAndFlattenArgs([
			'rtpbin name=rtpbin',
			`filesrc location=${mediaFile}`,
			'! qtdemux name=demux',
			'demux.video_0',
			'! queue',
			'! decodebin',
			'! videoconvert',
			'! vp8enc target-bitrate=1000000 deadline=1 cpu-used=4',
			`! rtpvp8pay pt=${videoPt} ssrc=${videoSsrc} picture-id-mode=2`,
			'! rtpbin.send_rtp_sink_0',
			`rtpbin.send_rtp_src_0 ! udpsink host=${videoPlainTransportRemoteData.ip} port=${videoPlainTransportRemoteData.port}`,
			`rtpbin.send_rtcp_src_0 ! udpsink host=${videoPlainTransportRemoteData.ip} port=${videoPlainTransportRemoteData.rtcpPort ?? ''} sync=false async=false`,
			'demux.audio_0',
			'! queue',
			'! decodebin',
			'! audioresample',
			'! audioconvert',
			'! opusenc',
			`! rtpopuspay pt=${audioPt} ssrc=${audioSsrc}`,
			'! rtpbin.send_rtp_sink_1',
			`rtpbin.send_rtp_src_1 ! udpsink host=${audioPlainTransportRemoteData.ip} port=${audioPlainTransportRemoteData.port}`,
			`rtpbin.send_rtcp_src_1 ! udpsink host=${audioPlainTransportRemoteData.ip} port=${audioPlainTransportRemoteData.rtcpPort ?? ''} sync=false async=false`,
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

		subprocess.stderr.on('data', (data: string) => {
			if (!data) {
				return;
			}

			spawnLogger.warn(utils.trimFinalNewline(data));
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

		throw new BroadcasterNotImplementedError(
			`consume() not implemented in ${this.constructor.name}`
		);
	}

	private assertNotClosed(): void {
		if (this.#closed) {
			throw new BroadcasterInvalidStateError('GStreamer closed');
		}
	}
}
