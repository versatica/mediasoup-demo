import * as https from 'node:https';
import * as http from 'node:http';
import * as tls from 'node:tls';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Room } from './Room';
import * as utils from './utils';
import type { RoomId } from './types';

const logger = new Logger('WsServer');

export type WsServerCreateOptions = {
	httpServer: https.Server | http.Server;
	httpOriginHeader: string;
};

type WsServerConstructorOptions = {
	protooServer: protooTypes.WebSocketServer;
	httpOriginHeader: string;
};

export type WsServerEvents = {
	/**
	 * Emitted to create or get an existing Room.
	 */
	'get-or-create-room': [
		{ roomId: RoomId; consumerReplicas: number; usePipeTransports: boolean },
		resolve: (room: Room) => void,
		reject: (error: Error) => void,
	];
};

export class WsServer extends EnhancedEventEmitter<WsServerEvents> {
	readonly #protooServer: protooTypes.WebSocketServer;
	readonly #httpOriginHeader: string;

	static create({
		httpServer,
		httpOriginHeader,
	}: WsServerCreateOptions): WsServer {
		logger.debug('create()');

		const protooServer = new protoo.WebSocketServer(httpServer, {
			maxReceivedFrameSize: 960000, // 960 KBytes.
			maxReceivedMessageSize: 960000,
			fragmentOutgoingMessages: true,
			fragmentationThreshold: 960000,
		});

		const wsServer = new WsServer({ protooServer, httpOriginHeader });

		return wsServer;
	}

	private constructor({
		protooServer,
		httpOriginHeader,
	}: WsServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#protooServer = protooServer;
		this.#httpOriginHeader = httpOriginHeader;

		this.handleProtooServer();
	}

	private handleProtooServer(): void {
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.#protooServer.on('connectionrequest', async (info, accept, reject) => {
			// Validate HTTP Origin header.
			if (
				!utils.areSameHttpOrigins(
					info.request.headers.origin,
					this.#httpOriginHeader
				)
			) {
				reject(403, 'GO TO HELL 🖕🏼');

				return;
			}

			if (!info.request.url || !info.request.headers.host) {
				reject(400, `Missing URL or Host header in the request`);

				return;
			}

			const scheme = info.socket instanceof tls.TLSSocket ? 'wss' : 'ws';
			const fullUrl = `${scheme}://${info.request.headers.host}${info.request.url}`;
			const params = new URL(fullUrl).searchParams;
			const roomId = params.get('roomId');
			const peerId = params.get('peerId');
			const consumerReplicas = Number(params.get('consumerReplicas') ?? 0);
			const usePipeTransports = params.get('usePipeTransports') === 'true';

			if (!roomId || !peerId) {
				reject(400, 'Missing roomId and/or peerId');

				return;
			}

			logger.info(
				'protoo WebSocket connection request [roomId:%o, peerId:%o, address:%o, origin:%o]',
				roomId,
				peerId,
				info.socket.remoteAddress,
				info.origin
			);

			try {
				// eslint-disable-next-line no-shadow
				const room = await new Promise<Room>((resolve, reject) => {
					this.emit(
						'get-or-create-room',
						{ roomId, consumerReplicas, usePipeTransports },
						resolve,
						reject
					);
				});

				const protooTransport = accept();

				room.processWsConnection({
					peerId,
					protooTransport,
					// NOTE: It should always exist (unless socket is disconnected, but
					// we don't care about that).
					remoteAddress: info.socket.remoteAddress!,
				});
			} catch (error) {
				logger.error('Room creation or Room joining failed:', error);

				reject(error as Error);

				return;
			}
		});
	}
}
