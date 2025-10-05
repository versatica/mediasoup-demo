import express from 'express';
import type * as expressTypes from 'express';
import * as bodyParser from 'body-parser';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { Room } from './Room';
import { UnauthorizedError, RoomNotFound, PeerNotFound } from './errors';
import type { RoomId } from './types';

const logger = new Logger('ApiServer');

type ApiServerConstructorOptions = {
	expressApp: expressTypes.Express;
};

export type ApiServerEvents = {
	/**
	 * Emitted to get an existing Room.
	 */
	'get-room': [
		{ roomId: RoomId },
		callback: (room: Room) => void,
		errback: (error: Error) => void,
	];
};

interface ApiServerExpressRequest extends expressTypes.Request {
	room?: Room;
}

export class ApiServer extends EnhancedEventEmitter<ApiServerEvents> {
	readonly #expressApp: expressTypes.Express;

	static create(): ApiServer {
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
		this.#expressApp.set('trust proxy', true);

		this.#expressApp.use(bodyParser.json());

		/**
		 * Middleware to log success responses.
		 */
		this.#expressApp.use((req: ApiServerExpressRequest, res, next) => {
			res.on('finish', () => {
				if (res.statusCode >= 200 && res.statusCode < 300) {
					logger.debug(
						`request succeed '${req.method} ${req.originalUrl}' => ${res.statusCode}`
					);
				}
			});

			next();
		});

		/**
		 * For every API request, obtain or create a Room with the given `roomId`.
		 */
		this.#expressApp.param(
			'roomId',
			(req: ApiServerExpressRequest, res, next, roomId) => {
				this.emit(
					'get-room',
					{ roomId },
					room => {
						req.room = room;

						next();
					},
					error => {
						next(error);
					}
				);
			}
		);

		/**
		 * API GET resource that returns the mediasoup Router RTP capabilities of
		 * the Room.
		 */
		this.#expressApp.get(
			'/rooms/:roomId',
			async (req: ApiServerExpressRequest, res, next) => {
				try {
					const responseData = await req.room!.processApiRequestToRoom(
						'getRouterRtpCapabilities'
					);

					res.status(200).json(responseData);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to create a BroadcasterPeer.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters',
			async (req: ApiServerExpressRequest, res, next) => {
				try {
					const { peerId, displayName, device, rtpCapabilities } = req.body;
					const responseData = await req.room!.processApiRequestToRoom(
						'createBroadcasterPeer',
						{
							peerId,
							remoteAddress: req.ip ?? req.ips[0]!,
							displayName,
							device,
							rtpCapabilities,
						}
					);

					res.status(200).json(responseData);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * DELETE API to close a BroadcasterPeer.
		 */
		this.#expressApp.delete(
			'/rooms/:roomId/broadcasters/:peerId',
			async (req: ApiServerExpressRequest, res, next) => {
				const { peerId } = req.params;

				try {
					await req.room!.processApiRequestToBroadcasterPeer(peerId!, 'close');

					res.status(200).send('broadcaster deleted');
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to create a mediasoup PlainTransport associated to a
		 * BroadcasterPeer.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:peerId/transports',
			async (req: ApiServerExpressRequest, res, next) => {
				const { peerId } = req.params;
				const { direction, comedia, rtcpMux } = req.body;

				try {
					const responseData =
						await req.room!.processApiRequestToBroadcasterPeer(
							peerId!,
							'createPlainTransport',
							{
								comedia,
								rtcpMux,
								appData: {
									direction,
								},
							}
						);

					res.status(200).send(responseData);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to connect a PlainTransport belonging to a BroadcasterPeer. Not
		 * needed if it was created with `comedia` option.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:peerId/transports/:transportId/connect',
			async (req: ApiServerExpressRequest, res, next) => {
				const { peerId, transportId } = req.params;
				const { dtlsParameters, ip, port, rtcpPort } = req.body;

				try {
					// TODO
					// const data = await req.room!.connectBroadcasterTransport({
					// 	peerId,
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
		 * POST API to create a mediasoup Producer associated to a BroadcasterPeer.
		 * The exact Transport in which the Producer must be created is signaled in
		 * the URL path. Body parameters include kind and rtpParameters of the
		 * Producer.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:peerId/transports/:transportId/producers',
			async (req: ApiServerExpressRequest, res, next) => {
				const { peerId, transportId } = req.params;
				const { kind, rtpParameters } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcasterProducer({
					// 	peerId,
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
		 * POST API to create a mediasoup Consumer associated to a BroadcasterPeer.
		 * The exact Transport in which the Consumer must be created is signaled in
		 * the URL path. Query parameters must include the desired producerId to
		 * consume.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:peerId/transports/:transportId/consume',
			async (req: ApiServerExpressRequest, res, next) => {
				const { peerId, transportId } = req.params;
				const { producerId, paused, rtpCapabilities } = req.body;

				try {
					// TODO
					// const data = await req.room!.createBroadcasterConsumer({
					// 	peerId,
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
		 * POST API to resume a mediasoup Consumer associated to a BroadcasterPeer.
		 * The exact Transport in which the Consumer must be created is signaled in
		 * the URL path. Body parameters must include the desired consumerId to
		 * resume.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:peerId/transports/:transportId/resume',
			// eslint-disable-next-line @typescript-eslint/require-await
			async (req: ApiServerExpressRequest, res, next) => {
				const { peerId, transportId } = req.params;
				const { consumerId } = req.body;

				try {
					// TODO
					// const data = await req.room!.resumeBroadcasterConsumer(
					// 	{
					// 		peerId,
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
		 * Error handler and middleware to log error responses.
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
					let status: number;
					let logErrorStack = false;

					if (
						error instanceof RoomNotFound ||
						error instanceof UnauthorizedError ||
						error instanceof PeerNotFound
					) {
						status = error.status;
					} else if (error instanceof TypeError) {
						status = 400;
						logErrorStack = true;
					} else {
						status = 500;
						logErrorStack = true;
					}

					res.statusMessage = error.message;
					res.status(status).send(String(error));

					if (logErrorStack) {
						logger.warn(
							`request failed '${req.method} ${req.originalUrl}' => ${res.statusCode}`,
							error
						);
					} else {
						logger.warn(
							`request failed '${req.method} ${req.originalUrl}' => ${res.statusCode} ${error}`
						);
					}
				} else {
					next();
				}
			}
		);
	}
}
