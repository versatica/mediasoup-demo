import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { InvalidStateError } from './errors';
import type { PeerId } from './types';

const JOIN_TIMEOUT_MS = 3000;

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
};

export class Peer extends EnhancedEventEmitter<PeerEvents> {
	readonly #logger: Logger;
	readonly #peerId: PeerId;
	readonly #protooPeer: protooTypes.Peer;
	#joinTimer: ReturnType<typeof setTimeout>;
	#joined: boolean = false;
	#closed: boolean = false;

	// eslint-disable-next-line @typescript-eslint/require-await
	static async create({
		peerId,
		protooPeer,
	}: PeerCreateOptions): Promise<Peer> {
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

	private handleProtooPeer(): void {
		this.#protooPeer.on('close', () => {
			if (this.#closed) {
				return;
			}

			this.close();
		});

		this.#protooPeer.on('request', (request, accept, reject) => {
			this.#logger.debug('protoo request [method:%o]', request.method);

			this.handleProtooRequest(request, accept, reject).catch(error => {
				this.#logger.warn(
					'protoo request processing failed [method:%o]',
					request.method,
					error
				);

				reject(error);
			});
		});
	}

	private async handleProtooRequest(
		request: protooTypes.ProtooRequest,
		accept: protooTypes.AcceptFn,
		reject: protooTypes.RejectFn
	): Promise<void> {
		switch (request.method) {
			case 'getRouterRtpCapabilities': {
				// TODO
				// accept(this.#mediasoupRouter.rtpCapabilities);

				break;
			}

			case 'join': {
				if (this.#joined) {
					throw new InvalidStateError('already joined');
				}

				this.#joined = true;

				clearTimeout(this.#joinTimer);

				this.emit('joined');

				break;
			}

			default: {
				this.#logger.error('unknown protoo request method %o', request.method);

				reject(500, `unknown request method "${request.method}"`);
			}
		}
	}
}
