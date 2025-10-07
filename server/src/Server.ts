import process from 'node:process';
import * as https from 'node:https';
import * as http from 'node:http';
import * as net from 'node:net';
import * as fs from 'node:fs';
import * as mediasoup from 'mediasoup';
import type * as mediasoupTypes from 'mediasoup/types';
import { AwaitQueue } from 'awaitqueue';
import * as throttle from '@sitespeed.io/throttle';
import type * as throttleTypes from '@sitespeed.io/throttle';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { WsServer } from './WsServer';
import { ApiServer } from './ApiServer';
import { Room } from './Room';
import { InvalidStateError, ForbiddenError, RoomNotFound } from './errors';
import { clone } from './utils';
import type { Config, RoomId, WorkerAppData } from './types';

const logger = new Logger('Server');

export type ServerCreateOptions = {
	config: Config;
	networkThrottleSecret?: string;
};

type ServerConstructorOptions = {
	config: Config;
	mediasoupWorkersAndWebRtcServers: MediasoupWorkersAndWebRtcServers;
	httpServer: https.Server | http.Server;
	wsServer: WsServer;
	apiServer: ApiServer;
	networkThrottleSecret?: string;
};

type MediasoupWorkersAndWebRtcServers = Map<
	number,
	{
		worker: mediasoupTypes.Worker<WorkerAppData>;
		webRtcServer: mediasoupTypes.WebRtcServer;
	}
>;

export type ServerObserverEvents = {
	/**
	 * Emitted when a new Server is created.
	 */
	'new-server': [Server];
};

export type ServerEvents = {
	/**
	 * Emitted when the Server is closed no matter how.
	 */
	closed: [];
	/**
	 * Emitted when Server dies.
	 */
	died: [];
	/**
	 * Emitted when a new Room is created.
	 */
	'new-room': [Room];
};

export class Server extends EnhancedEventEmitter<ServerEvents> {
	public static readonly observer: EnhancedEventEmitter<ServerObserverEvents> =
		new EnhancedEventEmitter();

	readonly #config: Config;
	readonly #roomCreationAwaitQueue: AwaitQueue = new AwaitQueue();
	readonly #rooms: Map<string, Room> = new Map();
	readonly #httpServer: https.Server | http.Server;
	readonly #httpConnections: Set<net.Socket> = new Set();
	readonly #wsServer: WsServer;
	readonly #apiServer: ApiServer;
	readonly #mediasoupWorkersAndWebRtcServers: MediasoupWorkersAndWebRtcServers =
		new Map();
	#nextMediasoupWorkerIdx: number = 0;
	readonly #networkThrottleSecret?: string;
	#networkThrottleEnabled: boolean = false;
	#networkThrottleEnabledByRoomId?: RoomId;
	readonly #networkThrottleAwaitQueue: AwaitQueue = new AwaitQueue();
	#closed: boolean = false;

	static async create({
		config,
		networkThrottleSecret,
	}: ServerCreateOptions): Promise<Server> {
		logger.debug('create()');

		const mediasoupWorkersAndWebRtcServers =
			await Server.createMediasoupWorkersAndWebRtcServers(config);
		const httpServer = await Server.createHttpServer(config);
		const wsServer = WsServer.create({ httpServer });
		const apiServer = ApiServer.create();
		const server = new Server({
			config,
			mediasoupWorkersAndWebRtcServers,
			httpServer,
			wsServer,
			apiServer,
			networkThrottleSecret,
		});

		Server.observer.emit('new-server', server);

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
				`createMediasoupWorkersAndWebRtcServers() | launching ${numWorkers} mediasoup ${numWorkers === 1 ? 'Worker' : 'Workers'}...`
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
				// share the same listening port. Hence we increase the port for each
				// Worker.
				const clonnedWebRtcServerOptions = clone(webRtcServerOptions);
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
			logger.error(
				`createMediasoupWorkersAndWebRtcServers() | failed: ${error}`
			);

			throw error;
		}
	}

	private static async createHttpServer(
		config: Config
	): Promise<https.Server | http.Server> {
		logger.debug('createHttpServer()');

		try {
			const tls = config.http.tls
				? {
						cert: fs.readFileSync(config.http.tls.cert),
						key: fs.readFileSync(config.http.tls.key),
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
					{ port: config.http.listenPort, host: config.http.listenIp },
					resolve
				);

				httpServer.on('error', error => {
					reject(error);
				});
			});

			return httpServer;
		} catch (error) {
			logger.error(`createHttpServer() | failed: ${error}`);

			throw error;
		}
	}

	private constructor({
		config,
		mediasoupWorkersAndWebRtcServers,
		httpServer,
		wsServer,
		apiServer,
		networkThrottleSecret,
	}: ServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#config = config;
		this.#mediasoupWorkersAndWebRtcServers = mediasoupWorkersAndWebRtcServers;
		this.#httpServer = httpServer;
		this.#wsServer = wsServer;
		this.#apiServer = apiServer;
		this.#networkThrottleSecret = networkThrottleSecret;

		// We need to verify that all mediasoup Workers are alive at this point
		// (just in case they died for whatever reason before reaching this
		// constructor).
		for (const { worker } of this.#mediasoupWorkersAndWebRtcServers.values()) {
			if (worker.closed) {
				throw new InvalidStateError(
					`mediasoup Worker is closed [pid:${worker.pid}, died:${worker.died}]`
				);
			}

			this.handleMediasoupWorker(worker);
		}

		this.handleHttpServer();
		this.handleWsServer();
		this.handleApiServer();

		if (this.#networkThrottleSecret) {
			process.env['LOG_THROTTLE'] = 'true';
		}
	}

	close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.#roomCreationAwaitQueue.stop();

		for (const room of this.#rooms.values()) {
			room.close();
		}

		for (const { worker } of this.#mediasoupWorkersAndWebRtcServers.values()) {
			worker.close();
		}

		// Stop listening for HTTP/WS connections.
		this.#httpServer.close();
		this.#httpServer.closeAllConnections();

		// Close all existing HTTP/WS connections.
		for (const httpConnection of this.#httpConnections) {
			httpConnection.destroy();
		}

		if (this.#networkThrottleEnabled) {
			this.stopNetworkThrottleInternal().catch(() => {});
		}

		// NOTE: We don't stop this.#networkThrottleAwaitQueue on purpose.

		this.emit('closed');
	}

	isNetworkThrottleEnabled(): boolean {
		return this.#networkThrottleEnabled;
	}

	/**
	 * Get a Room instance (or create one if it does not exist).
	 */
	private async getOrCreateRoom({
		roomId,
		consumerReplicas = 0,
	}: {
		roomId: RoomId;
		consumerReplicas?: number;
	}): Promise<Room> {
		// Enqueue it to avoid race conditions when multiple users join at the same
		// time requesting the same `roomId`.
		return this.#roomCreationAwaitQueue.push<Room>(async () => {
			let room = this.#rooms.get(roomId);

			if (room) {
				return room;
			}

			logger.info(
				'getOrCreateRoom() | creating a new Room [roomId:%o]',
				roomId
			);

			const { worker: mediasoupWorker, webRtcServer: mediasoupWebRtcServer } =
				this.getNextMediasoupWorkerAndWebRtcServer();
			const { mediaCodecs } = this.#config.mediasoup.routerOptions;
			const mediasoupRouter = await mediasoupWorker.createRouter({
				mediaCodecs,
			});

			room = await Room.create({
				roomId,
				consumerReplicas,
				config: this.#config,
				mediasoupRouter,
				mediasoupWebRtcServer,
			});

			this.#rooms.set(room.id, room);

			this.handleRoom(room);

			this.emit('new-room', room);

			return room;
		}, 'getOrCreateRoom()');
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

	private async applyNetworkThrottle({
		secret,
		options,
	}: {
		secret: string;
		options: throttleTypes.ThrottleStartOptions;
	}): Promise<void> {
		logger.debug('applyNetworkThrottle() [options:%o]', options);

		if (
			!this.#networkThrottleSecret ||
			!secret ||
			secret !== this.#networkThrottleSecret
		) {
			throw new ForbiddenError('GO TO HELL 🖕🏼');
		}

		await this.applyNetworkThrottleInternal(options);
	}

	private async stopNetworkThrottle({
		secret,
	}: {
		secret: string;
	}): Promise<void> {
		logger.debug('stopNetworkThrottle()');

		if (
			!this.#networkThrottleSecret ||
			!secret ||
			secret !== this.#networkThrottleSecret
		) {
			throw new ForbiddenError('GO TO HELL 🖕🏼');
		}

		await this.stopNetworkThrottleInternal();
	}

	private async applyNetworkThrottleInternal(
		options: throttleTypes.ThrottleStartOptions
	): Promise<void> {
		// Enqueue it to avoid race conditions when calling multiple times to
		// throttle API.
		return this.#networkThrottleAwaitQueue.push(async () => {
			logger.debug('applyNetworkThrottleInternal() [options:%o]', options);

			if (this.#networkThrottleEnabled) {
				await this.stopNetworkThrottleInternal();
			}

			try {
				await throttle.start(options);
			} catch (error) {
				logger.error(
					'applyNetworkThrottleInternal() | throttle.start() failed [options:%o]:',
					options,
					error
				);

				throw error;
			}

			logger.info(
				'applyNetworkThrottleInternal() | network throttle applied [options:%o]',
				options
			);

			this.#networkThrottleEnabled = true;
		}, 'applyNetworkThrottleInternal()');
	}

	private async stopNetworkThrottleInternal(): Promise<void> {
		// Enqueue it to avoid race conditions when calling multiple times to
		// throttle API.
		return this.#networkThrottleAwaitQueue.push(async () => {
			logger.debug('stopNetworkThrottleInternal()');

			// Let's be optimistic.
			const savedNetworkThrottleEnabled = this.#networkThrottleEnabled;
			const savedNetworkThrottleEnabledByRoomId =
				this.#networkThrottleEnabledByRoomId;

			this.#networkThrottleEnabled = false;
			this.#networkThrottleEnabledByRoomId = undefined;

			let stopError: Error | undefined = undefined;

			try {
				await throttle.stop();
			} catch (error) {
				logger.error(
					'stopNetworkThrottleInternal() | throttle.stop() failed:',
					error
				);

				stopError = error as Error;
			}

			try {
				await throttle.stop({ localhost: true });
			} catch (error) {
				logger.error(
					'stopNetworkThrottleInternal() | throttle.stop({ localhost: true }) failed:',
					error
				);

				stopError = error as Error;
			}

			if (stopError) {
				this.#networkThrottleEnabled = savedNetworkThrottleEnabled;
				this.#networkThrottleEnabledByRoomId =
					savedNetworkThrottleEnabledByRoomId;

				throw stopError;
			}

			logger.info('stopNetworkThrottleInternal() | network throttle stopped');
		}, 'stopNetworkThrottleInternal()');
	}

	private handleMediasoupWorker(
		worker: mediasoupTypes.Worker<WorkerAppData>
	): void {
		worker.on('died', () => {
			logger.error('mediasoup Worker died [pid:%o]', worker.pid);

			this.close();
			this.emit('died');
		});

		worker.observer.on('close', () => {
			this.#mediasoupWorkersAndWebRtcServers.delete(worker.appData.idx);

			// Ignore if Server is closed or if the Worker died since then its 'died'
			// event fired already.
			if (this.#closed || worker.died) {
				return;
			}

			logger.error('mediasoup Worker unexpectedly closed [pid:%o]', worker.pid);

			this.close();
			this.emit('died');
		});
	}

	private handleHttpServer(): void {
		// Let's keep a list with the HTTP connections (including WebSocket
		// upgrades) to later be able to close them all.
		this.#httpServer.on('connection', (httpConnection: net.Socket) => {
			this.#httpConnections.add(httpConnection);

			httpConnection.on('close', () => {
				this.#httpConnections.delete(httpConnection);
			});
		});

		this.#httpServer.on('request', this.#apiServer.getApp());
	}

	private handleWsServer(): void {
		this.#wsServer.on(
			'get-or-create-room',
			({ roomId, consumerReplicas }, resolve, reject) => {
				this.getOrCreateRoom({ roomId, consumerReplicas })
					.then(resolve)
					.catch(reject);
			}
		);
	}

	private handleApiServer(): void {
		this.#apiServer.on('get-room', ({ roomId }, callback, errback) => {
			const room = this.#rooms.get(roomId);

			if (room) {
				callback(room);
			} else {
				errback(new RoomNotFound(`room '${roomId}' doesn't exist`));
			}
		});
	}

	private handleRoom(room: Room): void {
		room.on('closed', () => {
			this.#rooms.delete(room.id);

			if (room.id === this.#networkThrottleEnabledByRoomId) {
				logger.info(
					'the Room that applied network throttle closed, stopping network throttle...'
				);

				this.stopNetworkThrottleInternal().catch(() => {});
			}

			this.#networkThrottleEnabledByRoomId = undefined;
		});

		room.on(
			'apply-network-throttle',
			({ secret, options }, resolve, reject) => {
				this.applyNetworkThrottle({ secret, options })
					.then(() => {
						this.#networkThrottleEnabledByRoomId = room.id;

						resolve();
					})
					.catch(reject);
			}
		);

		room.on('stop-network-throttle', ({ secret }, resolve, reject) => {
			this.stopNetworkThrottle({ secret }).then(resolve).catch(reject);
		});
	}
}
