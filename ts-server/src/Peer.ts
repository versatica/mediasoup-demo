import type * as mediasoupTypes from 'mediasoup/types';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import {
	TypedProtooNotificationFromClient,
	TypedProtooRequestFromClient,
	NotificationNameFromServer,
	NotificationDataFromServer,
	RequestNameFromServer,
	RequestDataFromServer,
	RequestResponseDataFromServer,
} from './signaling/messages';
import { assertUnreachable } from './utils';
import { InvalidStateError } from './errors';
import type {
	PeerId,
	PeerDevice,
	SerializedPeer,
	TransportDirection,
	MediasoupWebRtcTransportAppData,
	MediasoupProducerAppData,
	MediasoupConsumerAppData,
	MediasoupDataProducerAppData,
	MediasoupDataConsumerAppData,
} from './types';

const JOIN_TIMEOUT_MS = 10000;

const staticLogger = new Logger('Peer');

export type PeerCreateOptions = {
	peerId: PeerId;
	protooPeer: protooTypes.Peer;
};

type PeerConstructorOptions = {
	logger: Logger;
	peerId: PeerId;
	protooPeer: protooTypes.Peer;
};

export type PeerEvents = {
	/**
	 * Emitted when the Peer is closed no matter how.
	 */
	closed: [];
	/**
	 * Emitted when the Peer joins the Room.
	 */
	joined: [callback: (serializedPeers: SerializedPeer[]) => void];
	/**
	 * Emitted when the Peer disconnects itself or due to network isses.
	 *
	 * @remarks
	 * - 'disconnected' is only emitted if the Peer was joined.
	 * - 'disconnected' is guaranteed to be emitted after 'closed'.
	 */
	disconnected: [];
	/**
	 * Emitted to obtain the mediasoup Router RTP capabilities.
	 */
	'get-router-rtp-capabilities': [
		callback: (
			routerRtpCapabilities: mediasoupTypes.RouterRtpCapabilities
		) => void,
	];
	/**
	 * Emitted to create and obtain a mediasoup WebRTC transport.
	 */
	'create-webrtc-transport': [
		{
			direction: TransportDirection;
			sctpCapabilities?: mediasoupTypes.SctpCapabilities;
			forceTcp?: boolean;
		},
		resolve: (
			transport: mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>
		) => void,
		reject: (error: Error) => void,
	];
	/**
	 * Emitted when the Peer creates a Producer.
	 */
	'new-producer': [
		{ producer: mediasoupTypes.Producer<MediasoupProducerAppData> },
	];
	/**
	 * Emitted to know whether the Peer can consume a given Producer.
	 */
	'get-can-consume': [
		{
			producerId: string;
			rtpCapabilities?: mediasoupTypes.RtpCapabilities;
		},
		callback: (canConsume: boolean) => void,
	];
	/**
	 * Emitted when Peer changes their display name.
	 */
	'display-name-changed': [{ displayName: string; oldDisplayName: string }];
};

export class Peer extends EnhancedEventEmitter<PeerEvents> {
	readonly #logger: Logger;
	readonly #peerId: PeerId;
	readonly #protooPeer: protooTypes.Peer;
	#joinTimer: ReturnType<typeof setTimeout>;
	#joined: boolean = false;
	#displayName?: string;
	#device?: PeerDevice;
	#rtpCapabilities?: mediasoupTypes.RtpCapabilities;
	#sctpCapabilities?: mediasoupTypes.SctpCapabilities;
	#producerTransport?: mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>;
	#consumerTransport?: mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>;
	#producers: Map<string, mediasoupTypes.Producer<MediasoupProducerAppData>> =
		new Map();
	#consumers: Map<string, mediasoupTypes.Consumer<MediasoupConsumerAppData>> =
		new Map();
	#dataProducers: Map<
		string,
		mediasoupTypes.DataProducer<MediasoupDataProducerAppData>
	> = new Map();
	#dataConsumers: Map<
		string,
		mediasoupTypes.DataConsumer<MediasoupDataConsumerAppData>
	> = new Map();
	#closed: boolean = false;

	static create({ peerId, protooPeer }: PeerCreateOptions): Peer {
		staticLogger.debug('create() [peerId:%o]', peerId);

		const logger = new Logger(`[peerId:${peerId}]`, staticLogger);
		const peer = new Peer({ logger, peerId, protooPeer });

		return peer;
	}

	private constructor({ logger, peerId, protooPeer }: PeerConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

		this.#peerId = peerId;
		this.#protooPeer = protooPeer;
		this.#joinTimer = setTimeout(() => {
			logger.debug(`Peer didn't join in ${JOIN_TIMEOUT_MS}ms, closing it`);

			this.close();

			if (this.#joined) {
				this.emit('disconnected');
			}
		}, JOIN_TIMEOUT_MS);

		this.handleProtooPeer();
	}

	get id(): PeerId {
		return this.#peerId;
	}

	close(): void {
		this.#logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.#protooPeer.close();

		clearTimeout(this.#joinTimer);

		this.emit('closed');
	}

	serialize(): SerializedPeer {
		this.assertJoined();

		return {
			peerId: this.#peerId,
			displayName: this.#displayName!,
			device: this.#device!,
		};
	}

	async consume({
		producer,
		consumerReplicas,
	}: {
		producer: mediasoupTypes.Producer<MediasoupProducerAppData>;
		consumerReplicas: number;
	}): Promise<void> {
		// Don't consume if the Peer cannot consume.
		let canConsume = false;

		this.emit(
			'get-can-consume',
			{ producerId: producer.id, rtpCapabilities: this.#rtpCapabilities },
			_canConsume => {
				canConsume = _canConsume;
			}
		);

		if (!canConsume) {
			return;
		}

		const transport = this.assertAndGetWebRtcTransport({
			direction: 'consumer',
		});
		const promises: Promise<void>[] = [];
		const consumerCount = 1 + consumerReplicas;

		for (let i = 0; i < consumerCount; ++i) {
			promises.push(
				// eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
				new Promise<void>(async resolve => {
					let consumer: mediasoupTypes.Consumer<MediasoupConsumerAppData>;

					try {
						// Create the Consumer in paused mode.
						consumer = await transport.consume<MediasoupConsumerAppData>({
							producerId: producer.id,
							rtpCapabilities: this.#rtpCapabilities!,
							// Enable NACK for video and OPUS audio.
							enableRtx: true,
							paused: true,
							ignoreDtx: true,
							appData: {
								peerId: producer.appData.peerId!,
								source: producer.appData.source,
							},
						});
					} catch (error) {
						this.#logger.warn('consume() | transport.consume() failed:', error);

						resolve();

						return;
					}

					this.#consumers.set(consumer.id, consumer);

					this.handleConsumer(consumer);

					try {
						await this.request('newConsumer', {
							peerId: producer.appData.peerId!,
							consumerId: consumer.id,
							producerId: producer.id,
							kind: consumer.kind,
							rtpParameters: consumer.rtpParameters,
							type: consumer.type,
							producerPaused: consumer.producerPaused,
							appData: consumer.appData,
						});

						// Now that we got the positive response from the client, resume the
						// Consumer so the client will receive the first RTP packet of this
						// new stream once its PeerConnection is ready to process and
						// associate it.
						await consumer.resume();

						this.notify('consumerScore', {
							consumerId: consumer.id,
							score: consumer.score,
						});

						resolve();
					} catch (error) {
						this.#logger.warn('createConsumer() | failed:', error);

						resolve();
					}
				})
			);
		}

		try {
			await Promise.all(promises);
		} catch (error) {
			// NOTE: This shold never happen.
			this.#logger.warn('createConsumer() | Promise.all() failed:', error);
		}
	}

	notify<Name extends NotificationNameFromServer>(
		name: Name,
		...args: NotificationDataFromServer<Name> extends undefined
			? [undefined?]
			: [NotificationDataFromServer<Name>]
	): void {
		if (this.#closed) {
			return;
		}

		const data = args[0];

		this.#protooPeer.notify(name, data).catch(error => {
			this.#logger.warn(
				`notify() | failed to send message [name:%o]: ${error}`,
				name
			);
		});
	}

	private async request<Name extends RequestNameFromServer>(
		name: Name,
		...args: RequestDataFromServer<Name> extends undefined
			? [undefined?]
			: [RequestDataFromServer<Name>]
	): Promise<RequestResponseDataFromServer<Name>> {
		this.assertNotClosed();

		const data = args[0];

		return this.#protooPeer.request(name, data) as unknown as Promise<
			RequestResponseDataFromServer<Name>
		>;
	}

	private assertNotClosed(): void {
		if (this.#closed) {
			throw new InvalidStateError('closed');
		}
	}

	private assertJoined(): void {
		if (!this.#joined) {
			throw new InvalidStateError('not joined');
		}
	}

	private assertAndGetWebRtcTransport({
		direction,
	}: {
		direction: TransportDirection;
	}): mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData> {
		switch (direction) {
			case 'producer': {
				if (!this.#producerTransport) {
					throw new InvalidStateError('no producer WebRTC transport');
				}

				return this.#producerTransport;
			}

			case 'consumer': {
				if (!this.#consumerTransport) {
					throw new InvalidStateError('no consumer WebRTC transport');
				}

				return this.#consumerTransport;
			}

			default: {
				throw new TypeError(`invalid transport direction "${direction}"`);
			}
		}
	}

	private assertAndGetProducer({
		producerId,
	}: {
		producerId: string;
	}): mediasoupTypes.Producer<MediasoupProducerAppData> {
		const producer = this.#producers.get(producerId);

		if (!producer) {
			throw new InvalidStateError(`Producer with id '${producerId}' not found`);
		}

		return producer;
	}

	private assertAndGetConsumer({
		consumerId,
	}: {
		consumerId: string;
	}): mediasoupTypes.Consumer<MediasoupConsumerAppData> {
		const consumer = this.#consumers.get(consumerId);

		if (!consumer) {
			throw new InvalidStateError(`Consumer with id '${consumerId}' not found`);
		}

		return consumer;
	}

	private assertAndGetDataProducer({
		dataProducerId,
	}: {
		dataProducerId: string;
	}): mediasoupTypes.DataProducer<MediasoupDataProducerAppData> {
		const dataProducer = this.#dataProducers.get(dataProducerId);

		if (!dataProducer) {
			throw new InvalidStateError(
				`DataProducer with id '${dataProducerId}' not found`
			);
		}

		return dataProducer;
	}

	private assertAndGetDataConsumer({
		dataConsumerId,
	}: {
		dataConsumerId: string;
	}): mediasoupTypes.DataConsumer<MediasoupDataConsumerAppData> {
		const dataConsumer = this.#dataConsumers.get(dataConsumerId);

		if (!dataConsumer) {
			throw new InvalidStateError(
				`DataConsumer with id '${dataConsumerId}' not found`
			);
		}

		return dataConsumer;
	}

	private handleProtooPeer(): void {
		this.#protooPeer.on('close', () => {
			if (this.#closed) {
				return;
			}

			this.close();

			if (this.#joined) {
				this.emit('disconnected');
			}
		});

		this.#protooPeer.on('notification', notification => {
			this.#logger.debug('protoo request [method:%o]', notification.method);

			this.handleProtooNotification(
				notification as TypedProtooNotificationFromClient
			).catch(error => {
				this.#logger.warn(
					'protoo notification processing failed [method:%o]:',
					notification.method,
					error
				);
			});
		});

		this.#protooPeer.on('request', (request, accept, reject) => {
			this.#logger.debug('protoo request [method:%o]', request.method);

			this.handleProtooRequest({
				...request,
				accept,
				reject,
			} as TypedProtooRequestFromClient).catch(error => {
				this.#logger.warn(
					'protoo request processing failed [method:%o]:',
					request.method,
					error
				);

				reject(error);
			});
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async handleProtooNotification(
		notification: TypedProtooNotificationFromClient
	): Promise<void> {
		const { method, data } = notification;

		switch (method) {
			case 'closeProducer': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer({ producerId });

				producer.close();

				break;
			}

			case 'pauseProducer': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer({ producerId });

				void producer.pause();

				break;
			}

			case 'resumeProducer': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer({ producerId });

				void producer.resume();

				break;
			}

			case 'pauseConsumer': {
				const { consumerId } = data;
				const consumer = this.#consumers.get(consumerId);

				void consumer?.pause();

				break;
			}

			case 'resumeConsumer': {
				const { consumerId } = data;
				const consumer = this.#consumers.get(consumerId);

				void consumer?.resume();

				break;
			}

			case 'setConsumerPreferredLayers': {
				const { consumerId, spatialLayer, temporalLayer } = data;
				const consumer = this.#consumers.get(consumerId);

				void consumer?.setPreferredLayers({ spatialLayer, temporalLayer });

				break;
			}

			case 'setConsumerPriority': {
				const { consumerId, priority } = data;
				const consumer = this.#consumers.get(consumerId);

				void consumer?.setPriority(priority);

				break;
			}

			case 'requestConsumerKeyFrame': {
				const { consumerId } = data;
				const consumer = this.#consumers.get(consumerId);

				void consumer?.requestKeyFrame();

				break;
			}

			case 'changeDisplayName': {
				this.assertJoined();

				const { displayName } = data;
				const oldDisplayName = this.#displayName;

				this.#displayName = displayName;

				this.emit('display-name-changed', {
					displayName: this.#displayName,
					oldDisplayName: oldDisplayName!,
				});

				break;
			}

			default: {
				this.#logger.error('unknown protoo notification method %o', method);

				assertUnreachable(method);
			}
		}
	}

	private async handleProtooRequest(
		request: TypedProtooRequestFromClient
	): Promise<void> {
		const { method, data, accept, reject } = request;

		switch (method) {
			case 'getRouterRtpCapabilities': {
				this.emit('get-router-rtp-capabilities', routerRtpCapabilities => {
					accept({ routerRtpCapabilities });
				});

				break;
			}

			case 'join': {
				if (this.#joined) {
					throw new InvalidStateError('already joined');
				}

				this.#joined = true;
				this.#displayName = data.displayName;
				this.#device = data.device;
				this.#rtpCapabilities = data.rtpCapabilities;
				this.#sctpCapabilities = data.sctpCapabilities;

				clearTimeout(this.#joinTimer);

				this.emit('joined', serializedPeers => {
					accept({ peers: serializedPeers });
				});

				break;
			}

			case 'createWebRtcTransport': {
				const { direction, sctpCapabilities, forceTcp } = data;

				switch (direction) {
					case 'producer': {
						if (this.#producerTransport) {
							throw new InvalidStateError(
								'producer WebRTC transport already exists'
							);
						}

						break;
					}

					case 'consumer': {
						if (this.#consumerTransport) {
							throw new InvalidStateError(
								'consumer WebRTC transport already exists'
							);
						}

						break;
					}

					default: {
						throw new TypeError(`invalid transport direction "${direction}"`);
					}
				}

				const transport = await new Promise<
					mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>
					// eslint-disable-next-line no-shadow
				>((resolve, reject) => {
					this.emit(
						'create-webrtc-transport',
						{ direction, sctpCapabilities, forceTcp },
						resolve,
						reject
					);
				});

				switch (direction) {
					case 'producer': {
						this.#producerTransport = transport;

						break;
					}

					case 'consumer': {
						this.#consumerTransport = transport;

						break;
					}
				}

				this.handleTransport(transport);

				accept({
					transportId: transport.id,
					iceParameters: transport.iceParameters,
					iceCandidates: transport.iceCandidates,
					dtlsParameters: transport.dtlsParameters,
					sctpParameters: transport.sctpParameters,
				});

				break;
			}

			case 'connectWebRtcTransport': {
				const { direction, dtlsParameters } = data;
				const transport = this.assertAndGetWebRtcTransport({ direction });

				await transport.connect({ dtlsParameters });

				accept();

				break;
			}

			case 'restartIce': {
				const { direction } = data;
				const transport = this.assertAndGetWebRtcTransport({ direction });
				const iceParameters = await transport.restartIce();

				accept({ iceParameters });

				break;
			}

			case 'produce': {
				this.assertJoined();

				const { kind, rtpParameters, appData } = data;
				const transport = this.assertAndGetWebRtcTransport({
					direction: 'producer',
				});

				const producer = await transport.produce<MediasoupProducerAppData>({
					kind,
					rtpParameters,
					appData: {
						...appData,
						peerId: this.id,
					},
				});

				this.#producers.set(producer.id, producer);

				this.handleProducer(producer);
				this.emit('new-producer', { producer });

				accept({ producerId: producer.id });

				break;
			}

			case 'produceData': {
				this.assertJoined();

				// TODO

				break;
			}

			case 'getTransportStats': {
				const { direction } = data;
				const transport = this.assertAndGetWebRtcTransport({ direction });
				const stats = await transport.getStats();

				accept({ stats });

				break;
			}

			case 'getProducerStats': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer({ producerId });
				const stats = await producer.getStats();

				accept({ stats });

				break;
			}

			case 'getConsumerStats': {
				const { consumerId } = data;
				const consumer = this.assertAndGetConsumer({ consumerId });
				const stats = await consumer.getStats();

				accept({ stats });

				break;
			}

			case 'getDataProducerStats': {
				const { dataProducerId } = data;
				const dataProducer = this.assertAndGetDataProducer({ dataProducerId });
				const stats = await dataProducer.getStats();

				accept({ stats });

				break;
			}

			case 'getDataConsumerStats': {
				const { dataConsumerId } = data;
				const dataConsumer = this.assertAndGetDataConsumer({ dataConsumerId });
				const stats = await dataConsumer.getStats();

				accept({ stats });

				break;
			}

			default: {
				this.#logger.error('unknown protoo request method %o', method);

				// @ts-expect-error: Must be ready for this despite TS says it's ok.
				reject(500, `unknown request method "${method}"`);

				assertUnreachable(method);
			}
		}
	}

	handleTransport(
		transport: mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>
	): void {
		transport.on('icestatechange', iceState => {
			if (iceState === 'disconnected' || iceState === 'closed') {
				this.#logger.warn(
					'WebRtcTransport ICE state changed to %o, closing',
					iceState
				);

				this.close();
				this.emit('disconnected');
			}
		});

		transport.on('dtlsstatechange', dtlsState => {
			if (dtlsState === 'failed' || dtlsState === 'closed') {
				this.#logger.warn(
					'WebRtcTransport DTLS state changed to %o, closing',
					dtlsState
				);

				this.close();
				this.emit('disconnected');
			}
		});
	}

	handleProducer(
		producer: mediasoupTypes.Producer<MediasoupProducerAppData>
	): void {
		producer.observer.on('close', () => {
			this.#producers.delete(producer.id);
		});

		producer.on('score', score => {
			this.notify('producerScore', { producerId: producer.id, score });
		});

		producer.on('videoorientationchange', videoOrientation => {
			this.#logger.debug(
				'Producer "videoorientationchange" event [producerId:%o, videoOrientation:%o]',
				producer.id,
				videoOrientation
			);
		});
	}

	handleConsumer(
		consumer: mediasoupTypes.Consumer<MediasoupConsumerAppData>
	): void {
		consumer.observer.on('close', () => {
			this.#consumers.delete(consumer.id);
		});

		consumer.on('producerclose', () => {
			this.notify('consumerClosed', { consumerId: consumer.id });
		});

		consumer.on('producerpause', () => {
			this.notify('consumerPaused', { consumerId: consumer.id });
		});

		consumer.on('producerresume', () => {
			this.notify('consumerResumed', { consumerId: consumer.id });
		});

		consumer.on('score', score => {
			this.notify('consumerScore', { consumerId: consumer.id, score });
		});

		consumer.on('layerschange', layers => {
			this.notify('consumerLayersChanged', {
				consumerId: consumer.id,
				layers,
			});
		});
	}

	handleDataProducer(
		dataProducer: mediasoupTypes.DataProducer<MediasoupDataProducerAppData>
	): void {
		dataProducer.observer.on('close', () => {
			this.#dataProducers.delete(dataProducer.id);
		});

		// TODO
	}

	handleDataConsumer(
		dataConsumer: mediasoupTypes.DataConsumer<MediasoupDataConsumerAppData>
	): void {
		dataConsumer.observer.on('close', () => {
			this.#dataConsumers.delete(dataConsumer.id);
		});

		// TODO
	}
}
