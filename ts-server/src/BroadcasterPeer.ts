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
import { InvalidStateError } from './errors';
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
	rtpCapabilities?: mediasoupTypes.RtpCapabilities;
};

type BroadcasterPeerConstructorOptions = {
	logger: Logger;
	peerId: PeerId;
	remoteAddress: string;
	displayName: string;
	device: PeerDevice;
	rtpCapabilities?: mediasoupTypes.RtpCapabilities;
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
};

export class BroadcasterPeer extends EnhancedEventEmitter<BroadcasterPeerEvents> {
	readonly #logger: Logger;
	readonly #peerId: PeerId;
	readonly #remoteAddress: string;
	readonly #displayName: string;
	readonly #device: PeerDevice;
	readonly #rtpCapabilities?: mediasoupTypes.RtpCapabilities;
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
		rtpCapabilities,
	}: BroadcasterPeerCreateOptions): BroadcasterPeer {
		staticLogger.debug('create() [peerId:%o]', peerId);

		const logger = new Logger(`[peerId:${peerId}]`, staticLogger);
		const broadcasterPeer = new BroadcasterPeer({
			logger,
			peerId,
			remoteAddress,
			displayName,
			device,
			rtpCapabilities,
		});

		return broadcasterPeer;
	}

	private constructor({
		logger,
		peerId,
		remoteAddress,
		displayName,
		device,
		rtpCapabilities,
	}: BroadcasterPeerConstructorOptions) {
		super();

		this.#logger = logger;

		this.#logger.debug('constructor()');

		this.#peerId = peerId;
		this.#remoteAddress = remoteAddress;
		this.#displayName = displayName;
		this.#device = device;
		this.#rtpCapabilities = rtpCapabilities;
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

	async consume({
		producer,
	}: {
		producer: mediasoupTypes.Producer<ProducerAppData>;
	}): Promise<void> {
		this.#logger.debug(
			'consume() [peerId:%o, producerId:%o, source:%o]',
			producer.appData.peerId,
			producer.id,
			producer.appData.source
		);

		const transport = this.getConsumerPlainTransport();

		if (!transport) {
			this.#logger.debug(
				'consume() | no consumer PlainTransport, cannot consume'
			);

			return;
		}

		let canConsume = false;

		this.emit(
			'get-can-consume',
			{ producerId: producer.id, rtpCapabilities: this.#rtpCapabilities },
			_canConsume => {
				canConsume = _canConsume;
			}
		);

		if (!canConsume) {
			this.#logger.debug('consume() | cannot consume');

			return;
		}

		let consumer: mediasoupTypes.Consumer<ConsumerAppData>;

		try {
			consumer = await transport.consume<ConsumerAppData>({
				producerId: producer.id,
				rtpCapabilities: this.#rtpCapabilities!,
				enableRtx: false,
				paused: false,
				ignoreDtx: true,
				appData: {
					peerId: producer.appData.peerId,
					source: producer.appData.source,
				},
			});
		} catch (error) {
			this.#logger.warn(`consume() | transport.consume() failed: ${error}`);

			return;
		}

		this.#consumers.set(consumer.id, consumer);

		this.handleConsumer(consumer);
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
					'API request processing failed [name:%o]:',
					name,
					error
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
			throw new InvalidStateError(`PlainTransport '${transportId}' not found`);
		}

		return transport;
	}

	private assertAndGetProducer(
		producerId: string
	): mediasoupTypes.Producer<ProducerAppData> {
		const producer = this.#producers.get(producerId);

		if (!producer) {
			throw new InvalidStateError(`Producer '${producerId}' not found`);
		}

		return producer;
	}

	private assertAndGetConsumer(
		consumerId: string
	): mediasoupTypes.Consumer<ConsumerAppData> {
		const consumer = this.#consumers.get(consumerId);

		if (!consumer) {
			throw new InvalidStateError(`Consumer '${consumerId}' not found`);
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
			case 'close': {
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
