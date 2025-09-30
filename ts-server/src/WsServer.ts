import * as https from 'node:https';
import * as http from 'node:http';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Room } from './Room';
import { RoomId } from './types';

const logger = new Logger('WsServer');

export type WsServerCreateOptions = {
	httpServer: https.Server | http.Server;
};

type WsServerConstructorOptions = {
	protooServer: protooTypes.WebSocketServer;
};

export type WsServerEvents = {
	/**
	 * Emitted to obtain a Room.
	 */
	'get-room': [
		{ roomId: RoomId; consumerReplicas: number },
		resolve: (value: Room | PromiseLike<Room>) => void,
		reject: (error: Error) => void,
	];
};

export class WsServer extends EnhancedEventEmitter<WsServerEvents> {
	readonly #protooServer: protooTypes.WebSocketServer;

	// eslint-disable-next-line @typescript-eslint/require-await
	static async create({
		httpServer,
	}: WsServerCreateOptions): Promise<WsServer> {
		logger.debug('create()');

		const protooServer = new protoo.WebSocketServer(httpServer, {
			maxReceivedFrameSize: 960000, // 960 KBytes.
			maxReceivedMessageSize: 960000,
			fragmentOutgoingMessages: true,
			fragmentationThreshold: 960000,
		});
		const wsServer = new WsServer({ protooServer });

		return wsServer;
	}

	private constructor({ protooServer }: WsServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#protooServer = protooServer;

		this.handleProtooServer();
	}

	private async getRoom({
		roomId,
		consumerReplicas,
	}: {
		roomId: RoomId;
		consumerReplicas: number;
	}): Promise<Room> {
		return new Promise<Room>((resolve, reject) => {
			this.emit('get-room', { roomId, consumerReplicas }, resolve, reject);
		});
	}

	private handleProtooServer(): void {
		// eslint-disable-next-line @typescript-eslint/no-misused-promises
		this.#protooServer.on('connectionrequest', async (info, accept, reject) => {
			if (!info.request.url) {
				reject(400, 'Missing URL in the request');

				return;
			}

			// The client indicates the roomId and peerId in the URL query.
			const params = new URL(info.request.url).searchParams;
			const roomId = params.get('roomId');
			const peerId = params.get('peerId');
			const consumerReplicas = Number(params.get('consumerReplicas') ?? 0);

			if (!roomId || !peerId) {
				reject(400, 'Missing roomId and/or peerId');

				return;
			}

			logger.debug(
				'protoo WebSocket connection request [roomId:%o, peerId:%o, address:%o, origin:%o]',
				roomId,
				peerId,
				info.socket.remoteAddress,
				info.origin
			);

			let room: Room;
			let protooTransport: protooTypes.WebSocketTransport;

			try {
				room = await this.getRoom({
					roomId,
					consumerReplicas,
				});

				protooTransport = accept();
			} catch (error) {
				logger.error('Room creation or Room joining failed:', error);

				reject(error as Error);

				return;
			}

			void room.handleWsConnection(peerId, protooTransport);
		});
	}
}
