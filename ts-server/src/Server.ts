import * as https from 'node:https';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as url from 'node:url';
import * as mediasoup from 'mediasoup';
import type * as mediasoupTypes from 'mediasoup/types';
import { AwaitQueue } from 'awaitqueue';
import * as protoo from 'protoo-server';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { ApiServer } from './ApiServer';
import { Room } from './Room';
import * as utils from './utils';
import { Config, WorkerAppData } from './types';

const logger = new Logger('Server');

export type ServerCreateOptions = {
	config: Config;
};

type ServerConstructorOptions = {
	config: Config;
};

type MediasoupWorkersAndWebRtcServers = {
	worker: mediasoupTypes.Worker<WorkerAppData>;
	webRtcServer: mediasoupTypes.WebRtcServer;
};

export type ServerEvents = {
	'mediasoup-worker-died': [];
};

export class Server extends EnhancedEventEmitter<ServerEvents> {
	readonly #config: Config;
	/**
	 * Async queue to manage Rooms.
	 */
	readonly #roomsAwaitQueue: AwaitQueue = new AwaitQueue();
	/**
	 * Map of Room instances indexed by id.
	 */
	readonly #rooms: Map<string, Room> = new Map();
	/**
	 * HTTPS server.
	 */
	// #httpsServer: https.Server;
	/**
	 * API server.
	 */
	readonly #apiServer: ApiServer;
	/**
	 * Protoo WebSocket server.
	 */
	// #protooWebSocketServer;
	/**
	 * Map of mediasoup Workers and WebRtcServers indexed by index.
	 */
	readonly #mediasoupWorkersAndWebRtcServers: Map<
		number,
		MediasoupWorkersAndWebRtcServers
	> = new Map();
	/**
	 * Index of next mediasoup Worker to use.
	 */
	#nextMediasoupWorkerIdx: number = 0;

	static async create({ config }: ServerCreateOptions): Promise<Server> {
		logger.debug('create()');

		const server = new Server({ config });

		await server.run();

		return server;
	}

	private constructor({ config }: ServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#config = config;
	}

	close(): void {
		logger.debug('close()');

		this.#roomsAwaitQueue.stop();

		// TODO
		// for (const room of this.#rooms) {
		// 	room.close();
		// }

		for (const { worker } of this.#mediasoupWorkersAndWebRtcServers.values()) {
			worker.close();
		}
	}

	private async run(): Promise<void> {
		// Start mediasoup Workers.
		await this.createMediasoupWorkersAndWebRtcServers();

		// Create API server.
		this.#apiServer = await ApiServer.create({});
	}

	private async createMediasoupWorkersAndWebRtcServers(): Promise<void> {
		logger.debug('createMediasoupWorkersAndWebRtcServers()');

		const { numWorkers, workerSettings, webRtcServerOptions } =
			this.#config.mediasoup;

		logger.info(
			'createMediasoupWorkersAndWebRtcServers() | running %d mediasoup Workers...',
			numWorkers
		);

		for (let idx = 0; idx < numWorkers; ++idx) {
			const worker = await mediasoup.createWorker<WorkerAppData>({
				dtlsCertificateFile: workerSettings.dtlsCertificateFile,
				dtlsPrivateKeyFile: workerSettings.dtlsPrivateKeyFile,
				logLevel: workerSettings.logLevel,
				logTags: workerSettings.logTags,
				disableLiburing: workerSettings.disableLiburing,
				appData: {
					idx,
				},
			});

			// Create a WebRtcServer in this Worker.
			// Each mediasoup Worker will run its own WebRtcServer, so those cannot
			// share the same listening ports. Hence we increase the value in config.js
			// for each Worker.
			const clonnedWebRtcServerOptions = utils.clone(webRtcServerOptions);
			const portIncrement = this.#mediasoupWorkersAndWebRtcServers.size - 1;

			for (const listenInfo of clonnedWebRtcServerOptions.listenInfos) {
				listenInfo.port! += portIncrement;
			}

			const webRtcServer = await worker.createWebRtcServer(
				clonnedWebRtcServerOptions
			);

			this.#mediasoupWorkersAndWebRtcServers.set(idx, { worker, webRtcServer });

			this.handleMediasoupWorker(worker);
		}
	}

	/**
	 * Get a Room instance (or create one if it does not exist).
	 */
	private async getOrCreateRoom({
		roomId,
		consumerReplicas = 0,
	}: {
		roomId: string;
		consumerReplicas?: number;
	}): Promise<Room> {
		let room = this.#rooms.get(roomId);

		if (room) {
			return room;
		}

		// If the Room does not exist create a new one.
		// Enqueue it to avoid race conditions when multiple users join at the same
		// time.
		return this.#roomsAwaitQueue.push<Room>(async () => {
			logger.info(
				'getOrCreateRoom() | creating a new Room [roomId:%s]',
				roomId
			);

			const { worker: mediasoupWorker, webRtcServer: mediasoupWebRtcServer } =
				this.getNextMediasoupWorkerAndWebRtcServer();

			room = await Room.create({
				roomId,
				consumerReplicas,
				config: this.#config,
				mediasoupWorker,
				mediasoupWebRtcServer,
			});

			this.#rooms.set(roomId, room);

			this.handleRoom(room);

			return room;
		});
	}

	private getNextMediasoupWorkerAndWebRtcServer(): {
		worker: mediasoupTypes.Worker<WorkerAppData>;
		webRtcServer: mediasoupTypes.WebRtcServer;
	} {
		const { worker, webRtcServer } = this.#mediasoupWorkersAndWebRtcServers.get(
			this.#nextMediasoupWorkerIdx
		)!;

		if (
			++this.#nextMediasoupWorkerIdx ===
			this.#mediasoupWorkersAndWebRtcServers.size
		) {
			this.#nextMediasoupWorkerIdx = 0;
		}

		return { worker, webRtcServer };
	}

	private handleMediasoupWorker(
		worker: mediasoupTypes.Worker<WorkerAppData>
	): void {
		worker.on('died', () => {
			logger.error('mediasoup Worker died [pid:%d]', worker.pid);

			this.close();
			this.safeEmit('mediasoup-worker-died');
		});

		worker.observer.on('close', () => {
			this.#mediasoupWorkersAndWebRtcServers.delete(worker.appData.idx);
		});
	}

	private handleRoom(room: Room): void {
		room.on('close', () => {
			this.#rooms.delete(room.id);
		});
	}
}
