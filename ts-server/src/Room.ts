import type * as mediasoupTypes from 'mediasoup/types';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Peer } from './Peer';
import { clone } from './utils';
import type {
	Config,
	RoomId,
	PeerId,
	MediasoupWebRtcTransportAppData,
	SerializedPeer,
} from './types';

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

	handleWsConnection(
		peerId: PeerId,
		protooTransport: protooTypes.WebSocketTransport
	): void {
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
		const peer = Peer.create({ peerId, protooPeer });

		// NOTE: The Peer is not yet joined. It will once it sends 'join' request.
		this.#joiningPeers.set(peer.id, peer);

		this.handlePeer(peer);
	}

	private mayClose(): void {
		// If this is the latest Peer in the Room, close the Room.
		// NOTE: Run it in next loop iteration to avoid the case in which there is
		// only a Peer in the Room and it reconnects without closing its previous
		// connection.
		setImmediate(() => {
			if (
				!this.#closed &&
				this.#peers.size === 0 &&
				this.#joiningPeers.size === 0
			) {
				this.#logger.info('last Peer in the Room left, closing the Room');

				this.close();
			}
		});
	}

	private getAllPeers(): Peer[] {
		return Array.from(this.#peers.values());
	}

	private getOtherPeers(excludedPeer: Peer): Peer[] {
		return Array.from(this.#peers.values()).filter(
			peer => peer !== excludedPeer
		);
	}

	private handlePeer(peer: Peer): void {
		peer.on('closed', () => {
			this.#joiningPeers.delete(peer.id);
			this.#peers.delete(peer.id);

			this.mayClose();
		});

		peer.on('joined', callback => {
			this.#joiningPeers.delete(peer.id);
			this.#peers.set(peer.id, peer);

			const otherPeers = this.getOtherPeers(peer);

			callback(otherPeers.map(otherPeer => otherPeer.serialize()));

			for (const otherPeer of otherPeers) {
				otherPeer.notify('newPeer', { peer: peer.serialize() });
			}

			// TODO: Consume from other Peers.
		});

		peer.on('disconnected', () => {
			const otherPeers = this.getOtherPeers(peer);

			for (const otherPeer of otherPeers) {
				otherPeer.notify('peerClosed', { peerId: peer.id });
			}
		});

		peer.on('get-router-rtp-capabilities', callback => {
			callback(this.#mediasoupRouter.rtpCapabilities);
		});

		peer.on(
			'create-webrtc-transport',
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			async ({ direction, sctpCapabilities, forceTcp }, resolve, reject) => {
				try {
					const webRtcTransportOptions: mediasoupTypes.WebRtcTransportOptions<MediasoupWebRtcTransportAppData> =
						{
							...clone(this.#config.mediasoup.webRtcTransportOptions),
							webRtcServer: this.#mediasoupWebRtcServer,
							iceConsentTimeout: 20,
							enableSctp: Boolean(sctpCapabilities),
							numSctpStreams: sctpCapabilities?.numStreams,
							appData: { direction },
						};

					if (forceTcp) {
						webRtcTransportOptions.enableUdp = false;
						webRtcTransportOptions.enableTcp = true;
					}

					const transport = await this.#mediasoupRouter.createWebRtcTransport(
						webRtcTransportOptions
					);

					const { maxIncomingBitrate } =
						this.#config.mediasoup.webRtcTransportOptions ?? {};

					if (maxIncomingBitrate) {
						transport.setMaxIncomingBitrate(maxIncomingBitrate).catch(error => {
							this.#logger.warn(
								`transport.setMaxIncomingBitrate() failed: ${error}`
							);
						});
					}

					resolve(transport);
				} catch (error) {
					reject(error as Error);
				}
			}
		);

		peer.on('new-producer', ({ producer }) => {
			// TODO: Consume from others.
			// TODO: Active speaker stuff.
		});

		peer.on('display-name-changed', ({ displayName, oldDisplayName }) => {
			const otherPeers = this.getOtherPeers(peer);

			for (const otherPeer of otherPeers) {
				otherPeer.notify('peerDisplayNameChanged', {
					peerId: peer.id,
					displayName,
					oldDisplayName,
				});
			}
		});
	}
}
