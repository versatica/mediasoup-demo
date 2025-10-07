import type * as mediasoupTypes from 'mediasoup/types';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import {
	RequestNameFromBroadcasterPeer,
	RequestDataFromBroadcasterPeer,
	RequestResponseDataFromBroadcasterPeer,
	TypedApiRequestFromBroadcasterPeer,
} from './signaling/apiMessages';
import { assertUnreachable } from './utils';
import {
	InvalidStateError,
	UnsupportedError,
	TransportNotFound,
	ProducerNotFound,
	ConsumerNotFound,
} from './errors';
import type {
	PeerId,
	PeerDevice,
	SerializedPeer,
	TransportDirection,
	PlainTransportAppData,
	ProducerAppData,
	ConsumerAppData,
} from './types';

const staticLogger = new Logger('BroadcasterPeer');

export type BroadcasterPeerCreateOptions = {
	peerId: PeerId;
	remoteAddress: string;
	displayName: string;
	device: PeerDevice;
};

type BroadcasterPeerConstructorOptions = {
	logger: Logger;
	peerId: PeerId;
	remoteAddress: string;
	displayName: string;
	device: PeerDevice;
};

export type BroadcasterPeerEvents = {
	/**
	 * Emitted when the BroadcasterPeer is closed no matter how.
	 */
	closed: [];
	/**
	 * Emitted when the BroadcasterPeer joins the Room.
	 */
	joined: [];
	/**
	 * Emitted when the BroadcasterPeer disconnects itself or due to network
	 * isses.
	 *
	 * @remarks
	 * - 'disconnected' is only emitted if the BroadcasterPeer was joined.
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
	 * Emitted to create and obtain a mediasoup PlainTransport.
	 */
	'create-plain-transport': [
		{
			direction: TransportDirection;
			comedia?: boolean;
			rtcpMux?: boolean;
		},
		resolve: (
			transport: mediasoupTypes.PlainTransport<PlainTransportAppData>
		) => void,
		reject: (error: Error) => void,
	];
	/**
	 * Emitted when the BroadcasterPeer creates a Producer.
	 */
	'new-producer': [{ producer: mediasoupTypes.Producer<ProducerAppData> }];
	/**
	 * Emitted to know whether the BroadcasterPeer can consume a given Producer.
	 */
	'get-can-consume': [
		{
			producerId: string;
			rtpCapabilities?: mediasoupTypes.RtpCapabilities;
		},
		callback: (canConsume: boolean) => void,
	];
	/**
	 * Emitted to obtain a Producer.
	 */
	'get-producer': [
		{
			producerId: string;
		},
		callback: (producer?: mediasoupTypes.Producer<ProducerAppData>) => void,
	];
};

export class BroadcasterPeer extends EnhancedEventEmitter<BroadcasterPeerEvents> {
	readonly #logger: Logger;
	readonly #peerId: PeerId;
	readonly #remoteAddress: string;
	readonly #displayName: string;
	readonly #device: PeerDevice;
	#joined: boolean = false;
	readonly #transports: Map<
		string,
		mediasoupTypes.PlainTransport<PlainTransportAppData>
	> = new Map();
	readonly #producers: Map<string, mediasoupTypes.Producer<ProducerAppData>> =
		new Map();
	readonly #consumers: Map<string, mediasoupTypes.Consumer<ConsumerAppData>> =
		new Map();
	#closed: boolean = false;

	static create({
		peerId,
		remoteAddress,
		displayName,
		device,
	}: BroadcasterPeerCreateOptions): BroadcasterPeer {
		staticLogger.debug('create() [peerId:%o]', peerId);

		const logger = new Logger(`[peerId:${peerId}]`, staticLogger);
		const broadcasterPeer = new BroadcasterPeer({
			logger,
			peerId,
			remoteAddress,
			displayName,
			device,
		});

		return broadcasterPeer;
	}

	private constructor({
		logger,
		peerId,
		remoteAddress,
		displayName,
		device,
	}: BroadcasterPeerConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

		this.#peerId = peerId;
		this.#remoteAddress = remoteAddress;
		this.#displayName = displayName;
		this.#device = device;
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

		this.emit('closed');
	}

	serialize(): SerializedPeer {
		this.assertJoined();

		return {
			peerId: this.#peerId,
			displayName: this.#displayName,
			device: this.#device,
			remoteAddress: this.#remoteAddress,
		};
	}

	getProducers(): mediasoupTypes.Producer<ProducerAppData>[] {
		return Array.from(this.#producers.values());
	}

	async processApiRequest<Name extends RequestNameFromBroadcasterPeer>(
		name: Name,
		...args: RequestDataFromBroadcasterPeer<Name> extends undefined
			? [undefined?]
			: [RequestDataFromBroadcasterPeer<Name>]
	): Promise<RequestResponseDataFromBroadcasterPeer<Name>> {
		return new Promise((resolve, reject) => {
			this.handleApiRequest({
				name,
				data: args[0],
				accept: resolve,
			} as TypedApiRequestFromBroadcasterPeer).catch(error => {
				this.#logger.warn(
					`API request processing failed [name:%o]: ${error}`,
					name
				);

				reject(error as Error);
			});
		});
	}

	private getConsumerPlainTransport():
		| mediasoupTypes.PlainTransport<PlainTransportAppData>
		| undefined {
		return Array.from(this.#transports.values()).find(
			transport => transport.appData.direction === 'consumer'
		);
	}

	private assertNotClosed(): void {
		if (this.#closed) {
			throw new InvalidStateError('BroadcasterPeer closed');
		}
	}

	private assertJoined(): void {
		if (!this.#joined) {
			throw new InvalidStateError('BroadcasterPeer not joined');
		}
	}

	private assertAndGetPlainTransport(
		transportId: string
	): mediasoupTypes.PlainTransport<PlainTransportAppData> {
		const transport = this.#transports.get(transportId);

		if (!transport) {
			throw new TransportNotFound(`PlainTransport '${transportId}' not found`);
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

	private handleProducer(
		producer: mediasoupTypes.Producer<ProducerAppData>
	): void {
		producer.observer.on('close', () => {
			this.#producers.delete(producer.id);
		});
	}

	private handleConsumer(
		consumer: mediasoupTypes.Consumer<ConsumerAppData>
	): void {
		consumer.observer.on('close', () => {
			this.#consumers.delete(consumer.id);
		});
	}

	private async handleApiRequest(
		request: TypedApiRequestFromBroadcasterPeer
	): Promise<void> {
		const { name, data, accept } = request;

		switch (name) {
			case 'join': {
				if (this.#joined) {
					throw new InvalidStateError('Peer already joined');
				}

				this.#joined = true;

				this.emit('joined');

				accept();

				break;
			}

			case 'disconnect': {
				this.close();

				if (this.#joined) {
					this.emit('disconnected');
				}

				accept();

				break;
			}

			case 'createPlainTransport': {
				const { comedia, rtcpMux, appData } = data;
				const { direction } = appData;

				const transport = await new Promise<
					mediasoupTypes.PlainTransport<PlainTransportAppData>
				>((resolve, reject) => {
					this.emit(
						'create-plain-transport',
						{ direction, comedia, rtcpMux },
						resolve,
						reject
					);
				});

				this.#transports.set(transport.id, transport);

				this.handleTransport(transport);

				accept({
					transportId: transport.id,
					ip: transport.tuple.localAddress,
					port: transport.tuple.localPort,
					rtcpPort: transport.rtcpTuple?.localPort,
				});

				break;
			}

			case 'connectPlainTransport': {
				const { transportId, ip, port, rtcpPort } = data;
				const transport = this.assertAndGetPlainTransport(transportId);

				await transport.connect({
					ip,
					port,
					rtcpPort,
				});

				accept();

				break;
			}

			case 'produce': {
				this.assertJoined();

				const { transportId, kind, rtpParameters, appData } = data;
				const { source } = appData;
				const transport = this.assertAndGetPlainTransport(transportId);
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

			case 'consume': {
				this.assertJoined();

				const { transportId, producerId, paused, rtpCapabilities } = data;
				const transport = this.assertAndGetPlainTransport(transportId);

				let canConsume: boolean = false;

				this.emit(
					'get-can-consume',
					{ producerId, rtpCapabilities },
					_canConsume => {
						canConsume = _canConsume;
					}
				);

				if (!canConsume) {
					throw new UnsupportedError(`cannot consume Producer '${producerId}'`);
				}

				let producer: mediasoupTypes.Producer<ProducerAppData> | undefined;

				this.emit('get-producer', { producerId }, _producer => {
					producer = _producer;
				});

				if (!producer) {
					throw new ProducerNotFound(`Producer '${producerId}' not found`);
				}

				const consumer = await transport.consume<ConsumerAppData>({
					producerId,
					rtpCapabilities,
					paused,
					appData: {
						peerId: producer.appData.peerId,
						source: producer.appData.source,
					},
				});

				this.#consumers.set(consumer.id, consumer);

				this.handleConsumer(consumer);

				accept({ consumerId: consumer.id });

				break;
			}

			case 'resumeConsumer': {
				this.assertJoined();

				const { consumerId } = data;
				const consumer = this.assertAndGetConsumer(consumerId);

				await consumer.resume();

				accept();

				break;
			}

			default: {
				assertUnreachable('request name', name);
			}
		}
	}

	private handleTransport(
		transport: mediasoupTypes.PlainTransport<PlainTransportAppData>
	): void {
		transport.observer.on('close', () => {
			this.#transports.delete(transport.id);
		});
	}
}
