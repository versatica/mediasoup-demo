import type * as mediasoupTypes from 'mediasoup/types';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Peer } from './Peer';
import { Config, RoomId, PeerId } from './types';

const logger = new Logger('Room');

export type RoomCreateOptions = {
	roomId: RoomId;
	consumerReplicas: number;
	config: Config;
	mediasoupRouter: mediasoupTypes.Router;
	mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
};

type RoomConstructorOptions = {
	roomId: RoomId;
	consumerReplicas: number;
	config: Config;
	mediasoupRouter: mediasoupTypes.Router;
	mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
	protooRoom: protooTypes.Room;
};

export type RoomEvents = {
	/**
	 * Emitted when the Room is closed no matter how.
	 */
	close: [];
};

export class Room extends EnhancedEventEmitter<RoomEvents> {
	readonly #roomId: RoomId;
	readonly #consumerReplicas: number;
	readonly #config: Config;
	readonly #mediasoupRouter: mediasoupTypes.Router;
	readonly #mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
	readonly #protooRoom: protooTypes.Room;
	readonly #peers: Map<string, Peer> = new Map();
	#closed: boolean = false;

	// eslint-disable-next-line @typescript-eslint/require-await
	static async create({
		roomId,
		consumerReplicas,
		config,
		mediasoupRouter,
		mediasoupWebRtcServer,
	}: RoomCreateOptions): Promise<Room> {
		logger.debug('create() [roomId:%o]', roomId);

		const protooRoom = new protoo.Room();
		const room = new Room({
			roomId,
			consumerReplicas,
			config,
			mediasoupRouter,
			mediasoupWebRtcServer,
			protooRoom,
		});

		return room;
	}

	private constructor({
		roomId,
		consumerReplicas,
		config,
		mediasoupRouter,
		mediasoupWebRtcServer,
		protooRoom,
	}: RoomConstructorOptions) {
		super();

		logger.debug(
			'constructor() [roomId:%o, consumerReplicas:%o]',
			roomId,
			consumerReplicas
		);

		this.#roomId = roomId;
		this.#consumerReplicas = consumerReplicas;
		this.#config = config;
		this.#mediasoupRouter = mediasoupRouter;
		this.#mediasoupWebRtcServer = mediasoupWebRtcServer;
		this.#protooRoom = protooRoom;
	}

	get id(): RoomId {
		return this.#roomId;
	}

	close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		for (const peer of this.#peers.values()) {
			peer.close();
		}

		this.#protooRoom.close();

		this.#mediasoupRouter.close();

		// TODO

		this.emit('close');
	}

	getRouterRtpCapabilities(): mediasoupTypes.RouterRtpCapabilities {
		return this.#mediasoupRouter.rtpCapabilities;
	}

	async handleWsConnection(
		peerId: PeerId,
		protooTransport: protooTypes.WebSocketTransport
	): Promise<void> {
		logger.debug('handleWsConnection() [peerId:%o]', peerId);

		const existingPeer = this.#peers.get(peerId);

		if (existingPeer) {
			logger.warn(
				'handleWsConnection() | there is already a Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingPeer.close();
		}

		logger.info(
			'handleWsConnection() | creating a new Peer [peerId:%o]',
			peerId
		);

		const protooPeer = this.#protooRoom.createPeer(peerId, protooTransport);
		const peer = await Peer.create({ peerId, protooPeer });

		this.#peers.set(peerId, peer);

		this.handlePeer(peer);
	}

	private handlePeer(peer: Peer): void {
		peer.on('close', () => {
			this.#peers.delete(peer.id);
		});

		peer.on('disconnect', () => {
			// TODO: Signal it to others.
		});
	}
}
