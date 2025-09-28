import * as express from 'express';
import type * as expressTypes from 'express';
import * as bodyParser from 'body-parser';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Room } from './Room';

const logger = new Logger('ApiServer');

export type ApiServerCreateOptions = {
	getOrCreateRoom: GetOrCreateRoom;
};

// TODO
export type ApiServerEvents = {};

type ApiServerConstructorOptions = {
	getOrCreateRoom: GetOrCreateRoom;
};

type GetOrCreateRoom = ({
	roomId,
	consumerReplicas,
}: {
	roomId: string;
	consumerReplicas?: number;
}) => Promise<Room>;

interface ExpressRequest extends expressTypes.Request {
	room?: Room;
}

export class ApiServer extends EnhancedEventEmitter<ApiServerEvents> {
	readonly #getOrCreateRoom: GetOrCreateRoom;
	readonly #expressApp: express.Express;

	static async create({
		getOrCreateRoom,
	}: ApiServerCreateOptions): Promise<ApiServer> {
		logger.debug('create()');

		const apiServer = new ApiServer({ getOrCreateRoom });

		return apiServer;
	}

	private constructor({ getOrCreateRoom }: ApiServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#getOrCreateRoom = getOrCreateRoom;
		this.#expressApp = express();

		this.#expressApp.use(bodyParser.json());

		/**
		 * For every API request, verify that the roomId in the path matches and
		 * existing room.
		 */
		this.#expressApp.param(
			'roomId',
			async (req: ExpressRequest, res, next, roomId) => {
				try {
					req.room = await this.#getOrCreateRoom({
						roomId,
						consumerReplicas: 0,
					});

					next();
				} catch (error) {
					logger.error(
						'room creation or room joining via broadcaster failed:%o',
						error
					);

					next(error);
				}
			}
		);
	}
}
