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
	#producerTransport?: mediasoupTypes.WebRtcTransport<PlainTransportAppData>;
	#consumerTransport?: mediasoupTypes.WebRtcTransport<PlainTransportAppData>;
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
		const peer = new BroadcasterPeer({
			logger,
			peerId,
			remoteAddress,
			displayName,
			device,
			rtpCapabilities,
		});

		return peer;
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

		this.#producerTransport?.close();
		this.#consumerTransport?.close();

		this.emit('closed');
	}

	serialize(): SerializedPeer {
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
		this.#logger.debug('consume() [producerId:%o]', producer.id);

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

		const transport = this.assertAndGetPlainTransport({
			direction: 'consumer',
		});

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

	private assertNotClosed(): void {
		if (this.#closed) {
			throw new InvalidStateError('Peer closed');
		}
	}

	private assertAndGetPlainTransport({
		direction,
	}: {
		direction: TransportDirection;
	}): mediasoupTypes.WebRtcTransport<PlainTransportAppData> {
		switch (direction) {
			case 'producer': {
				if (!this.#producerTransport) {
					throw new InvalidStateError('no producer WebRtcTransport');
				}

				return this.#producerTransport;
			}

			case 'consumer': {
				if (!this.#consumerTransport) {
					throw new InvalidStateError('no consumer WebRtcTransport');
				}

				return this.#consumerTransport;
			}

			default: {
				assertUnreachable('invalid WebRtcTransport direction', direction);
			}
		}
	}

	private assertAndGetProducer({
		producerId,
	}: {
		producerId: string;
	}): mediasoupTypes.Producer<ProducerAppData> {
		const producer = this.#producers.get(producerId);

		if (!producer) {
			throw new InvalidStateError(`Producer '${producerId}' not found`);
		}

		return producer;
	}

	private assertAndGetConsumer({
		consumerId,
	}: {
		consumerId: string;
	}): mediasoupTypes.Consumer<ConsumerAppData> {
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

	// eslint-disable-next-line @typescript-eslint/require-await
	private async handleApiRequest(
		request: TypedApiRequestFromBroadcasterPeer
	): Promise<void> {
		const { name, data, accept } = request;

		switch (name) {
			case 'close': {
				this.close();
				this.emit('disconnected');

				accept();

				break;
			}

			default: {
				assertUnreachable('request name', name);
			}
		}
	}
}
