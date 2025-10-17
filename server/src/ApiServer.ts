import express from 'express';
import type * as expressTypes from 'express';
import * as bodyParser from 'body-parser';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import type { Room } from './Room';
import type { BroadcasterPeer } from './BroadcasterPeer';
import { ServerError, ForbiddenError, PeerNotFound } from './errors';
import type { RoomId } from './types';

const logger = new Logger('ApiServer');

export type ApiServerCreateOptions = {
	httpOriginHeader: string;
};

type ApiServerConstructorOptions = {
	expressApp: expressTypes.Express;
	httpOriginHeader: string;
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
	peer?: BroadcasterPeer;
}

export class ApiServer extends EnhancedEventEmitter<ApiServerEvents> {
	readonly #expressApp: expressTypes.Express;
	readonly #httpOriginHeader: string;

	static create({ httpOriginHeader }: ApiServerCreateOptions): ApiServer {
		logger.debug('create()');

		const expressApp = ApiServer.createExpressApp();

		const apiServer = new ApiServer({ expressApp, httpOriginHeader });

		return apiServer;
	}

	private static createExpressApp(): expressTypes.Express {
		logger.debug('createExpressApp()');

		const expressApp = express();

		return expressApp;
	}

	private constructor({
		expressApp,
		httpOriginHeader,
	}: ApiServerConstructorOptions) {
		super();

		logger.debug('constructor()');

		this.#expressApp = expressApp;
		this.#httpOriginHeader = httpOriginHeader;

		this.handleExpressApp();
	}

	getApp(): expressTypes.Express {
		return this.#expressApp;
	}

	private handleExpressApp(): void {
		this.#expressApp.set('trust proxy', true);

		/**
		 * Middleware to validate Origin and so on. Yes, we require Origin in ALL
		 * HTTP API requestss. Period.
		 */
		this.#expressApp.use((req: ApiServerExpressRequest, res, next) => {
			if (req.headers.origin !== this.#httpOriginHeader) {
				next(new ForbiddenError('GOOD TRY!!!'));

				return;
			}

			next();
		});

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
		 * For every API request, obtain a Room with the given `roomId`.
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
		 * For every API request, obtain a Peer with the given `peerId` in the Room
		 * with the given `roomId`.
		 */
		this.#expressApp.param(
			'peerId',
			(req: ApiServerExpressRequest, res, next, peerId) => {
				const peer = req.room?.getBroadcasterPeer(peerId);

				if (!peer) {
					next(new PeerNotFound(`BroadcastPeer '${peerId}' doesn't exist`));

					return;
				}

				req.peer = peer;

				next();
			}
		);

		/**
		 * API GET resource that returns the mediasoup Router RTP capabilities of
		 * the Room.
		 */
		this.#expressApp.get(
			'/rooms/:roomId',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId } = req.params;

				try {
					const responseData = await req.room!.processApiRequest({
						name: 'getRouterRtpCapabilities',
						method: 'GET',
						path: ['rooms', { roomId: roomId! }],
					});

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
					const { roomId } = req.params;
					const { peerId, displayName, device } = req.body;

					await req.room!.processApiRequest({
						name: 'createBroadcasterPeer',
						method: 'POST',
						path: ['rooms', { roomId: roomId! }, 'broadcasters'],
						data: {
							peerId,
							displayName,
							device,
						},
						internalData: {
							remoteAddress: req.ip ?? req.ips[0]!,
						},
					});

					res
						.status(201)
						.location(`/rooms/${roomId}/broadcasters/${peerId}`)
						.set('Content-Type', 'text/plain; charset=utf-8')
						.send('BroadcasterPeer created');
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * POST API to join the Room. This must be sent after creating the
		 * mediasoup PlainTransports.
		 */
		this.#expressApp.post(
			'/rooms/:roomId/broadcasters/:peerId/join',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId, peerId } = req.params;

				try {
					await req.peer!.processApiRequest({
						name: 'join',
						method: 'POST',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'join',
						],
					});

					res
						.status(200)
						.set('Content-Type', 'text/plain; charset=utf-8')
						.send('BroadcasterPeer joined');
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * DELETE API to disconnect a BroadcasterPeer.
		 */
		this.#expressApp.delete(
			'/rooms/:roomId/broadcasters/:peerId',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId, peerId } = req.params;

				try {
					await req.peer!.processApiRequest({
						name: 'disconnect',
						method: 'DELETE',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
						],
					});

					res.sendStatus(204);
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
				const { roomId, peerId } = req.params;
				const { direction, comedia, rtcpMux } = req.body;

				try {
					const responseData = await req.peer!.processApiRequest({
						name: 'createPlainTransport',
						method: 'POST',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'transports',
						],
						data: {
							comedia,
							rtcpMux,
							appData: {
								direction,
							},
						},
					});

					res
						.status(201)
						.location(
							`/rooms/${roomId}/broadcasters/${peerId}/transports/${responseData.transportId}`
						)
						.send(responseData);
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
				const { roomId, peerId, transportId } = req.params;
				const { ip, port, rtcpPort } = req.body;

				try {
					await req.peer!.processApiRequest({
						name: 'connectPlainTransport',
						method: 'POST',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'transports',
							{ transportId: transportId! },
							'connect',
						],
						data: {
							ip,
							port,
							rtcpPort,
						},
					});

					res
						.status(200)
						.set('Content-Type', 'text/plain; charset=utf-8')
						.send('PlainTransport connected');
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
			'/rooms/:roomId/broadcasters/:peerId/producers',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId, peerId } = req.params;
				const { transportId, kind, rtpParameters, appData } = req.body;

				try {
					const responseData = await req.peer!.processApiRequest({
						name: 'produce',
						method: 'POST',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'producers',
						],
						data: {
							transportId,
							kind,
							rtpParameters,
							appData,
						},
					});

					res
						.status(201)
						.location(
							`/rooms/${roomId}/broadcasters/${peerId}/producers/${responseData.producerId}`
						)
						.json(responseData);
				} catch (error) {
					next(error);
				}
			}
		);

		/**
		 * GET API to obtain info about current Producers.
		 */
		this.#expressApp.get(
			'/rooms/:roomId/broadcasters/:peerId/peerProducersInfos',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId, peerId } = req.params;

				try {
					const responseData = await req.peer!.processApiRequest({
						name: 'getPeerProducersInfos',
						method: 'GET',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'peerProducersInfos',
						],
					});

					res.status(200).json(responseData);
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
			'/rooms/:roomId/broadcasters/:peerId/consumers',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId, peerId } = req.params;
				const { transportId, producerId, paused, rtpCapabilities } = req.body;

				try {
					const responseData = await req.peer!.processApiRequest({
						name: 'consume',
						method: 'POST',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'consumers',
						],
						data: {
							transportId,
							producerId,
							paused,
							rtpCapabilities,
						},
					});

					res
						.status(201)
						.location(
							`/rooms/${roomId}/broadcasters/${peerId}/consumers/${responseData.consumerId}`
						)
						.json(responseData);
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
			'/rooms/:roomId/broadcasters/:peerId/consumers/:consumerId/resume',
			async (req: ApiServerExpressRequest, res, next) => {
				const { roomId, peerId, consumerId } = req.params;

				try {
					await req.peer!.processApiRequest({
						name: 'resumeConsumer',
						method: 'POST',
						path: [
							'rooms',
							{ roomId: roomId! },
							'broadcasters',
							{ peerId: peerId! },
							'consumers',
							{ consumerId: consumerId! },
							'resume',
						],
					});

					res
						.status(200)
						.set('Content-Type', 'text/plain; charset=utf-8')
						.send('Consumer resumed');
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
					let logErrorStack: boolean = false;

					if (error instanceof ServerError) {
						status = error.status;
					} else if (error instanceof TypeError) {
						status = 400;
						logErrorStack = true;
					} else {
						status = 500;
						logErrorStack = true;
					}

					res.statusMessage = error.message;
					res
						.status(status)
						.set('Content-Type', 'text/plain; charset=utf-8')
						.send(String(error));

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
