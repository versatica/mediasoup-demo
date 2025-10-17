import type * as mediasoupTypes from 'mediasoup/types';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';
import type * as throttleTypes from '@sitespeed.io/throttle';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Bot } from './Bot';
import { Peer } from './Peer';
import { BroadcasterPeer } from './BroadcasterPeer';
import {
	RequestNameForRoom,
	RequestApiMethod,
	RequestApiPath,
	RequestData,
	RequestInternalData,
	RequestResponseData,
	TypedApiRequest,
} from './signaling/apiMessages';
import { clone, assertUnreachable } from './utils';
import type {
	ServerConfig,
	RoomId,
	PeerId,
	SerializedRoom,
	PeerProducersInfo,
	WebRtcTransportAppData,
	PlainTransportAppData,
	ProducerAppData,
} from './types';

const staticLogger = new Logger('Room');

export type RoomCreateOptions = {
	roomId: RoomId;
	consumerReplicas: number;
	usePipeTransports: boolean;
	config: ServerConfig;
	producerRouter: mediasoupTypes.Router;
	consumerRouter: mediasoupTypes.Router;
	producerWebRtcServer: mediasoupTypes.WebRtcServer;
	consumerWebRtcServer: mediasoupTypes.WebRtcServer;
};

type RoomConstructorOptions = {
	logger: Logger;
	roomId: RoomId;
	consumerReplicas: number;
	usePipeTransports: boolean;
	config: ServerConfig;
	producerRouter: mediasoupTypes.Router;
	consumerRouter: mediasoupTypes.Router;
	producerWebRtcServer: mediasoupTypes.WebRtcServer;
	consumerWebRtcServer: mediasoupTypes.WebRtcServer;
	audioLevelObserver: mediasoupTypes.AudioLevelObserver;
	activeSpeakerObserver: mediasoupTypes.ActiveSpeakerObserver;
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
			options: throttleTypes.ThrottleStartOptions;
		},
		resolve: () => void,
		reject: (error: Error) => void,
	];
	/**
	 * Emitted to stop network throttle.
	 */
	'stop-network-throttle': [
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
	readonly #usePipeTransports: boolean;
	readonly #config: ServerConfig;
	readonly #producerRouter: mediasoupTypes.Router;
	readonly #consumerRouter: mediasoupTypes.Router;
	readonly #producerWebRtcServer: mediasoupTypes.WebRtcServer;
	readonly #consumerWebRtcServer: mediasoupTypes.WebRtcServer;
	readonly #audioLevelObserver: mediasoupTypes.AudioLevelObserver;
	readonly #activeSpeakerObserver: mediasoupTypes.ActiveSpeakerObserver;
	readonly #observedProducers: Map<
		string,
		mediasoupTypes.Producer<ProducerAppData>
	> = new Map();
	readonly #protooRoom: protooTypes.Room;
	readonly #bot: Bot;
	readonly #joiningPeers: Map<string, Peer> = new Map();
	readonly #peers: Map<string, Peer> = new Map();
	readonly #joiningBroadcasterPeers: Map<string, BroadcasterPeer> = new Map();
	readonly #broadcasterPeers: Map<string, BroadcasterPeer> = new Map();
	readonly #createdAt: Date;
	#closed: boolean = false;

	static async create({
		roomId,
		consumerReplicas,
		usePipeTransports,
		config,
		producerRouter,
		consumerRouter,
		producerWebRtcServer,
		consumerWebRtcServer,
	}: RoomCreateOptions): Promise<Room> {
		staticLogger.debug(
			'create() [roomId:%o, usePipeTransports:%o]',
			roomId,
			usePipeTransports
		);

		const logger = new Logger(`[roomId:${roomId}]`, staticLogger);

		const audioLevelObserver = await producerRouter.createAudioLevelObserver({
			maxEntries: 10,
			threshold: -80,
			interval: 800,
		});

		const activeSpeakerObserver =
			await producerRouter.createActiveSpeakerObserver();

		const protooRoom = new protoo.Room();

		const bot = await Bot.create({
			usePipeTransports,
			producerRouter,
			consumerRouter,
		});

		const room = new Room({
			logger,
			roomId,
			consumerReplicas,
			usePipeTransports,
			config,
			producerRouter,
			consumerRouter,
			producerWebRtcServer,
			consumerWebRtcServer,
			audioLevelObserver,
			activeSpeakerObserver,
			protooRoom,
			bot,
		});

		return room;
	}

	private constructor({
		logger,
		roomId,
		consumerReplicas,
		usePipeTransports,
		config,
		producerRouter,
		consumerRouter,
		producerWebRtcServer,
		consumerWebRtcServer,
		audioLevelObserver,
		activeSpeakerObserver,
		protooRoom,
		bot,
	}: RoomConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

		this.#roomId = roomId;
		this.#consumerReplicas = consumerReplicas;
		this.#usePipeTransports = usePipeTransports;
		this.#config = config;
		this.#producerRouter = producerRouter;
		this.#consumerRouter = consumerRouter;
		this.#producerWebRtcServer = producerWebRtcServer;
		this.#consumerWebRtcServer = consumerWebRtcServer;
		this.#audioLevelObserver = audioLevelObserver;
		this.#activeSpeakerObserver = activeSpeakerObserver;
		this.#protooRoom = protooRoom;
		this.#bot = bot;
		this.#createdAt = new Date();

		this.handleProducerRouter();
		this.handleConsumerRouter();
		this.handleProducerWebRtcServer();
		this.handleConsumerWebRtcServer();
		this.handleAudioLevelObserver();
		this.handleActiveSpeakerObserver();
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

		for (const peer of this.#joiningPeers.values()) {
			peer.close();
		}

		for (const peer of this.#peers.values()) {
			peer.close();
		}

		for (const broadcasterPeer of this.#joiningBroadcasterPeers.values()) {
			broadcasterPeer.close();
		}

		for (const broadcasterPeer of this.#broadcasterPeers.values()) {
			broadcasterPeer.close();
		}

		this.#protooRoom.close();

		this.#producerRouter.close();

		this.#consumerRouter.close();

		this.emit('closed');
	}

	serialize(): SerializedRoom {
		return {
			roomId: this.#roomId,
			createdAt: this.#createdAt,
			numPeers: this.#peers.size,
			numJoiningPeers: this.#joiningPeers.size,
			peers: this.getAllPeers().map(peer => peer.serialize()),
			numBroadcasterPeers: this.#broadcasterPeers.size,
			numJoiningBroadcasterPeers: this.#joiningBroadcasterPeers.size,
			broadcasterPeers: this.getAllBroadcasterPeers().map(broadcasterPeer =>
				broadcasterPeer.serialize()
			),
		};
	}

	getBroadcasterPeer(peerId: PeerId): BroadcasterPeer | undefined {
		return (
			this.#broadcasterPeers.get(peerId) ??
			this.#joiningBroadcasterPeers.get(peerId)
		);
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

		this.mayCloseExistingPeer(peerId);

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

	async processApiRequest<Name extends RequestNameForRoom>({
		name,
		method,
		path,
		data,
		internalData,
	}: RequestData<Name> extends undefined
		? RequestInternalData<Name> extends undefined
			? {
					name: Name;
					method: RequestApiMethod<Name>;
					path: RequestApiPath<Name>;
					data?: undefined;
					internalData?: undefined;
				}
			: {
					name: Name;
					method: RequestApiMethod<Name>;
					path: RequestApiPath<Name>;
					data?: undefined;
					internalData: RequestInternalData<Name>;
				}
		: RequestInternalData<Name> extends undefined
			? {
					name: Name;
					method: RequestApiMethod<Name>;
					path: RequestApiPath<Name>;
					data: RequestData<Name>;
					internalData?: undefined;
				}
			: {
					name: Name;
					method: RequestApiMethod<Name>;
					path: RequestApiPath<Name>;
					data: RequestData<Name>;
					internalData: RequestInternalData<Name>;
				}): Promise<RequestResponseData<Name>> {
		return new Promise((resolve, reject) => {
			this.handleApiRequest({
				name,
				method,
				path,
				data,
				internalData,
				accept: resolve,
			} as TypedApiRequest<RequestNameForRoom>).catch(error => {
				this.#logger.warn(
					`API request processing failed [name:%o]: ${error}`,
					name
				);

				reject(error as Error);
			});
		});
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

	private getOtherBroadcasterPeers(
		excludedBroadcasterPeer: BroadcasterPeer
	): BroadcasterPeer[] {
		return Array.from(this.#broadcasterPeers.values()).filter(
			broadcasterPeer => broadcasterPeer !== excludedBroadcasterPeer
		);
	}

	private mayCloseExistingPeer(peerId: PeerId): void {
		const existingPeer = this.#peers.get(peerId);

		if (existingPeer) {
			this.#logger.warn(
				'mayCloseExistingPeer() | there is already a Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingPeer.close();
		}

		const existingJoiningPeer = this.#joiningPeers.get(peerId);

		if (existingJoiningPeer) {
			this.#logger.warn(
				'mayCloseExistingPeer() | there is already a joining Peer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingJoiningPeer.close();
		}

		const existingBroadcasterPeer = this.#broadcasterPeers.get(peerId);

		if (existingBroadcasterPeer) {
			this.#logger.warn(
				'mayCloseExistingPeer() | there is already a BroadcasterPeer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingBroadcasterPeer.close();
		}

		const existingJoiningBroadcasterPeer =
			this.#joiningBroadcasterPeers.get(peerId);

		if (existingJoiningBroadcasterPeer) {
			this.#logger.warn(
				'mayCloseExistingPeer() | there is already a joining BroadcasterPeer with same peerId, closing it [peerId:%o]',
				peerId
			);

			existingJoiningBroadcasterPeer.close();
		}
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

				for (const chatDataProducer of otherPeer.getChatDataProducers()) {
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
			callback(this.#consumerRouter.rtpCapabilities);
		});

		peer.on(
			'create-webrtc-transport',
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			async ({ direction, sctpCapabilities, forceTcp }, resolve, reject) => {
				try {
					let mediasoupRouter: mediasoupTypes.Router;
					let mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;

					switch (direction) {
						case 'producer': {
							mediasoupRouter = this.#producerRouter;
							mediasoupWebRtcServer = this.#producerWebRtcServer;

							break;
						}

						case 'consumer': {
							mediasoupRouter = this.#consumerRouter;
							mediasoupWebRtcServer = this.#consumerWebRtcServer;

							break;
						}

						default: {
							assertUnreachable('invalid transport direction', direction);
						}
					}

					const transport =
						await mediasoupRouter.createWebRtcTransport<WebRtcTransportAppData>(
							{
								...clone(this.#config.mediasoup.webRtcTransportOptions),
								enableUdp: !forceTcp,
								enableTcp: true,
								webRtcServer: mediasoupWebRtcServer,
								iceConsentTimeout: 20,
								enableSctp: Boolean(sctpCapabilities),
								numSctpStreams: sctpCapabilities?.numStreams,
								appData: { direction },
							}
						);

					const { maxIncomingBitrate } =
						this.#config.mediasoup.additionalWebRtcTransportOptions ?? {};

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

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		peer.on('new-producer', async ({ producer }) => {
			if (this.#usePipeTransports) {
				await this.#producerRouter.pipeToRouter({
					producerId: producer.id,
					router: this.#consumerRouter,
				});
			}

			const otherPeers = this.getOtherPeers(peer);

			for (const otherPeer of otherPeers) {
				void otherPeer.consume({
					producer,
					consumerReplicas: this.#consumerReplicas,
				});
			}

			if (producer.kind === 'audio') {
				this.#audioLevelObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});

				this.#activeSpeakerObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});
			}
		});

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		peer.on('new-data-producer', async ({ dataProducer }) => {
			const { channel } = dataProducer.appData;

			switch (channel) {
				case 'chat': {
					if (this.#usePipeTransports) {
						await this.#producerRouter.pipeToRouter({
							dataProducerId: dataProducer.id,
							router: this.#consumerRouter,
						});
					}

					const otherPeers = this.getOtherPeers(peer);

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
					this.#consumerRouter.canConsume({
						producerId,
						rtpCapabilities,
					})
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

		peer.on('stop-network-throttle', ({ secret }, resolve, reject) => {
			this.emit('stop-network-throttle', { secret }, resolve, reject);
		});
	}

	private handleBroadcasterPeer(broadcasterPeer: BroadcasterPeer): void {
		broadcasterPeer.on('closed', () => {
			this.#joiningBroadcasterPeers.delete(broadcasterPeer.id);
			this.#broadcasterPeers.delete(broadcasterPeer.id);
		});

		broadcasterPeer.on('joined', () => {
			this.#joiningBroadcasterPeers.delete(broadcasterPeer.id);
			this.#broadcasterPeers.set(broadcasterPeer.id, broadcasterPeer);

			const peers = this.getAllPeers();

			for (const peer of peers) {
				peer.notify('newPeer', { peer: broadcasterPeer.serialize() });
			}
		});

		broadcasterPeer.on('disconnected', () => {
			const peers = this.getAllPeers();

			for (const peer of peers) {
				peer.notify('peerClosed', { peerId: broadcasterPeer.id });
			}
		});

		broadcasterPeer.on('get-router-rtp-capabilities', callback => {
			callback(this.#consumerRouter.rtpCapabilities);
		});

		broadcasterPeer.on(
			'create-plain-transport',
			// eslint-disable-next-line @typescript-eslint/no-misused-promises
			async ({ direction, comedia, rtcpMux }, resolve, reject) => {
				try {
					let mediasoupRouter: mediasoupTypes.Router;

					switch (direction) {
						case 'producer': {
							mediasoupRouter = this.#producerRouter;

							break;
						}

						case 'consumer': {
							mediasoupRouter = this.#consumerRouter;

							break;
						}

						default: {
							assertUnreachable('invalid transport direction', direction);
						}
					}

					const transport =
						await mediasoupRouter.createPlainTransport<PlainTransportAppData>({
							...clone(this.#config.mediasoup.plainTransportOptions),
							comedia,
							rtcpMux,
							appData: { direction },
						});

					resolve(transport);
				} catch (error) {
					reject(error as Error);
				}
			}
		);

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		broadcasterPeer.on('new-producer', async ({ producer }) => {
			if (this.#usePipeTransports) {
				await this.#producerRouter.pipeToRouter({
					producerId: producer.id,
					router: this.#consumerRouter,
				});
			}

			const peers = this.getAllPeers();

			for (const peer of peers) {
				void peer.consume({
					producer,
					consumerReplicas: this.#consumerReplicas,
				});
			}

			if (producer.kind === 'audio') {
				this.#audioLevelObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});

				this.#activeSpeakerObserver
					.addProducer({ producerId: producer.id })
					.catch(() => {});
			}
		});

		broadcasterPeer.on(
			'get-can-consume',
			({ producerId, rtpCapabilities }, callback) => {
				if (rtpCapabilities) {
					callback(
						this.#consumerRouter.canConsume({
							producerId,
							rtpCapabilities,
						})
					);
				} else {
					callback(false);
				}
			}
		);

		broadcasterPeer.on('get-peer-producers-infos', callback => {
			const peerProducersMap: Map<
				PeerId,
				mediasoupTypes.Producer<ProducerAppData>[]
			> = new Map();

			for (const producer of this.#observedProducers.values()) {
				const { peerId } = producer.appData;
				const producers = peerProducersMap.get(peerId);

				if (producers) {
					producers.push(producer);
				} else {
					peerProducersMap.set(peerId, [producer]);
				}
			}

			const peerProducersInfos: PeerProducersInfo[] = [];

			for (const [peerId, producers] of peerProducersMap) {
				peerProducersInfos.push({
					peerId,
					producers: producers.map(producer => {
						return {
							producerId: producer.id,
							kind: producer.kind,
							source: producer.appData.source,
							// NOTE: Remove rtcpFeedback from codecs.
							// NOTE: Remove RTX codecs.
							consumableCodecs: producer.consumableRtpParameters.codecs
								.filter(
									codec =>
										codec.mimeType.toLowerCase() !== 'audio/rtx' &&
										codec.mimeType.toLowerCase() !== 'video/rtx'
								)
								.map(codec => {
									return {
										...codec,
										rtcpFeedback: undefined,
									};
								}),
						};
					}),
				});
			}

			callback(peerProducersInfos);
		});

		broadcasterPeer.on('get-producer', ({ producerId }, callback) => {
			const producer = this.#observedProducers.get(producerId);

			callback(producer);
		});
	}

	private handleProducerRouter(): void {
		this.#producerRouter.observer.on('close', () => {
			this.close();
		});

		this.#producerRouter.observer.on('newtransport', transport => {
			transport.observer.on('newproducer', producer => {
				this.#observedProducers.set(
					producer.id,
					producer as mediasoupTypes.Producer<ProducerAppData>
				);

				producer.observer.on('close', () => {
					this.#observedProducers.delete(producer.id);
				});
			});
		});
	}

	private handleConsumerRouter(): void {
		this.#consumerRouter.observer.on('close', () => {
			this.close();
		});
	}

	private handleProducerWebRtcServer(): void {
		this.#producerWebRtcServer.observer.on('close', () => {
			this.close();
		});
	}

	private handleConsumerWebRtcServer(): void {
		this.#producerWebRtcServer.observer.on('close', () => {
			this.close();
		});
	}

	private handleAudioLevelObserver(): void {
		this.#audioLevelObserver.on('volumes', volumes => {
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

		this.#audioLevelObserver.on('silence', () => {
			const allPeers = this.getAllPeers();

			for (const peer of allPeers) {
				peer.notify('speakingPeers', { peerVolumes: [] });
				peer.notify('activeSpeaker', { peerId: undefined });
			}
		});
	}

	private handleActiveSpeakerObserver(): void {
		this.#activeSpeakerObserver.on('dominantspeaker', ({ producer }) => {
			const { peerId } = producer.appData as ProducerAppData;
			const allPeers = this.getAllPeers();

			for (const peer of allPeers) {
				peer.notify('activeSpeaker', { peerId });
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async handleApiRequest(
		request: TypedApiRequest<RequestNameForRoom>
	): Promise<void> {
		const { name, data, internalData, accept } = request;

		switch (name) {
			case 'getRouterRtpCapabilities': {
				accept({
					routerRtpCapabilities: this.#consumerRouter.rtpCapabilities,
				});

				break;
			}

			case 'createBroadcasterPeer': {
				const { peerId, displayName, device } = data;
				const { remoteAddress } = internalData;

				this.mayCloseExistingPeer(peerId);

				this.#logger.debug(
					'handleApiRequest() | creating a new BroadcasterPeer [peerId:%o]',
					peerId
				);

				const broadcasterPeer = BroadcasterPeer.create({
					peerId,
					remoteAddress,
					displayName,
					device,
				});

				// NOTE: The BroadcasterPeer is not yet joined. It will once it sends
				// 'join' request.
				this.#joiningBroadcasterPeers.set(broadcasterPeer.id, broadcasterPeer);

				this.handleBroadcasterPeer(broadcasterPeer);

				accept();

				break;
			}

			default: {
				assertUnreachable('request name', name);
			}
		}
	}
}
