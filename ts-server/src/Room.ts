import * as mediasoupTypes from 'mediasoup/types';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Config, WorkerAppData } from './types';

const logger = new Logger('Room');

export type RoomCreateOptions = {
	roomId: string;
	consumerReplicas: number;
	config: Config;
	mediasoupWorker: mediasoupTypes.Worker<WorkerAppData>;
	mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
};

type RoomConstructorOptions = {
	roomId: string;
	consumerReplicas: number;
	mediasoupRouter: mediasoupTypes.Router;
	mediasoupWebRtcServer: mediasoupTypes.WebRtcServer;
};

export type RoomEvents = {
	close: [];
};

export class Room extends EnhancedEventEmitter<RoomEvents> {
	readonly #id: string;
	readonly #consumerReplicas: number;
	readonly #mediasoupRouter: mediasoupTypes.Router;

	static async create({
		roomId,
		consumerReplicas,
		config,
		mediasoupWorker,
		mediasoupWebRtcServer,
	}: RoomCreateOptions): Promise<Room> {
		logger.debug('create() [roomId:%o]', roomId);

		const { mediaCodecs } = config.mediasoup.routerOptions;

		const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs });
		const room = new Room({
			roomId,
			consumerReplicas,
			mediasoupRouter,
			mediasoupWebRtcServer,
		});

		return room;
	}

	private constructor({
		roomId,
		consumerReplicas,
		mediasoupRouter,
	}: RoomConstructorOptions) {
		super();

		logger.debug(
			'constructor() [roomId:%o, consumerReplicas:%o]',
			roomId,
			consumerReplicas
		);

		this.#id = roomId;
		this.#consumerReplicas = consumerReplicas;
		this.#mediasoupRouter = mediasoupRouter;
	}

	get id(): string {
		return this.#id;
	}

	close(): void {
		logger.debug('close()');

		// TODO
	}

	getRouterRtpCapabilities(): mediasoupTypes.RouterRtpCapabilities {
		return this.#mediasoupRouter.rtpCapabilities;
	}
}
