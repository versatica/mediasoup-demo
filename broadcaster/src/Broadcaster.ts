import type * as mediasoupTypes from 'mediasoup-client/types';

import { Logger } from './Logger';
import { ApiClient } from './ApiClient';
import { FFmpeg } from './FFmpeg';
import type { RoomId, PeerId, PeerDevice } from './types';

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
	// TODO: Rename to generic / interface.
	readonly #ffmpegs: Set<FFmpeg> = new Set();
	#closed: boolean = false;

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

		logger.info('create() | got mediasoup router RTP capabilities');

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

		logger.info('create() | Broadcaster created in the room');

		await apiClient.request({
			name: 'join',
			method: 'POST',
			path: ['rooms', { roomId }, 'broadcasters', { peerId }, 'join'],
		});

		logger.info('run() | Broadcaster joined the room');

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

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		for (const ffmpeg of this.#ffmpegs) {
			ffmpeg.close();
		}

		try {
			await this.#apiClient.request({
				name: 'disconnect',
				method: 'DELETE',
				path: [
					'rooms',
					{ roomId: this.#roomId },
					'broadcasters',
					{ peerId: this.#peerId },
				],
			});

			logger.info('close() | Broadcaster disconnected from the room');
		} catch (error) {
			logger.info(
				`close() | Broadcaster disconnected from the room with error: ${(error as Error).message}`
			);
		}
	}

	async produceMediaFile({ mediaFile }: { mediaFile: string }): Promise<void> {
		logger.debug('produceMediaFile() [mediaFile:%o]', mediaFile);

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
		console.log(audioPlainTransportRemoteData);

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
		console.log(videoPlainTransportRemoteData);

		const audioSsrc: number = 1111;
		const audioPt: number = 101;
		const videoSsrc: number = 2222;
		const videoPt: number = 102;

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

		const ffmpeg = FFmpeg.create({
			mediaFile,
			audioPlainTransportRemoteData,
			videoPlainTransportRemoteData,
			audioSsrc,
			audioPt,
			videoSsrc,
			videoPt,
		});

		this.#ffmpegs.add(ffmpeg);

		this.handleFFmpeg(ffmpeg);

		await ffmpeg.run();
	}

	// TODO: Rename to generic / ingerface.
	private handleFFmpeg(ffmpeg: FFmpeg): void {
		ffmpeg.on('closed', () => {
			logger.debug('FFpeg closed');

			this.#ffmpegs.delete(ffmpeg);
		});
	}
}
