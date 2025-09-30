import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { PeerId } from './types';

const logger = new Logger('Room');

export type PeerCreateOptions = {
	peerId: PeerId;
	protooPeer: protooTypes.Peer;
};

type PeerConstructorOptions = {
	peerId: PeerId;
	protooPeer: protooTypes.Peer;
};

export type PeerEvents = {
	/**
	 * Emitted when the Peer is closed no matter how.
	 */
	close: [];
	/**
	 * Emitted when the Peer remotely disconnects or connection was lost.
	 *
	 * @remarks
	 * - 'disconnect' is guaranteed to be emitted after 'closed'.
	 */
	disconnect: [];
};

export class Peer extends EnhancedEventEmitter<PeerEvents> {
	readonly #peerId: PeerId;
	readonly #protooPeer: protooTypes.Peer;
	#closed: boolean = false;

	// eslint-disable-next-line @typescript-eslint/require-await
	static async create({
		peerId,
		protooPeer,
	}: PeerCreateOptions): Promise<Peer> {
		logger.debug('create() [peerId:%o]', peerId);

		const peer = new Peer({ peerId, protooPeer });

		return peer;
	}

	private constructor({ peerId, protooPeer }: PeerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#peerId = peerId;
		this.#protooPeer = protooPeer;

		this.handleProtooPeer();
	}

	get id(): PeerId {
		return this.#peerId;
	}

	close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.#protooPeer.close();

		// TODO

		this.emit('close');
	}

	private handleProtooPeer(): void {
		// TODO

		this.#protooPeer.on('close', () => {
			if (this.#closed) {
				return;
			}

			this.close();
			this.emit('disconnect');
		});
	}
}
