import type * as mediasoupTypes from 'mediasoup/types';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Bot } from './Bot';
import { Peer } from './Peer';
import { BroadcasterPeer } from './BroadcasterPeer';
import {
	RequestNameFromBroadcasterPeerToRoom,
	RequestDataFromBroadcasterPeerToRoom,
	RequestResponseDataFromBroadcasterPeerToRoom,
	TypedApiRequestFromBroadcasterPeerToRoom,
	RequestNameFromBroadcasterPeer,
	RequestDataFromBroadcasterPeer,
	RequestResponseDataFromBroadcasterPeer,
} from './signaling/apiMessages';
import { PeerNotFound } from './errors';
import { clone, assertUnreachable } from './utils';
import type {
	Config,
	RoomId,
	PeerId,
	SerializedRoom,
	WebRtcTransportAppData,
	ProducerAppData,
	NetworkThrottleOptions,
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
	mediasoupAudioLevelObserver: mediasoupTypes.AudioLevelObserver;
	mediasoupActiveSpeakerObserver: mediasoupTypes.ActiveSpeakerObserver;
	protooRoom: protooTypes.Room;
	bot: Bot;
};

export type RoomEvents = {
	/**
	 * Emitted when the Room is closed no matter how.
	 */
	closed: [];
	/**
	 * Emitted to apply network throttle.
	 */
	'apply-network-throttle': [
		{
			secret: string;
			options: NetworkThrottleOptions;
		},
		resolve: () => void,
		reject: (error: Error) => void,
	];
	/**
	 * Emitted to reset network throttle.
	 */
	'reset-network-throttle': [
		{
			secret: string;
		},
		resolve: () => void,
		reject: (error: Error) => void,
	];
};

export class Room extends EnhancedEventEmitter<RoomEvents> {
	readonly #logger: Logger;
	readonly #roomId: RoomId;
	readonly #consumerReplicas: number;
	readonly #config: Config;
	readonly #mediasoupRouter: mediasoupTypes.Router;
	readonly #mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
	readonly #mediasoupAudioLevelObserver: mediasoupTypes.AudioLevelObserver;
	readonly #mediasoupActiveSpeakerObserver: mediasoupTypes.ActiveSpeakerObserver;
	readonly #protooRoom: protooTypes.Room;
	readonly #bot: Bot;
	readonly #joiningPeers: Map<string, Peer> = new Map();
	readonly #peers: Map<string, Peer> = new Map();
	readonly #broadcasterPeers: Map<string, BroadcasterPeer> = new Map();
	readonly #createdAt: Date;
	#closed: boolean = false;

	static async create({
		roomId,
		consumerReplicas,
		config,
		mediasoupRouter,
		mediasoupWebRtcServer,
	}: RoomCreateOptions): Promise<Room> {
		staticLogger.debug('create() [roomId:%o]', roomId);

		const logger = new Logger(`[roomId:${roomId}]`, staticLogger);
		const mediasoupAudioLevelObserver =
			await mediasoupRouter.createAudioLevelObserver({
				maxEntries: 10,
				threshold: -80,
				interval: 800,
			});
		const mediasoupActiveSpeakerObserver =
			await mediasoupRouter.createActiveSpeakerObserver();
		const protooRoom = new protoo.Room();
		const bot = await Bot.create({ mediasoupRouter });
		const room = new Room({
			logger,
			roomId,
			consumerReplicas,
			config,
			mediasoupRouter,
			mediasoupWebRtcServer,
			mediasoupAudioLevelObserver,
			mediasoupActiveSpeakerObserver,
			protooRoom,
			bot,
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
		mediasoupAudioLevelObserver,
		mediasoupActiveSpeakerObserver,
		protooRoom,
		bot,
	}: RoomConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

		this.#roomId = roomId;
		this.#consumerReplicas = consumerReplicas;
		this.#config = config;
		this.#mediasoupRouter = mediasoupRouter;
		this.#mediasoupWebRtcServer = mediasoupWebRtcServer;
		this.#mediasoupAudioLevelObserver = mediasoupAudioLevelObserver;
		this.#mediasoupActiveSpeakerObserver = mediasoupActiveSpeakerObserver;
		this.#protooRoom = protooRoom;
		this.#bot = bot;
		this.#createdAt = new Date();

		this.handleMediasoupAudioLevelObserver();
		this.handleMediasoupActiveSpeakerObserver();
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

		for (const broadcasterPeer of this.#broadcasterPeers.values()) {
			broadcasterPeer.close();
		}

		this.#protooRoom.close();

		this.#mediasoupRouter.close();

		this.emit('closed');
	}

	serialize(): SerializedRoom {
		return {
			roomId: this.#roomId,
			createdAt: this.#createdAt,
			numPeers: this.#peers.size,
			numJoiningPeers: this.#joiningPeers.size,
			numBroadcasterPeers: this.#broadcasterPeers.size,
			peers: this.getAllPeers().map(peer => peer.serialize()),
			broadcasterPeers: this.getAllBroadcasterPeers().map(broadcasterPeer =>
				broadcasterPeer.serialize()
			),
		};
	}

	processWsConnection({
		peerId,
		protooTransport,
		remoteAddress,
	}: {
		peerId: PeerId;
		protooTransport: protooTypes.WebSocketTransport;
		remoteAddress: string;
	}): void {
		this.#logger.debug('processWsConnection() [peerId:%o]', peerId);

		const existingPeer = this.#peers.get(peerId);

		if (existingPeer) {
			this.#logger.warn(
				'processWsConnection() | there is already a Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingPeer.close();
		}

		const existingJoiningPeer = this.#joiningPeers.get(peerId);

		if (existingJoiningPeer) {
			this.#logger.warn(
				'processWsConnection() | there is already a joining Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingJoiningPeer.close();
		}

		const existingBroadcasterPeer = this.#broadcasterPeers.get(peerId);

		if (existingBroadcasterPeer) {
			this.#logger.warn(
				'processWsConnection() | there is already a BroadcasterPeer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingBroadcasterPeer.close();
		}

		this.#logger.debug(
			'processWsConnection() | creating a new Peer [peerId:%o]',
			peerId
		);

		const protooPeer = this.#protooRoom.createPeer(peerId, protooTransport);
		const peer = Peer.create({ peerId, protooPeer, remoteAddress });

		// NOTE: The Peer is not yet joined. It will once it sends 'join' request.
		this.#joiningPeers.set(peer.id, peer);

		this.handlePeer(peer);
	}

	async processApiRequestToRoom<
		Name extends RequestNameFromBroadcasterPeerToRoom,
	>(
		name: Name,
		...args: RequestDataFromBroadcasterPeerToRoom<Name> extends undefined
			? [undefined?]
			: [RequestDataFromBroadcasterPeerToRoom<Name>]
	): Promise<RequestResponseDataFromBroadcasterPeerToRoom<Name>> {
		return new Promise((resolve, reject) => {
			this.handleApiRequestToRoom({
				name,
				data: args[0],
				accept: resolve,
			} as TypedApiRequestFromBroadcasterPeerToRoom).catch(error => {
				this.#logger.warn(
					'API request processing failed [name:%o]:',
					name,
					error
				);

				reject(error as Error);
			});
		});
	}

	async processApiRequestToBroadcasterPeer<
		Name extends RequestNameFromBroadcasterPeer,
	>(
		peerId: PeerId,
		name: Name,
		...args: RequestDataFromBroadcasterPeer<Name> extends undefined
			? [undefined?]
			: [RequestDataFromBroadcasterPeer<Name>]
	): Promise<RequestResponseDataFromBroadcasterPeer<Name>> {
		const broadcasterPeer = this.#broadcasterPeers.get(peerId);

		if (!broadcasterPeer) {
			throw new PeerNotFound(`broadcaster '${peerId}' doesn't exist`);
		}

		return broadcasterPeer.processApiRequest(name, ...args);
	}

	private mayClose(): void {
		// If this is the latest Peer in the Room, close the Room.
		// NOTE: Run it in next loop iteration to avoid the case in which there is
		// only a Peer in the Room and it reconnects without closing its previous
		// connection.
		//
		// NOTE: We do not take into account BroadcasterPeers.
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

	private getAllBroadcasterPeers(): BroadcasterPeer[] {
		return Array.from(this.#broadcasterPeers.values());
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
			const broadcasterPeers = this.getAllBroadcasterPeers();

			callback([
				...otherPeers.map(otherPeer => otherPeer.serialize()),
				...broadcasterPeers.map(broadcasterPeer => broadcasterPeer.serialize()),
			]);

			for (const otherPeer of otherPeers) {
				otherPeer.notify('newPeer', { peer: peer.serialize() });

				for (const producer of otherPeer.getProducers()) {
					void peer.consume({
						producer,
						consumerReplicas: this.#consumerReplicas,
					});
				}

				const chatDataProducer = otherPeer.getDataProducer({ channel: 'chat' });

				if (chatDataProducer) {
					void peer.consumeData({ dataProducer: chatDataProducer });
				}
			}

			for (const broadcasterPeer of broadcasterPeers) {
				for (const producer of broadcasterPeer.getProducers()) {
					void peer.consume({
						producer,
						consumerReplicas: this.#consumerReplicas,
					});
				}
			}

			void peer.consumeData({ dataProducer: this.#bot.getDataProducer() });
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
					const transport =
						await this.#mediasoupRouter.createWebRtcTransport<WebRtcTransportAppData>(
							{
								...clone(this.#config.mediasoup.webRtcTransportOptions),
								enableUdp: !forceTcp,
								enableTcp: true,
								webRtcServer: this.#mediasoupWebRtcServer,
								iceConsentTimeout: 20,
								enableSctp: Boolean(sctpCapabilities),
								numSctpStreams: sctpCapabilities?.numStreams,
								appData: { direction },
							}
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
			const otherPeers = this.getOtherPeers(peer);
			// TODO: Consume in broadcasters.

			for (const otherPeer of otherPeers) {
				void otherPeer.consume({
					producer,
					consumerReplicas: this.#consumerReplicas,
				});
			}

			if (producer.kind === 'audio') {
				this.#mediasoupAudioLevelObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});

				this.#mediasoupActiveSpeakerObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});
			}
		});

		peer.on('new-data-producer', ({ dataProducer }) => {
			const { channel } = dataProducer.appData;
			const otherPeers = this.getOtherPeers(peer);

			switch (channel) {
				case 'chat': {
					for (const otherPeer of otherPeers) {
						void otherPeer.consumeData({
							dataProducer,
						});
					}

					break;
				}

				case 'bot': {
					void this.#bot.consumeData({ dataProducer, peer });

					break;
				}
			}
		});

		peer.on('get-can-consume', ({ producerId, rtpCapabilities }, callback) => {
			if (rtpCapabilities) {
				callback(
					this.#mediasoupRouter.canConsume({ producerId, rtpCapabilities })
				);
			} else {
				callback(false);
			}
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

		peer.on(
			'apply-network-throttle',
			({ secret, options }, resolve, reject) => {
				this.emit(
					'apply-network-throttle',
					{ secret, options },
					resolve,
					reject
				);
			}
		);

		peer.on('reset-network-throttle', ({ secret }, resolve, reject) => {
			this.emit('reset-network-throttle', { secret }, resolve, reject);
		});
	}

	private handleBroadcasterPeer(broadcasterPeer: BroadcasterPeer): void {
		broadcasterPeer.on('closed', () => {
			this.#broadcasterPeers.delete(broadcasterPeer.id);
		});

		broadcasterPeer.on('joined', () => {
			this.#broadcasterPeers.set(broadcasterPeer.id, broadcasterPeer);

			const peers = this.getAllPeers();

			for (const otherPeer of peers) {
				otherPeer.notify('newPeer', { peer: broadcasterPeer.serialize() });

				for (const producer of otherPeer.getProducers()) {
					void broadcasterPeer.consume({
						producer,
					});
				}
			}
		});

		broadcasterPeer.on('disconnected', () => {
			const peers = this.getAllPeers();

			for (const peer of peers) {
				peer.notify('peerClosed', { peerId: broadcasterPeer.id });
			}
		});

		broadcasterPeer.on('get-router-rtp-capabilities', callback => {
			callback(this.#mediasoupRouter.rtpCapabilities);
		});

		// TODO
		// broadcasterPeer.on(
		// 	'create-plain-transport',
		// 	// eslint-disable-next-line @typescript-eslint/no-misused-promises
		// 	async ({ direction, sctpCapabilities, forceTcp }, resolve, reject) => {
		// 		try {
		// 			const transport =
		// 				await this.#mediasoupRouter.createWebRtcTransport<WebRtcTransportAppData>(
		// 					{
		// 						...clone(this.#config.mediasoup.webRtcTransportOptions),
		// 						enableUdp: !forceTcp,
		// 						enableTcp: true,
		// 						webRtcServer: this.#mediasoupWebRtcServer,
		// 						iceConsentTimeout: 20,
		// 						enableSctp: Boolean(sctpCapabilities),
		// 						numSctpStreams: sctpCapabilities?.numStreams,
		// 						appData: { direction },
		// 					}
		// 				);

		// 			const { maxIncomingBitrate } =
		// 				this.#config.mediasoup.webRtcTransportOptions ?? {};

		// 			if (maxIncomingBitrate) {
		// 				transport.setMaxIncomingBitrate(maxIncomingBitrate).catch(error => {
		// 					this.#logger.warn(
		// 						`transport.setMaxIncomingBitrate() failed: ${error}`
		// 					);
		// 				});
		// 			}

		// 			resolve(transport);
		// 		} catch (error) {
		// 			reject(error as Error);
		// 		}
		// 	}
		// );

		broadcasterPeer.on('new-producer', ({ producer }) => {
			const peers = this.getAllPeers();

			for (const peer of peers) {
				void peer.consume({
					producer,
					consumerReplicas: this.#consumerReplicas,
				});
			}

			if (producer.kind === 'audio') {
				this.#mediasoupAudioLevelObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});

				this.#mediasoupActiveSpeakerObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});
			}
		});

		broadcasterPeer.on(
			'get-can-consume',
			({ producerId, rtpCapabilities }, callback) => {
				if (rtpCapabilities) {
					callback(
						this.#mediasoupRouter.canConsume({ producerId, rtpCapabilities })
					);
				} else {
					callback(false);
				}
			}
		);
	}

	private handleMediasoupAudioLevelObserver(): void {
		this.#mediasoupAudioLevelObserver.on('volumes', volumes => {
			const allPeers = this.getAllPeers();
			const peerVolumes = volumes.map(({ producer, volume }) => {
				const { peerId } = producer.appData as ProducerAppData;

				return {
					peerId,
					volume,
				};
			});

			for (const peer of allPeers) {
				peer.notify('speakingPeers', { peerVolumes });
			}
		});

		this.#mediasoupAudioLevelObserver.on('silence', () => {
			const allPeers = this.getAllPeers();

			for (const peer of allPeers) {
				peer.notify('speakingPeers', { peerVolumes: [] });
				peer.notify('activeSpeaker', { peerId: undefined });
			}
		});
	}

	private handleMediasoupActiveSpeakerObserver(): void {
		this.#mediasoupActiveSpeakerObserver.on(
			'dominantspeaker',
			({ producer }) => {
				const { peerId } = producer.appData as ProducerAppData;
				const allPeers = this.getAllPeers();

				for (const peer of allPeers) {
					peer.notify('activeSpeaker', { peerId });
				}
			}
		);
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async handleApiRequestToRoom(
		request: TypedApiRequestFromBroadcasterPeerToRoom
	): Promise<void> {
		const { name, data, accept } = request;

		switch (name) {
			case 'getRouterRtpCapabilities': {
				accept({
					routerRtpCapabilities: this.#mediasoupRouter.rtpCapabilities,
				});

				break;
			}

			case 'join': {
				const { peerId, remoteAddress, displayName, device, rtpCapabilities } =
					data;

				const broadcasterPeer = BroadcasterPeer.create({
					peerId,
					remoteAddress,
					displayName,
					device,
					rtpCapabilities,
				});

				this.handleBroadcasterPeer(broadcasterPeer);

				// NOTE: Here we invoke the 'joined' event on the new BroadcasterPeer
				// to keep the events based logic consistent.
				// NOTE: Take into account that BroadcasterPeers are always joined
				// once created.
				broadcasterPeer.emit('joined');

				accept();

				break;
			}

			default: {
				assertUnreachable('request name', name);
			}
		}
	}
}
