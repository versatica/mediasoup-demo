import * as https from 'node:https';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as mediasoup from 'mediasoup';
import type * as mediasoupTypes from 'mediasoup/types';
import { AwaitQueue } from 'awaitqueue';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { WsServer } from './WsServer';
import { ApiServer } from './ApiServer';
import { Room } from './Room';
import { InvalidStateError } from './errors';
import * as utils from './utils';
import { Config, WorkerAppData } from './types';

const logger = new Logger('Server');

export type ServerCreateOptions = {
	config: Config;
};

type ServerConstructorOptions = {
	config: Config;
	mediasoupWorkersAndWebRtcServers: MediasoupWorkersAndWebRtcServers;
	httpServer: https.Server | http.Server;
	wsServer: WsServer;
	apiServer: ApiServer;
};

type MediasoupWorkersAndWebRtcServers = Map<
	number,
	{
		worker: mediasoupTypes.Worker<WorkerAppData>;
		webRtcServer: mediasoupTypes.WebRtcServer;
	}
>;

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
	 * HTTPS or HTTP server.
	 */
	readonly #httpServer: https.Server | http.Server;
	/**
	 * WebSocket server.
	 */
	readonly #wsServer: WsServer;
	/**
	 * API server.
	 */
	readonly #apiServer: ApiServer;
	/**
	 * Map of mediasoup Workers and WebRtcServers indexed by index.
	 */
	readonly #mediasoupWorkersAndWebRtcServers: MediasoupWorkersAndWebRtcServers =
		new Map();
	/**
	 * Index of next mediasoup Worker to use.
	 */
	#nextMediasoupWorkerIdx: number = 0;

	static async create({ config }: ServerCreateOptions): Promise<Server> {
		logger.debug('create()');

		const mediasoupWorkersAndWebRtcServers =
			await Server.createMediasoupWorkersAndWebRtcServers(config);
		const httpServer = await Server.createHttpServer(config);
		const wsServer = await WsServer.create({ httpServer });
		const apiServer = await ApiServer.create({});
		const server = new Server({
			config,
			mediasoupWorkersAndWebRtcServers,
			httpServer,
			wsServer,
			apiServer,
		});

		return server;
	}

	private static async createMediasoupWorkersAndWebRtcServers(
		config: Config
	): Promise<MediasoupWorkersAndWebRtcServers> {
		logger.debug('createMediasoupWorkersAndWebRtcServers()');

		try {
			const mediasoupWorkersAndWebRtcServers: MediasoupWorkersAndWebRtcServers =
				new Map();
			const { numWorkers, workerSettings, webRtcServerOptions } =
				config.mediasoup;

			logger.info(
				'createMediasoupWorkersAndWebRtcServers() | launching %d mediasoup Workers...',
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
				const portIncrement = mediasoupWorkersAndWebRtcServers.size - 1;

				for (const listenInfo of clonnedWebRtcServerOptions.listenInfos) {
					listenInfo.port! += portIncrement;
				}

				const webRtcServer = await worker.createWebRtcServer(
					clonnedWebRtcServerOptions
				);

				mediasoupWorkersAndWebRtcServers.set(idx, { worker, webRtcServer });
			}

			return mediasoupWorkersAndWebRtcServers;
		} catch (error) {
			logger.error('createMediasoupWorkersAndWebRtcServers() | failed:', error);

			throw error;
		}
	}

	private static async createHttpServer(
		config: Config
	): Promise<https.Server | http.Server> {
		logger.debug('createHttpServer()');

		try {
			const tls = config.https.tls
				? {
						cert: fs.readFileSync(config.https.tls.cert),
						key: fs.readFileSync(config.https.tls.key),
					}
				: undefined;

			if (!tls) {
				logger.debug(
					'createHttpServer() | no TLS provided in the configuration, fallback to HTTP server'
				);
			}

			const httpServer = tls ? https.createServer(tls) : http.createServer();

			await new Promise<void>((resolve, reject) => {
				httpServer.listen(
					{ port: config.https.listenPort, host: config.https.listenIp },
					resolve
				);

				httpServer.on('error', error => {
					reject(error);
				});
			});

			return httpServer;
		} catch (error) {
			logger.error('createHttpServer() | failed:', error);

			throw error;
		}
	}

	private constructor({
		config,
		mediasoupWorkersAndWebRtcServers,
		httpServer,
		wsServer,
		apiServer,
	}: ServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#config = config;
		this.#mediasoupWorkersAndWebRtcServers = mediasoupWorkersAndWebRtcServers;
		this.#httpServer = httpServer;
		this.#wsServer = wsServer;
		this.#apiServer = apiServer;

		// We need to verify that all mediasoup Workers are alive at this point
		// (just in case they died for whatever reason before reaching this
		// constructor).
		for (const { worker } of this.#mediasoupWorkersAndWebRtcServers.values()) {
			if (worker.closed) {
				throw new InvalidStateError(
					`mediasoup worker is closed [pid:${worker.pid}, died:${worker.died ? 'true' : 'false'}]`
				);
			}

			this.handleMediasoupWorker(worker);
		}

		this.handleHttpServer();
		this.handleWsServer();
		this.handleApiServer();
	}

	close(): void {
		logger.debug('close()');

		this.#roomsAwaitQueue.stop();

		for (const room of this.#rooms.values()) {
			room.close();
		}

		for (const { worker } of this.#mediasoupWorkersAndWebRtcServers.values()) {
			worker.close();
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

	private handleHttpServer(): void {
		this.#httpServer.on('request', this.#apiServer.getExpressApp());
	}

	private handleWsServer(): void {
		this.#wsServer.on(
			'get-room',
			({ roomId, consumerReplicas }, resolve, reject) => {
				this.getOrCreateRoom({ roomId, consumerReplicas })
					.then(room => resolve(room))
					.catch(error => reject(error));
			}
		);
	}

	private handleApiServer(): void {
		this.#apiServer.on(
			'get-room',
			({ roomId, consumerReplicas }, resolve, reject) => {
				this.getOrCreateRoom({ roomId, consumerReplicas })
					.then(room => resolve(room))
					.catch(error => reject(error));
			}
		);
	}

	private handleRoom(room: Room): void {
		room.on('close', () => {
			this.#rooms.delete(room.id);
		});
	}
}
