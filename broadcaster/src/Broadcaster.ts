import type * as mediasoupTypes from 'mediasoup-client/types';

import { Logger } from './Logger';
import { ApiClient } from './ApiClient';
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

		const audioProducerTransportRemoteData = await apiClient.request({
			name: 'createPlainTransport',
			method: 'POST',
			path: ['rooms', { roomId }, 'broadcasters', { peerId }, 'transports'],
			data: {
				comedia: true,
				rtcpMux: true,
				appData: {
					direction: 'producer',
				},
			},
		});

		logger.info('create() | producer mediasoup PlainTransport created');
		console.log(audioProducerTransportRemoteData);

		console.log('TODO: Do more stuff, hehe');

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

	public async close(): Promise<void> {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

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
}
