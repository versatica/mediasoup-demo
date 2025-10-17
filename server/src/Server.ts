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
import type {
	ServerConfig,
	RoomId,
	SerializedServer,
	WorkerAppData,
} from './types';

const logger = new Logger('Server');

export type ServerCreateOptions = {
	config: ServerConfig;
	networkThrottleSecret?: string;
};

type ServerConstructorOptions = {
	config: ServerConfig;
	workersAndWebRtcServers: WorkersAndWebRtcServers;
	httpServer: https.Server | http.Server;
	wsServer: WsServer;
	apiServer: ApiServer;
	networkThrottleSecret?: string;
};

type WorkersAndWebRtcServers = Map<
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

	readonly #config: ServerConfig;
	readonly #roomCreationAwaitQueue: AwaitQueue = new AwaitQueue();
	readonly #rooms: Map<string, Room> = new Map();
	readonly #httpServer: https.Server | http.Server;
	readonly #httpConnections: Set<net.Socket> = new Set();
	readonly #wsServer: WsServer;
	readonly #apiServer: ApiServer;
	readonly #workersAndWebRtcServers: WorkersAndWebRtcServers = new Map();
	#nextWorkerIdx: number = 0;
	readonly #networkThrottleSecret?: string;
	#networkThrottleEnabled: boolean = false;
	#networkThrottleEnabledByRoomId?: RoomId;
	readonly #networkThrottleAwaitQueue: AwaitQueue = new AwaitQueue();
	readonly #createdAt: Date;
	#closed: boolean = false;

	static async create({
		config,
		networkThrottleSecret,
	}: ServerCreateOptions): Promise<Server> {
		logger.debug('create()');

		const httpOriginHeader = Server.computeHttpOriginHeader(config);
		const workersAndWebRtcServers =
			await Server.createWorkersAndWebRtcServers(config);
		const httpServer = await Server.createHttpServer(config);
		const wsServer = WsServer.create({ httpServer, httpOriginHeader });
		const apiServer = ApiServer.create({ httpOriginHeader });
		const server = new Server({
			config,
			workersAndWebRtcServers,
			httpServer,
			wsServer,
			apiServer,
			networkThrottleSecret,
		});

		Server.observer.emit('new-server', server);

		return server;
	}

	private static computeHttpOriginHeader(config: ServerConfig): string {
		const schema = config.http.tls ? 'https' : 'http';
		const domain = config.domain;
		const port = config.http.listenPort;
		const httpOriginHeader = `${schema}://${domain}:${port}`;

		logger.info(
			'computeHttpOriginHeader() | computed HTTP Origin header: %o',
			httpOriginHeader
		);

		return httpOriginHeader;
	}

	private static async createWorkersAndWebRtcServers(
		config: ServerConfig
	): Promise<WorkersAndWebRtcServers> {
		logger.debug('createWorkersAndWebRtcServers()');

		try {
			const workersAndWebRtcServers: WorkersAndWebRtcServers = new Map();
			const { numWorkers, workerSettings, webRtcServerOptions } =
				config.mediasoup;

			logger.info(
				`createWorkersAndWebRtcServers() | launching ${numWorkers} mediasoup ${numWorkers === 1 ? 'Worker' : 'Workers'}...`
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
				const portIncrement = workersAndWebRtcServers.size - 1;

				for (const listenInfo of clonnedWebRtcServerOptions.listenInfos) {
					listenInfo.port! += portIncrement;
				}

				const webRtcServer = await worker.createWebRtcServer(
					clonnedWebRtcServerOptions
				);

				workersAndWebRtcServers.set(idx, { worker, webRtcServer });
			}

			return workersAndWebRtcServers;
		} catch (error) {
			logger.error(`createWorkersAndWebRtcServers() | failed: ${error}`);

			throw error;
		}
	}

	private static async createHttpServer(
		config: ServerConfig
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
		workersAndWebRtcServers,
		httpServer,
		wsServer,
		apiServer,
		networkThrottleSecret,
	}: ServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#config = config;
		this.#workersAndWebRtcServers = workersAndWebRtcServers;
		this.#httpServer = httpServer;
		this.#wsServer = wsServer;
		this.#apiServer = apiServer;
		this.#networkThrottleSecret = networkThrottleSecret;
		this.#createdAt = new Date();

		// We need to verify that all mediasoup Workers are alive at this point
		// (just in case they died for whatever reason before reaching this
		// constructor).
		for (const { worker } of this.#workersAndWebRtcServers.values()) {
			if (worker.closed) {
				throw new InvalidStateError(
					`mediasoup Worker is closed [pid:${worker.pid}, died:${worker.died}]`
				);
			}

			this.handleWorker(worker);
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

		for (const { worker } of this.#workersAndWebRtcServers.values()) {
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

	serialize(): SerializedServer {
		return {
			createdAt: this.#createdAt,
			numWorkers: this.#workersAndWebRtcServers.size,
			networkThrottleEnabled: this.#networkThrottleEnabled,
			numRooms: this.#rooms.size,
			rooms: Array.from(this.#rooms.values()).map(room => room.serialize()),
		};
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
		usePipeTransports = false,
	}: {
		roomId: RoomId;
		consumerReplicas?: number;
		usePipeTransports?: boolean;
	}): Promise<Room> {
		if (usePipeTransports && this.#config.mediasoup.numWorkers < 2) {
			throw new InvalidStateError(
				'at least 2 mediasoup Workers are needed to create a Room with usePipeTransports option'
			);
		}

		// Enqueue it to avoid race conditions when multiple users join at the same
		// time requesting the same `roomId`.
		return this.#roomCreationAwaitQueue.push<Room>(async () => {
			let room = this.#rooms.get(roomId);

			if (room) {
				return room;
			}

			logger.info(
				'getOrCreateRoom() | creating a new Room [roomId:%o, usePipeTransports:%o]',
				roomId,
				usePipeTransports
			);

			const { worker: producerWorker, webRtcServer: producerWebRtcServer } =
				this.getNextWorkerAndWebRtcServer();

			const { worker: consumerWorker, webRtcServer: consumerWebRtcServer } =
				usePipeTransports
					? this.getNextWorkerAndWebRtcServer()
					: {
							worker: producerWorker,
							webRtcServer: producerWebRtcServer,
						};

			const { mediaCodecs } = this.#config.mediasoup.routerOptions;

			const producerRouter = await producerWorker.createRouter({
				mediaCodecs,
			});

			const consumerRouter = usePipeTransports
				? await consumerWorker.createRouter({
						mediaCodecs,
					})
				: producerRouter;

			room = await Room.create({
				roomId,
				consumerReplicas,
				usePipeTransports,
				config: this.#config,
				producerRouter,
				consumerRouter,
				producerWebRtcServer,
				consumerWebRtcServer,
			});

			this.#rooms.set(room.id, room);

			this.handleRoom(room);

			this.emit('new-room', room);

			return room;
		}, 'getOrCreateRoom()');
	}

	private getNextWorkerAndWebRtcServer(): {
		worker: mediasoupTypes.Worker<WorkerAppData>;
		webRtcServer: mediasoupTypes.WebRtcServer;
	} {
		const { worker, webRtcServer } = this.#workersAndWebRtcServers.get(
			this.#nextWorkerIdx
		)!;

		if (++this.#nextWorkerIdx === this.#workersAndWebRtcServers.size) {
			this.#nextWorkerIdx = 0;
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

	private handleWorker(worker: mediasoupTypes.Worker<WorkerAppData>): void {
		worker.on('died', () => {
			logger.error('mediasoup Worker died [pid:%o]', worker.pid);

			this.close();
			this.emit('died');
		});

		worker.observer.on('close', () => {
			this.#workersAndWebRtcServers.delete(worker.appData.idx);

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
			({ roomId, consumerReplicas, usePipeTransports }, resolve, reject) => {
				this.getOrCreateRoom({ roomId, consumerReplicas, usePipeTransports })
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
				errback(new RoomNotFound(`Room '${roomId}' doesn't exist`));
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
