import * as mediasoup from 'mediasoup';
import type * as mediasoupTypes from 'mediasoup/types';
import type * as protooTypes from 'protoo-server';
import type * as throttleTypes from '@sitespeed.io/throttle';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import {
	TypedProtooNotificationFromPeer,
	TypedProtooRequestFromPeer,
	NotificationNameFromServer,
	NotificationDataFromServer,
	RequestNameFromServer,
	RequestDataFromServer,
	RequestResponseDataFromServer,
} from './signaling/protooMessages';
import { assertUnreachable } from './utils';
import {
	InvalidStateError,
	TransportNotFound,
	ProducerNotFound,
	ConsumerNotFound,
	DataProducerNotFound,
	DataConsumerNotFound,
} from './errors';
import type {
	PeerId,
	PeerDevice,
	SerializedPeer,
	TransportDirection,
	WebRtcTransportAppData,
	ProducerAppData,
	ConsumerAppData,
	DataProducerAppData,
	BotDataProducerAppData,
	DataConsumerAppData,
} from './types';

const JOIN_TIMEOUT_MS = 10000;

const staticLogger = new Logger('Peer');

export type PeerCreateOptions = {
	peerId: PeerId;
	protooPeer: protooTypes.Peer;
	remoteAddress: string;
};

type PeerConstructorOptions = {
	logger: Logger;
	peerId: PeerId;
	protooPeer: protooTypes.Peer;
	remoteAddress: string;
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
	 * Emitted to create and obtain a mediasoup WebRtcTransport.
	 */
	'create-webrtc-transport': [
		{
			direction: TransportDirection;
			sctpCapabilities?: mediasoupTypes.SctpCapabilities;
			forceTcp?: boolean;
		},
		resolve: (
			transport: mediasoupTypes.WebRtcTransport<WebRtcTransportAppData>
		) => void,
		reject: (error: Error) => void,
	];
	/**
	 * Emitted when the Peer creates a Producer.
	 */
	'new-producer': [{ producer: mediasoupTypes.Producer<ProducerAppData> }];
	/**
	 * Emitted when the Peer creates a DataProducer.
	 */
	'new-data-producer': [
		{ dataProducer: mediasoupTypes.DataProducer<DataProducerAppData> },
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

export class Peer extends EnhancedEventEmitter<PeerEvents> {
	readonly #logger: Logger;
	readonly #peerId: PeerId;
	readonly #protooPeer: protooTypes.Peer;
	readonly #remoteAddress: string;
	readonly #joinTimer: ReturnType<typeof setTimeout>;
	#joined: boolean = false;
	#displayName?: string;
	#device?: PeerDevice;
	#rtpCapabilities?: mediasoupTypes.RtpCapabilities;
	#sctpCapabilities?: mediasoupTypes.SctpCapabilities;
	readonly #transports: Map<
		string,
		mediasoupTypes.WebRtcTransport<WebRtcTransportAppData>
	> = new Map();
	readonly #producers: Map<string, mediasoupTypes.Producer<ProducerAppData>> =
		new Map();
	readonly #consumers: Map<string, mediasoupTypes.Consumer<ConsumerAppData>> =
		new Map();
	readonly #dataProducers: Map<
		string,
		mediasoupTypes.DataProducer<DataProducerAppData>
	> = new Map();
	readonly #dataConsumers: Map<
		string,
		mediasoupTypes.DataConsumer<DataConsumerAppData>
	> = new Map();
	#closed: boolean = false;

	static create({
		peerId,
		protooPeer,
		remoteAddress,
	}: PeerCreateOptions): Peer {
		staticLogger.debug('create() [peerId:%o]', peerId);

		const logger = new Logger(`[peerId:${peerId}]`, staticLogger);

		const peer = new Peer({ logger, peerId, protooPeer, remoteAddress });

		return peer;
	}

	private constructor({
		logger,
		peerId,
		protooPeer,
		remoteAddress,
	}: PeerConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

		this.#peerId = peerId;
		this.#protooPeer = protooPeer;
		this.#remoteAddress = remoteAddress;
		this.#joinTimer = setTimeout(() => {
			logger.debug(`Peer didn't join in ${JOIN_TIMEOUT_MS}ms, closing it`);

			this.close();

			if (this.#joined) {
				this.emit('disconnected');
			}
		}, JOIN_TIMEOUT_MS);

		this.handleProtooPeer();

		// Notify the endpoing with the mediasoup version.
		this.notify('mediasoupVersion', { version: mediasoup.version });
	}

	get id(): PeerId {
		return this.#peerId;
	}

	get displayName(): string | undefined {
		return this.#displayName;
	}

	close(): void {
		this.#logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		for (const transport of this.#transports.values()) {
			transport.close();
		}

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
			remoteAddress: this.#remoteAddress,
		};
	}

	getProducers(): mediasoupTypes.Producer<ProducerAppData>[] {
		return Array.from(this.#producers.values());
	}

	getChatDataProducers(): mediasoupTypes.DataProducer<DataProducerAppData>[] {
		return Array.from(this.#dataProducers.values()).filter(
			dataProducer => dataProducer.appData.channel === 'chat'
		);
	}

	async consume({
		producer,
		consumerReplicas,
	}: {
		producer: mediasoupTypes.Producer<ProducerAppData>;
		consumerReplicas: number;
	}): Promise<void> {
		this.#logger.debug(
			'consume() [peerId:%o, producerId:%o, source:%o]',
			producer.appData.peerId,
			producer.id,
			producer.appData.source
		);

		const transport = this.getConsumerWebRtcTransport();

		if (!transport) {
			this.#logger.debug(
				'consume() | no consumer WebRtcTransport, cannot consume'
			);

			return;
		}

		let canConsume: boolean = false;

		this.emit(
			'get-can-consume',
			{ producerId: producer.id, rtpCapabilities: this.#rtpCapabilities },
			_canConsume => {
				canConsume = _canConsume;
			}
		);

		if (!canConsume) {
			this.#logger.debug(
				'consume() | cannot consume Producer [producerId:%o]',
				producer.id
			);

			return;
		}

		const promises: Promise<void>[] = [];
		const consumerCount = 1 + consumerReplicas;

		for (let i = 0; i < consumerCount; ++i) {
			promises.push(
				// eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
				new Promise<void>(async resolve => {
					let consumer: mediasoupTypes.Consumer<ConsumerAppData>;

					try {
						// Create the Consumer in paused mode.
						consumer = await transport.consume<ConsumerAppData>({
							producerId: producer.id,
							rtpCapabilities: this.#rtpCapabilities!,
							// Enable NACK for video and OPUS audio.
							enableRtx: true,
							paused: true,
							ignoreDtx: true,
							appData: {
								peerId: producer.appData.peerId,
								source: producer.appData.source,
							},
						});
					} catch (error) {
						this.#logger.warn(
							`consume() | transport.consume() failed: ${error}`
						);

						resolve();

						return;
					}

					this.#consumers.set(consumer.id, consumer);

					this.handleConsumer(consumer);

					try {
						await this.request('newConsumer', {
							peerId: consumer.appData.peerId,
							transportId: transport.id,
							consumerId: consumer.id,
							producerId: producer.id,
							kind: consumer.kind,
							rtpParameters: consumer.rtpParameters,
							type: consumer.type,
							producerPaused: consumer.producerPaused,
							consumerScore: consumer.score,
							appData: consumer.appData,
						});

						// Now that we got the positive response from the peer, resume the
						// Consumer so the peer will receive the first RTP packet of this
						// new stream once its PeerConnection is ready to process and
						// associate it.
						await consumer.resume();

						resolve();
					} catch (error) {
						this.#logger.warn(`consume() | failed: ${error}`);

						resolve();
					}
				})
			);
		}

		try {
			await Promise.all(promises);
		} catch (error) {
			// NOTE: This shold never happen.
			this.#logger.warn(`consume() | Promise.all() failed: ${error}`);
		}
	}

	async consumeData({
		dataProducer,
	}: {
		dataProducer: mediasoupTypes.DataProducer<
			DataProducerAppData | BotDataProducerAppData
		>;
	}): Promise<void> {
		this.#logger.debug(
			'consumeData() [peerId:%o, dataProducerId:%o, channel:%o]',
			'peerId' in dataProducer.appData
				? dataProducer.appData.peerId
				: undefined,
			dataProducer.id,
			dataProducer.appData.channel
		);

		if (!this.#sctpCapabilities) {
			this.#logger.debug(
				'consumeData() | no SCTP capabilities, cannot consume data'
			);

			return;
		}

		const transport = this.getConsumerWebRtcTransport();

		if (!transport) {
			this.#logger.debug(
				'consumeData() | no consumer WebRtcTransport, cannot consume data'
			);

			return;
		}

		let dataConsumer: mediasoupTypes.DataConsumer<DataConsumerAppData>;

		try {
			dataConsumer = await transport.consumeData<DataConsumerAppData>({
				dataProducerId: dataProducer.id,
				appData: {
					peerId:
						// Trick to make TS happy due the fact that `peerId` is not present
						// in BotDataProducerAppData.
						'peerId' in dataProducer.appData
							? dataProducer.appData.peerId
							: undefined,
					channel: dataProducer.appData.channel,
				},
			});
		} catch (error) {
			this.#logger.warn(
				`consumeData() | transport.consumeData() failed: ${error}`
			);

			return;
		}

		this.#dataConsumers.set(dataConsumer.id, dataConsumer);

		this.handleDataConsumer(dataConsumer);

		try {
			await this.request('newDataConsumer', {
				peerId: dataConsumer.appData.peerId,
				transportId: transport.id,
				dataConsumerId: dataConsumer.id,
				dataProducerId: dataProducer.id,
				// This is a WebRtcTransport so the DataConsumer has SCTP stream
				// parameters.
				sctpStreamParameters: dataConsumer.sctpStreamParameters!,
				label: dataConsumer.label,
				protocol: dataConsumer.protocol,
				appData: dataConsumer.appData,
			});
		} catch (error) {
			this.#logger.warn(`consumeData() | failed: ${error}`);
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

		this.#logger.debug('··> notification [name:%o]', name);

		this.#protooPeer.notify(name, data).catch(error => {
			this.#logger.warn(
				`notify() | failed to send notification [name:%o]: ${error}`,
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

		try {
			this.#logger.debug('==> request [name:%o]', name);

			const responseData = (await this.#protooPeer.request(
				name,
				data
			)) as unknown as Promise<RequestResponseDataFromServer<Name>>;

			this.#logger.debug('<-- success response [name:%o]', name);

			return responseData;
		} catch (error) {
			this.#logger.warn(`<-- error response [name:%o]: ${error}`, name);

			throw error;
		}
	}

	private getConsumerWebRtcTransport():
		| mediasoupTypes.WebRtcTransport<WebRtcTransportAppData>
		| undefined {
		return Array.from(this.#transports.values()).find(
			transport => transport.appData.direction === 'consumer'
		);
	}

	private assertNotClosed(): void {
		if (this.#closed) {
			throw new InvalidStateError('Peer closed');
		}
	}

	private assertJoined(): void {
		if (!this.#joined) {
			throw new InvalidStateError('Peer not joined');
		}
	}

	private assertAndGetWebRtcTransport(
		transportId: string
	): mediasoupTypes.WebRtcTransport<WebRtcTransportAppData> {
		const transport = this.#transports.get(transportId);

		if (!transport) {
			throw new TransportNotFound(`WebRtcTransport '${transportId}' not found`);
		}

		return transport;
	}

	private assertAndGetProducer(
		producerId: string
	): mediasoupTypes.Producer<ProducerAppData> {
		const producer = this.#producers.get(producerId);

		if (!producer) {
			throw new ProducerNotFound(`Producer '${producerId}' not found`);
		}

		return producer;
	}

	private assertAndGetConsumer(
		consumerId: string
	): mediasoupTypes.Consumer<ConsumerAppData> {
		const consumer = this.#consumers.get(consumerId);

		if (!consumer) {
			throw new ConsumerNotFound(`Consumer '${consumerId}' not found`);
		}

		return consumer;
	}

	private assertAndGetDataProducer(
		dataProducerId: string
	): mediasoupTypes.DataProducer<DataProducerAppData> {
		const dataProducer = this.#dataProducers.get(dataProducerId);

		if (!dataProducer) {
			throw new DataProducerNotFound(
				`DataProducer '${dataProducerId}' not found`
			);
		}

		return dataProducer;
	}

	private assertAndGetDataConsumer(
		dataConsumerId: string
	): mediasoupTypes.DataConsumer<DataConsumerAppData> {
		const dataConsumer = this.#dataConsumers.get(dataConsumerId);

		if (!dataConsumer) {
			throw new DataConsumerNotFound(
				`DataConsumer '${dataConsumerId}' not found`
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

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.#protooPeer.on('notification', async notification => {
			this.#logger.debug('<·· notification [name:%o]', notification.method);

			try {
				await this.handleProtooNotification(
					notification as TypedProtooNotificationFromPeer
				);
			} catch (error) {
				this.#logger.warn(
					`protoo notification processing failed [method:%o]: ${error}`,
					notification.method
				);
			}
		});

		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.#protooPeer.on('request', async (request, accept, reject) => {
			this.#logger.debug('<== request [name:%o]', request.method);

			try {
				await this.handleProtooRequest({
					...request,
					// NOTE: Here we could just pass `accept`, but we pass this wrapper to
					// log that a success response was received.
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					accept: (responseData: any) => {
						this.#logger.debug(
							'--> success response [name:%o]',
							request.method
						);

						accept(responseData);
					},
					reject,
				} as TypedProtooRequestFromPeer);
			} catch (error) {
				this.#logger.warn(
					`<-- error response [name:%o]: ${error}`,
					request.method
				);

				reject(error as Error);
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/require-await
	private async handleProtooNotification(
		notification: TypedProtooNotificationFromPeer
	): Promise<void> {
		const { method, data } = notification;

		switch (method) {
			case 'closeProducer': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer(producerId);

				producer.close();

				break;
			}

			case 'pauseProducer': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer(producerId);

				void producer.pause();

				break;
			}

			case 'resumeProducer': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer(producerId);

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
				assertUnreachable('protoo notification method', method);
			}
		}
	}

	private async handleProtooRequest(
		request: TypedProtooRequestFromPeer
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
					throw new InvalidStateError('Peer already joined');
				}

				const { displayName, device, rtpCapabilities, sctpCapabilities } = data;

				this.#joined = true;
				this.#displayName = displayName;
				this.#device = device;
				this.#rtpCapabilities = rtpCapabilities;
				this.#sctpCapabilities = sctpCapabilities;

				clearTimeout(this.#joinTimer);

				this.emit('joined', serializedPeers => {
					accept({ peers: serializedPeers });
				});

				break;
			}

			case 'createWebRtcTransport': {
				const { sctpCapabilities, forceTcp, appData } = data;
				const { direction } = appData;
				const transport = await new Promise<
					mediasoupTypes.WebRtcTransport<WebRtcTransportAppData>
					// eslint-disable-next-line no-shadow
				>((resolve, reject) => {
					this.emit(
						'create-webrtc-transport',
						{ direction, sctpCapabilities, forceTcp },
						resolve,
						reject
					);
				});

				this.#transports.set(transport.id, transport);

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
				const { transportId, dtlsParameters } = data;
				const transport = this.assertAndGetWebRtcTransport(transportId);

				await transport.connect({ dtlsParameters });

				accept();

				break;
			}

			case 'restartIce': {
				const { transportId } = data;
				const transport = this.assertAndGetWebRtcTransport(transportId);
				const iceParameters = await transport.restartIce();

				accept({ iceParameters });

				break;
			}

			case 'produce': {
				this.assertJoined();

				const { transportId, kind, rtpParameters, appData } = data;
				const { source } = appData;
				const transport = this.assertAndGetWebRtcTransport(transportId);
				const producer = await transport.produce<ProducerAppData>({
					kind,
					rtpParameters,
					appData: {
						peerId: this.id,
						source,
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

				const { transportId, sctpStreamParameters, label, protocol, appData } =
					data;
				const { channel } = appData;
				const transport = this.assertAndGetWebRtcTransport(transportId);
				const dataProducer = await transport.produceData<DataProducerAppData>({
					sctpStreamParameters,
					label,
					protocol,
					appData: {
						peerId: this.id,
						channel,
					},
				});

				this.#dataProducers.set(dataProducer.id, dataProducer);

				this.handleDataProducer(dataProducer);
				this.emit('new-data-producer', { dataProducer });

				accept({ dataProducerId: dataProducer.id });

				break;
			}

			case 'getTransportStats': {
				const { transportId } = data;
				const transport = this.assertAndGetWebRtcTransport(transportId);
				const stats = await transport.getStats();

				accept({ stats });

				break;
			}

			case 'getProducerStats': {
				const { producerId } = data;
				const producer = this.assertAndGetProducer(producerId);
				const stats = await producer.getStats();

				accept({ stats });

				break;
			}

			case 'getConsumerStats': {
				const { consumerId } = data;
				const consumer = this.assertAndGetConsumer(consumerId);
				const stats = await consumer.getStats();

				accept({ stats });

				break;
			}

			case 'getDataProducerStats': {
				const { dataProducerId } = data;
				const dataProducer = this.assertAndGetDataProducer(dataProducerId);
				const stats = await dataProducer.getStats();

				accept({ stats });

				break;
			}

			case 'getDataConsumerStats': {
				const { dataConsumerId } = data;
				const dataConsumer = this.assertAndGetDataConsumer(dataConsumerId);
				const stats = await dataConsumer.getStats();

				accept({ stats });

				break;
			}

			case 'applyNetworkThrottle': {
				const { secret, options } = data;

				this.emit(
					'apply-network-throttle',
					{ secret, options },
					accept,
					reject
				);

				break;
			}

			case 'stopNetworkThrottle': {
				const { secret } = data;

				this.emit('stop-network-throttle', { secret }, accept, reject);

				break;
			}

			default: {
				// @ts-expect-error: Must be ready for this despite TS says it's ok.
				reject(500, `unknown request method '${method}'`);

				assertUnreachable('protoo request method', method);
			}
		}
	}

	private handleTransport(
		transport: mediasoupTypes.WebRtcTransport<WebRtcTransportAppData>
	): void {
		const { direction } = transport.appData;

		transport.observer.on('close', () => {
			this.#transports.delete(transport.id);
		});

		transport.on('icestatechange', iceState => {
			if (iceState === 'disconnected' || iceState === 'closed') {
				this.#logger.warn(
					`${direction} WebRtcTransport ICE state changed to %o, closing`,
					iceState
				);

				this.close();
				this.emit('disconnected');
			}
		});

		transport.on('dtlsstatechange', dtlsState => {
			if (dtlsState === 'failed' || dtlsState === 'closed') {
				this.#logger.warn(
					`${direction} WebRtcTransport DTLS state changed to %o, closing`,
					dtlsState
				);

				this.close();
				this.emit('disconnected');
			}
		});
	}

	private handleProducer(
		producer: mediasoupTypes.Producer<ProducerAppData>
	): void {
		producer.observer.on('close', () => {
			this.#producers.delete(producer.id);
		});

		producer.on('score', score => {
			this.notify('producerScore', { producerId: producer.id, score });
		});
	}

	private handleConsumer(
		consumer: mediasoupTypes.Consumer<ConsumerAppData>
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

	private handleDataProducer(
		dataProducer: mediasoupTypes.DataProducer<DataProducerAppData>
	): void {
		dataProducer.observer.on('close', () => {
			this.#dataProducers.delete(dataProducer.id);
		});
	}

	private handleDataConsumer(
		dataConsumer: mediasoupTypes.DataConsumer<DataConsumerAppData>
	): void {
		dataConsumer.observer.on('close', () => {
			this.#dataConsumers.delete(dataConsumer.id);
		});

		dataConsumer.on('dataproducerclose', () => {
			this.notify('dataConsumerClosed', { dataConsumerId: dataConsumer.id });
		});
	}
}
