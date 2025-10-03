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
	joined: [];
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
		resolve: (
			value:
				| mediasoupTypes.RouterRtpCapabilities
				| PromiseLike<mediasoupTypes.RouterRtpCapabilities>
		) => void,
		reject: (error: Error) => void,
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
			value:
				| mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>
				| PromiseLike<
						mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>
				  >
		) => void,
		reject: (error: Error) => void,
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

	private notify<Name extends NotificationNameFromServer>(
		name: Name,
		...args: NotificationDataFromServer<Name> extends undefined
			? [undefined?]
			: [NotificationDataFromServer<Name>]
	): void {
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
		const data = args[0];

		return this.#protooPeer.request(name, data) as unknown as Promise<
			RequestResponseDataFromServer<Name>
		>;
	}

	private async getRouterRtpCapabilities(): Promise<mediasoupTypes.RouterRtpCapabilities> {
		return new Promise((resolve, reject) => {
			this.emit('get-router-rtp-capabilities', resolve, reject);
		});
	}

	private async createWebRtcTransport({
		direction,
		sctpCapabilities,
		forceTcp,
	}: {
		direction: TransportDirection;
		sctpCapabilities?: mediasoupTypes.SctpCapabilities;
		forceTcp?: boolean;
	}): Promise<mediasoupTypes.WebRtcTransport<MediasoupWebRtcTransportAppData>> {
		return new Promise((resolve, reject) => {
			this.emit(
				'create-webrtc-transport',
				{ direction, sctpCapabilities, forceTcp },
				resolve,
				reject
			);
		});
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

	private assertJoined(): void {
		if (!this.#joined) {
			throw new InvalidStateError('not joined');
		}
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

	private async handleProtooNotification(
		notification: TypedProtooNotificationFromClient
	): Promise<void> {
		const { method, data } = notification;

		switch (method) {
			case 'closeProducer': {
				// TODO

				break;
			}

			case 'pauseProducer': {
				// TODO

				break;
			}

			case 'resumeProducer': {
				// TODO

				break;
			}

			case 'pauseConsumer': {
				// TODO

				break;
			}

			case 'resumeConsumer': {
				// TODO

				break;
			}

			case 'setConsumerPreferredLayers': {
				// TODO

				break;
			}

			case 'setConsumerPriority': {
				// TODO

				break;
			}

			case 'requestConsumerKeyFrame': {
				// TODO

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
				const routerRtpCapabilities = await this.getRouterRtpCapabilities();

				accept({ routerRtpCapabilities });

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

				console.log('get joined peers from Room');
				accept({ peers: [] });

				this.emit('joined');

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

				const transport = await this.createWebRtcTransport({
					direction,
					sctpCapabilities,
					forceTcp,
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
				// TODO

				break;
			}

			case 'produceData': {
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
				// TODO

				break;
			}

			case 'getConsumerStats': {
				// TODO

				break;
			}

			case 'getDataProducerStats': {
				// TODO

				break;
			}

			case 'getDataConsumerStats': {
				// TODO

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
}
