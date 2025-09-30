import type * as mediasoupTypes from 'mediasoup/types';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Peer } from './Peer';
import type { Config, RoomId, PeerId } from './types';

const staticLogger = new Logger('Room');

export type RoomCreateOptions = {
	roomId: RoomId;
	consumerReplicas: number;
	config: Config;
	mediasoupRouter: mediasoupTypes.Router;
	mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
};

type RoomConstructorOptions = {
	logger: Logger;
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
	closed: [];
};

export class Room extends EnhancedEventEmitter<RoomEvents> {
	readonly #logger: Logger;
	readonly #roomId: RoomId;
	readonly #consumerReplicas: number;
	readonly #config: Config;
	readonly #mediasoupRouter: mediasoupTypes.Router;
	readonly #mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
	readonly #protooRoom: protooTypes.Room;
	readonly #joiningPeers: Map<string, Peer> = new Map();
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
		staticLogger.debug('create() [roomId:%o]', roomId);

		const logger = new Logger(`[roomId:${roomId}]`, staticLogger);
		const protooRoom = new protoo.Room();
		const room = new Room({
			logger,
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
		logger,
		roomId,
		consumerReplicas,
		config,
		mediasoupRouter,
		mediasoupWebRtcServer,
		protooRoom,
	}: RoomConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

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
		this.#logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		for (const peer of this.#peers.values()) {
			peer.close();
		}

		for (const peer of this.#joiningPeers.values()) {
			peer.close();
		}

		this.#protooRoom.close();

		this.#mediasoupRouter.close();

		this.emit('closed');
	}

	getRouterRtpCapabilities(): mediasoupTypes.RouterRtpCapabilities {
		return this.#mediasoupRouter.rtpCapabilities;
	}

	async handleWsConnection(
		peerId: PeerId,
		protooTransport: protooTypes.WebSocketTransport
	): Promise<void> {
		this.#logger.debug('handleWsConnection() [peerId:%o]', peerId);

		const existingPeer = this.#peers.get(peerId);

		if (existingPeer) {
			this.#logger.warn(
				'handleWsConnection() | there is already a Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingPeer.close();
		}

		const existingJoiningPeer = this.#joiningPeers.get(peerId);

		if (existingJoiningPeer) {
			this.#logger.warn(
				'handleWsConnection() | there is already a joining Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingJoiningPeer.close();
		}

		this.#logger.debug(
			'handleWsConnection() | creating a new Peer [peerId:%o]',
			peerId
		);

		const protooPeer = this.#protooRoom.createPeer(peerId, protooTransport);
		const peer = await Peer.create({ peerId, protooPeer });

		// NOTE: The Peer is not yet joined. It will once it sends 'join' request.

		this.#joiningPeers.set(peer.id, peer);

		this.handleJoiningPeer(peer);
	}

	private mayClose(): void {
		// If this is the latest Peer in the Room, close the Room.
		if (this.#peers.size === 0 && this.#joiningPeers.size === 0) {
			this.#logger.info('last Peer in the Room left, closing the Room');

			this.close();
		}
	}

	private handleJoiningPeer(peer: Peer): void {
		const onClosed = (): void => {
			this.#joiningPeers.delete(peer.id);

			if (this.#closed) {
				return;
			}

			this.mayClose();
		};

		const onJoined = (): void => {
			// Remove the current event listeners.
			peer.removeListener('closed', onClosed);
			peer.removeListener('joined', onJoined);

			this.#joiningPeers.delete(peer.id);
			this.#peers.set(peer.id, peer);

			this.handlePeer(peer);
		};

		peer.on('closed', onClosed);

		peer.on('joined', onJoined);
	}

	private handlePeer(peer: Peer): void {
		peer.on('closed', () => {
			this.#peers.delete(peer.id);

			if (this.#closed) {
				return;
			}

			// TODO: Signal it to others.

			this.mayClose();
		});
	}
}
