import express from 'express';
import type * as expressTypes from 'express';
import * as bodyParser from 'body-parser';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Room } from './Room';
import type { RoomId } from './types';

const logger = new Logger('ApiServer');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type ApiServerCreateOptions = {};

type ApiServerConstructorOptions = {
	expressApp: expressTypes.Express;
};

export type ApiServerEvents = {
	/**
	 * Emitted to obtain a Room.
	 */
	'get-room': [
		{ roomId: RoomId; consumerReplicas: number },
		resolve: (room: Room) => void,
		reject: (error: Error) => void,
	];
};

interface ApiServerExpressRequest extends expressTypes.Request {
	room?: Room;
}

export class ApiServer extends EnhancedEventEmitter<ApiServerEvents> {
	readonly #expressApp: expressTypes.Express;

	static create({}: ApiServerCreateOptions): ApiServer {
		logger.debug('create()');

		const expressApp = ApiServer.createExpressApp();
		const apiServer = new ApiServer({ expressApp });

		return apiServer;
	}

	private static createExpressApp(): expressTypes.Express {
		logger.debug('createExpressApp()');

		const expressApp = express();

		return expressApp;
	}

	private constructor({ expressApp }: ApiServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#expressApp = expressApp;

		this.handleExpressApp();
	}

	getApp(): expressTypes.Express {
		return this.#expressApp;
	}

	private handleExpressApp(): void {
		this.#expressApp.use(bodyParser.json());

		/**
		 * For every API request, obtain or create a Room with the given `roomId`.
		 */
		this.#expressApp.param(
			'roomId',
			async (req: ApiServerExpressRequest, res, next, roomId) => {
				try {
					req.room = await new Promise<Room>((resolve, reject) => {
						this.emit(
							'get-room',
							{ roomId, consumerReplicas: 0 },
							resolve,
							reject
						);
					});

					next();
				} catch (error) {
					logger.error('Room creation or Room joining failed:', error);

					next(error);
				}
			}
		);

		/**
		 * API GET resource that returns the mediasoup Router RTP capabilities of
		 * the Room.
		 */
		this.#expressApp.get(
			'/rooms/:roomId/routerRtpCapabilities',
			(req: ApiServerExpressRequest, res) => {
				const data = req.room!.getRouterRtpCapabilities();

				res.status(200).json(data);
			}
		);

		/**
		 * POST API to create a Broadcaster.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { id, displayName, device, rtpCapabilities } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcaster({
					// 	id,
					// 	displayName,
					// 	device,
					// 	rtpCapabilities,
					// });
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * DELETE API to delete a Broadcaster.
		 */
		this.#expressApp.delete(
			'/rooms/:roomId/broadcasters/:broadcasterId',
			(req: ApiServerExpressRequest, res) => {
				const { broadcasterId } = req.params;

				// TODO
				// req.room!.deleteBroadcaster({ broadcasterId });

				res.status(200).send('broadcaster deleted');
			}
		);

		/**
		 * POST API to create a mediasoup Transport associated to a Broadcaster.
		 * It can be a PlainTransport or a WebRtcTransport depending on the
		 * type parameters in the body. There are also additional parameters for
		 * PlainTransport.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId } = req.params;
				const { type, rtcpMux, comedia, sctpCapabilities } = req.body;

				try {
					// TODO
					// const data = await req.room.createBroadcasterTransport({
					// 	broadcasterId,
					// 	type,
					// 	rtcpMux,
					// 	comedia,
					// 	sctpCapabilities,
					// });
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to connect a Transport belonging to a Broadcaster. Not needed
		 * for PlainTransport if it was created with comedia option set to true.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/connect',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId, transportId } = req.params;
				const { dtlsParameters, ip, port, rtcpPort } = req.body;

				try {
					// TODO
					// const data = await req.room!.connectBroadcasterTransport({
					// 	broadcasterId,
					// 	transportId,
					// 	dtlsParameters,
					// 	ip,
					// 	port,
					// 	rtcpPort,
					// });
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to create a mediasoup Producer associated to a Broadcaster.
		 * The exact Transport in which the Producer must be created is signaled in
		 * the URL path. Body parameters include kind and rtpParameters of the
		 * Producer.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/producers',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId, transportId } = req.params;
				const { kind, rtpParameters } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcasterProducer({
					// 	broadcasterId,
					// 	transportId,
					// 	kind,
					// 	rtpParameters,
					// });
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to create a mediasoup Consumer associated to a Broadcaster.
		 * The exact Transport in which the Consumer must be created is signaled in
		 * the URL path. Query parameters must include the desired producerId to
		 * consume.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/consume',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId, transportId } = req.params;
				const { producerId, paused, rtpCapabilities } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcasterConsumer({
					// 	broadcasterId,
					// 	transportId,
					// 	producerId,
					// 	paused,
					// 	rtpCapabilities,
					// });
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to resume a mediasoup Consumer associated to a Broadcaster.
		 * The exact Transport in which the Consumer must be created is signaled in
		 * the URL path. Body parameters must include the desired consumerId to
		 * resume.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/resume',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId, transportId } = req.params;
				const { consumerId } = req.body;

				try {
					// TODO
					// const data = await req.room!.resumeBroadcasterConsumer(
					// 	{
					// 		broadcasterId,
					// 		transportId,
					// 		consumerId
					// 	});
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to create a mediasoup DataConsumer associated to a Broadcaster.
		 * The exact Transport in which the DataConsumer must be created is signaled in
		 * the URL path. Query body must include the desired producerId to
		 * consume.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/consume/data',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId, transportId } = req.params;
				const { dataProducerId } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcasterDataConsumer(
					// 	{
					// 		broadcasterId,
					// 		transportId,
					// 		dataProducerId
					// 	});
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to create a mediasoup DataProducer associated to a Broadcaster.
		 * The exact Transport in which the DataProducer must be created is signaled in
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:broadcasterId/transports/:transportId/produce/data',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { broadcasterId, transportId } = req.params;
				const { label, protocol, sctpStreamParameters, appData } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcasterDataProducer(
					// 	{
					// 		broadcasterId,
					// 		transportId,
					// 		label,
					// 		protocol,
					// 		sctpStreamParameters,
					// 		appData
					// 	});
					//
					// res.status(200).json(data);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * Error handler.
		 */
		this.#expressApp.use(
			(
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				error: any,
				req: ApiServerExpressRequest,
				res: expressTypes.Response,
				next: expressTypes.NextFunction
			) => {
				if (error) {
					logger.warn('Express app error:', error);

					error.status =
						error.status ?? (error.name === 'TypeError' ? 400 : 500);

					res.statusMessage = error.message;
					res.status(error.status).send(String(error));
				} else {
					next();
				}
			}
		);
	}
}
