import * as util from 'node:util';
import type * as mediasoupTypes from 'mediasoup-client/types';

import { Logger } from './Logger';
import { ApiClient } from './ApiClient';
import { MediaClient } from './MediaClient';
import { FFmpeg } from './mediaClients/FFmpeg';
import { GStreamer } from './mediaClients/GStreamer';
import { BroadcasterInvalidStateError } from './errors';
import * as utils from './utils';
import type { RoomId, PeerId, PeerDevice, MediaClientType } from './types';

const logger = new Logger('Broadcaster');

export type BroadcasterCreateOptions = {
	baseUrl: string;
	roomId: RoomId;
	peerId: PeerId;
	displayName: string;
	device: PeerDevice;
};

type BroadcasterConstructorOptions = {
	baseUrl: string;
	roomId: RoomId;
	peerId: PeerId;
	displayName: string;
	device: PeerDevice;
	apiClient: ApiClient;
	routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
};

export class Broadcaster {
	readonly #baseUrl: string;
	readonly #roomId: RoomId;
	readonly #peerId: PeerId;
	readonly #displayName: string;
	readonly #device: PeerDevice;
	readonly #apiClient: ApiClient;
	readonly #routerRtpCapabilities: mediasoupTypes.RtpCapabilities;
	readonly #mediaClients: Set<MediaClient> = new Set();
	#closePromise?: Promise<void>;

	static async create({
		baseUrl,
		roomId,
		peerId,
		displayName,
		device,
	}: BroadcasterCreateOptions): Promise<Broadcaster> {
		logger.debug('create()');

		const apiClient = ApiClient.create({
			baseUrl,
		});

		logger.info(
			'create() | ApiClient created [baseUrl:%o, roomId:%o, peerId:%o, displayName:%o, device:%o]',
			baseUrl,
			roomId,
			peerId,
			displayName,
			device
		);

		const { routerRtpCapabilities } = await apiClient.request({
			name: 'getRouterRtpCapabilities',
			method: 'GET',
			path: ['rooms', { roomId }],
		});

		logger.info('create() | got mediasoup Router RTP capabilities');

		await apiClient.request({
			name: 'createBroadcasterPeer',
			method: 'POST',
			path: ['rooms', { roomId }, 'broadcasters'],
			data: {
				peerId: peerId,
				displayName: displayName,
				device: device,
			},
		});

		logger.info('create() | Broadcaster created in the Room');

		await apiClient.request({
			name: 'join',
			method: 'POST',
			path: ['rooms', { roomId }, 'broadcasters', { peerId }, 'join'],
		});

		logger.info('create() | Broadcaster joined the Room');

		const broadcaster = new Broadcaster({
			baseUrl,
			roomId,
			peerId,
			displayName,
			device,
			apiClient,
			routerRtpCapabilities,
		});

		return broadcaster;
	}

	private constructor({
		baseUrl,
		roomId,
		peerId,
		displayName,
		device,
		apiClient,
		routerRtpCapabilities,
	}: BroadcasterConstructorOptions) {
		logger.debug('constructor()');

		this.#baseUrl = baseUrl;
		this.#roomId = roomId;
		this.#peerId = peerId;
		this.#displayName = displayName;
		this.#device = device;
		this.#apiClient = apiClient;
		this.#routerRtpCapabilities = routerRtpCapabilities;
	}

	async close(): Promise<void> {
		logger.debug('close()');

		if (this.#closePromise) {
			return this.#closePromise;
		}

		const promises: Promise<void>[] = [];

		promises.push(
			this.#apiClient
				.request({
					name: 'disconnect',
					method: 'DELETE',
					path: [
						'rooms',
						{ roomId: this.#roomId },
						'broadcasters',
						{ peerId: this.#peerId },
					],
				})
				.then(() => {
					logger.info('close() | Broadcaster disconnected from the Room');
				})
				.catch(error => {
					logger.info(
						`close() | Broadcaster disconnected from the Room with error: ${(error as Error).message}`
					);
				})
		);

		for (const mediaClient of this.#mediaClients) {
			promises.push(mediaClient.close());
		}

		this.#closePromise = Promise.all(promises).then(() => undefined);

		return this.#closePromise;
	}

	async produceMediaFile({
		mediaClientType,
		mediaFile,
	}: {
		mediaClientType: MediaClientType;
		mediaFile: string;
	}): Promise<void> {
		logger.debug(
			'produceMediaFile() [mediaClientType:%o, mediaFile:%o]',
			mediaClientType,
			mediaFile
		);

		this.assertNotClosed();

		const mediaClient = await this.createMediaClient({ mediaClientType });

		const audioPlainTransportRemoteData = await this.#apiClient.request({
			name: 'createPlainTransport',
			method: 'POST',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'transports',
			],
			data: {
				comedia: true,
				rtcpMux: false,
				appData: {
					direction: 'producer',
				},
			},
		});

		logger.info('produceMediaFile() | audio PlainTransport created');

		const videoPlainTransportRemoteData = await this.#apiClient.request({
			name: 'createPlainTransport',
			method: 'POST',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'transports',
			],
			data: {
				comedia: true,
				rtcpMux: false,
				appData: {
					direction: 'producer',
				},
			},
		});

		logger.info('produceMediaFile() | video PlainTransport created');

		const audioSsrc: number = 1111;
		const audioPt: number = 101;
		const videoSsrc: number = 2222;
		const videoPt: number = 102;
		const cname: string = utils.generateRandomString(6);

		await this.#apiClient.request({
			name: 'produce',
			method: 'POST',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'producers',
			],
			data: {
				transportId: audioPlainTransportRemoteData.transportId,
				kind: 'audio',
				rtpParameters: {
					codecs: [
						{
							mimeType: 'audio/opus',
							payloadType: audioPt,
							clockRate: 48000,
							channels: 2,
							parameters: { 'sprop-stereo': 1 },
						},
					],
					encodings: [{ ssrc: audioSsrc }],
					rtcp: {
						cname,
					},
				},
				appData: {
					source: 'audio',
				},
			},
		});

		logger.info('produceMediaFile() | audio Producer created');

		await this.#apiClient.request({
			name: 'produce',
			method: 'POST',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'producers',
			],
			data: {
				transportId: videoPlainTransportRemoteData.transportId,
				kind: 'video',
				rtpParameters: {
					codecs: [
						{
							mimeType: 'video/vp8',
							payloadType: videoPt,
							clockRate: 90000,
							rtcpFeedback: [
								{ type: 'nack' },
								{ type: 'nack', parameter: 'pli' },
								{ type: 'ccm', parameter: 'fir' },
							],
						},
					],
					encodings: [{ ssrc: videoSsrc }],
				},
				appData: {
					source: 'video',
				},
			},
		});

		logger.info('produceMediaFile() | video Producer created');

		this.#mediaClients.add(mediaClient);

		this.handleMediaClient(mediaClient);

		console.log(
			'TODO: This method must receive a onSendingRtpParameters callback that the MediaClient has generated via ORTC and real RtpCapabilities and so on, and this method MUST NOT receive PRs and SSRCs'
		);
		await mediaClient.sendMediaFile({
			mediaFile,
			audioPlainTransportRemoteData,
			videoPlainTransportRemoteData,
			audioSsrc,
			audioPt,
			videoSsrc,
			videoPt,
		});
	}

	async consume({
		mediaClientType,
	}: {
		mediaClientType: MediaClientType;
	}): Promise<void> {
		logger.debug(
			'consume() [mediaClientType:%o, mediaFile:%o]',
			mediaClientType
		);

		this.assertNotClosed();

		const mediaClient = await this.createMediaClient({ mediaClientType });

		const audioPlainTransportRemoteData = await this.#apiClient.request({
			name: 'createPlainTransport',
			method: 'POST',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'transports',
			],
			data: {
				comedia: false,
				rtcpMux: false,
				appData: {
					direction: 'consumer',
				},
			},
		});

		logger.info('consume() | audio PlainTransport created');

		const videoPlainTransportRemoteData = await this.#apiClient.request({
			name: 'createPlainTransport',
			method: 'POST',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'transports',
			],
			data: {
				comedia: false,
				rtcpMux: false,
				appData: {
					direction: 'consumer',
				},
			},
		});

		logger.info('consume() | video PlainTransport created');

		const { peerProducersInfos } = await this.#apiClient.request({
			name: 'getPeerProducersInfos',
			method: 'GET',
			path: [
				'rooms',
				{ roomId: this.#roomId },
				'broadcasters',
				{ peerId: this.#peerId },
				'peerProducersInfos',
			],
		});

		logger.info(
			'consume() | got Peer Producers infos:',
			util.inspect(peerProducersInfos, {
				depth: null,
				colors: true,
				compact: false,
			})
		);
	}

	private async createMediaClient({
		mediaClientType,
	}: {
		mediaClientType: MediaClientType;
	}): Promise<MediaClient> {
		switch (mediaClientType) {
			case 'ffmpeg': {
				return FFmpeg.create({
					routerRtpCapabilities: this.#routerRtpCapabilities,
				});
			}

			case 'gstreamer': {
				return GStreamer.create({
					routerRtpCapabilities: this.#routerRtpCapabilities,
				});
			}

			default: {
				utils.assertUnreachable('mediaClientType', mediaClientType);
			}
		}
	}

	private handleMediaClient(mediaClient: MediaClient): void {
		mediaClient.on('closed', () => {
			this.#mediaClients.delete(mediaClient);
		});
	}

	private assertNotClosed(): void {
		if (this.#closePromise) {
			throw new BroadcasterInvalidStateError('FFmpeg closed');
		}
	}
}
