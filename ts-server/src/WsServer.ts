import * as https from 'node:https';
import * as http from 'node:http';
import * as url from 'node:url';
import * as protoo from 'protoo-server';
import type * as protooTypes from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Room } from './Room';

const logger = new Logger('WsServer');

export type WsServerCreateOptions = {
	httpServer: https.Server | http.Server;
};

type WsServerConstructorOptions = {
	protooServer: protooTypes.WebSocketServer;
};

export type WsServerEvents = {
	'get-room': [
		{ roomId: string; consumerReplicas: number },
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
		roomId: string;
		consumerReplicas: number;
	}): Promise<Room> {
		return new Promise<Room>((resolve, reject) => {
			this.emit('get-room', { roomId, consumerReplicas }, resolve, reject);
		});
	}

	private handleProtooServer(): void {
		this.#protooServer.on('connectionrequest', (info, accept, reject) => {
			if (!info.request.url) {
				reject(400, 'missing URL in the request');

				return;
			}

			// The client indicates the roomId and peerId in the URL query.
			const u = url.parse(info.request.url, true);
			const roomId = u.query['roomId'];
			const peerId = u.query['peerId'];

			if (!roomId || !peerId) {
				reject(400, 'Connection request without roomId and/or peerId');

				return;
			}

			// TODO: More.
		});
	}
}
