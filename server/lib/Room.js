const EventEmitter = require('events').EventEmitter;
const protoo = require('protoo-server');
const throttle = require('@sitespeed.io/throttle');
const Logger = require('./Logger');
const config = require('../config');
const Bot = require('./Bot');

const logger = new Logger('Room');

/**
 * Room class.
 *
 * This is not a "mediasoup Room" by itself, by a custom class that holds
 * a protoo Room (for signaling with WebSocket clients) and a mediasoup Router
 * (for sending and receiving media to/from those WebSocket peers).
 */
class Room extends EventEmitter
{
	/**
	 * Factory function that creates and returns Room instance.
	 *
	 * @async
	 *
	 * @param {mediasoup.Worker} mediasoupWorker - The mediasoup Worker in which a new
	 *   mediasoup Router must be created.
	 * @param {String} roomId - Id of the Room instance.
	 * @param {Boolean} [forceH264=false] - Whether just H264 must be used in the
	 *   mediasoup Router video codecs.
	 * @param {Boolean} [forceVP9=false] - Whether just VP9 must be used in the
	 *   mediasoup Router video codecs.
	 */
	static async create({ mediasoupWorker, roomId, forceH264 = false, forceVP9 = false })
	{
		logger.info(
			'create() [roomId:%s, forceH264:%s, forceVP9:%s]',
			roomId, forceH264, forceVP9);

		// Create a protoo Room instance.
		const protooRoom = new protoo.Room();

		// Router media codecs.
		let { mediaCodecs } = config.mediasoup.routerOptions;

		// If forceH264 is given, remove all video codecs but H264.
		if (forceH264)
		{
			mediaCodecs = mediaCodecs
				.filter((codec) => (
					codec.kind === 'audio' ||
					codec.mimeType.toLowerCase() === 'video/h264'
				));
		}
		// If forceVP9 is given, remove all video codecs but VP9.
		if (forceVP9)
		{
			mediaCodecs = mediaCodecs
				.filter((codec) => (
					codec.kind === 'audio' ||
					codec.mimeType.toLowerCase() === 'video/vp9'
				));
		}

		// Create a mediasoup Router.
		const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs });

		// Create a mediasoup AudioLevelObserver.
		const audioLevelObserver = await mediasoupRouter.createAudioLevelObserver(
			{
				maxEntries : 1,
				threshold  : -80,
				interval   : 800
			});

		const bot = await Bot.create({ mediasoupRouter });

		return new Room(
			{
				roomId,
				protooRoom,
				mediasoupRouter,
				audioLevelObserver,
				bot
			});
	}

	constructor({ roomId, protooRoom, mediasoupRouter, audioLevelObserver, bot })
	{
		super();
		this.setMaxListeners(Infinity);

		// Room id.
		// @type {String}
		this._roomId = roomId;

		// Closed flag.
		// @type {Boolean}
		this._closed = false;

		// protoo Room instance.
		// @type {protoo.Room}
		this._protooRoom = protooRoom;

		// Map of broadcasters indexed by id. Each Object has:
		// - {String} id
		// - {Object} data
		//   - {String} displayName
		//   - {Object} device
		//   - {RTCRtpCapabilities} rtpCapabilities
		//   - {Map<String, mediasoup.Transport>} transports
		//   - {Map<String, mediasoup.Producer>} producers
		//   - {Map<String, mediasoup.Consumers>} consumers
		//   - {Map<String, mediasoup.DataProducer>} dataProducers
		//   - {Map<String, mediasoup.DataConsumers>} dataConsumers
		// @type {Map<String, Object>}
		this._broadcasters = new Map();

		// mediasoup Router instance.
		// @type {mediasoup.Router}
		this._mediasoupRouter = mediasoupRouter;

		// mediasoup AudioLevelObserver.
		// @type {mediasoup.AudioLevelObserver}
		this._audioLevelObserver = audioLevelObserver;

		// DataChannel bot.
		// @type {Bot}
		this._bot = bot;

		// Network throttled.
		// @type {Boolean}
		this._networkThrottled = false;

		// Handle audioLevelObserver.
		this._handleAudioLevelObserver();

		// For debugging.
		global.audioLevelObserver = this._audioLevelObserver;
		global.bot = this._bot;
	}

	/**
	 * Closes the Room instance by closing the protoo Room and the mediasoup Router.
	 */
	close()
	{
		logger.debug('close()');

		this._closed = true;

		// Close the protoo Room.
		this._protooRoom.close();

		// Close the mediasoup Router.
		this._mediasoupRouter.close();

		// Close the Bot.
		this._bot.close();

		// Emit 'close' event.
		this.emit('close');

		// Stop network throttling.
		if (this._networkThrottled)
		{
			throttle.stop({})
				.catch(() => {});
		}
	}

	logStatus()
	{
		logger.info(
			'logStatus() [roomId:%s, protoo Peers:%s, mediasoup Transports:%s]',
			this._roomId,
			this._protooRoom.peers.length,
			this._mediasoupRouter._transports.size); // NOTE: Private API.
	}

	/**
	 * Called from server.js upon a protoo WebSocket connection request from a
	 * browser.
	 *
	 * @param {String} peerId - The id of the protoo peer to be created.
	 * @param {Boolean} consume - Whether this peer wants to consume from others.
	 * @param {protoo.WebSocketTransport} protooWebSocketTransport - The associated
	 *   protoo WebSocket transport.
	 */
	handleProtooConnection({ peerId, consume, protooWebSocketTransport })
	{
		const existingPeer = this._protooRoom.getPeer(peerId);

		if (existingPeer)
		{
			logger.warn(
				'handleProtooConnection() | there is already a protoo Peer with same peerId, closing it [peerId:%s]',
				peerId);

			existingPeer.close();
		}

		let peer;

		// Create a new protoo Peer with the given peerId.
		try
		{
			peer = this._protooRoom.createPeer(peerId, protooWebSocketTransport);
		}
		catch (error)
		{
			logger.error('protooRoom.createPeer() failed:%o', error);
		}

		// Use the peer.data object to store mediasoup related objects.

		// Not joined after a custom protoo 'join' request is later received.
		peer.data.consume = consume;
		peer.data.joined = false;
		peer.data.displayName = undefined;
		peer.data.device = undefined;
		peer.data.rtpCapabilities = undefined;
		peer.data.sctpCapabilities = undefined;

		// Have mediasoup related maps ready even before the Peer joins since we
		// allow creating Transports before joining.
		peer.data.transports = new Map();
		peer.data.producers = new Map();
		peer.data.consumers = new Map();
		peer.data.dataProducers = new Map();
		peer.data.dataConsumers = new Map();

		peer.on('request', (request, accept, reject) =>
		{
			logger.debug(
				'protoo Peer "request" event [method:%s, peerId:%s]',
				request.method, peer.id);

			this._handleProtooRequest(peer, request, accept, reject)
				.catch((error) =>
				{
					logger.error('request failed:%o', error);

					reject(error);
				});
		});

		peer.on('close', () =>
		{
			if (this._closed)
				return;

			logger.debug('protoo Peer "close" event [peerId:%s]', peer.id);

			// If the Peer was joined, notify all Peers.
			if (peer.data.joined)
			{
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					otherPeer.notify('peerClosed', { peerId: peer.id })
						.catch(() => {});
				}
			}

			// Iterate and close all mediasoup Transport associated to this Peer, so all
			// its Producers and Consumers will also be closed.
			for (const transport of peer.data.transports.values())
			{
				transport.close();
			}

			// If this is the latest Peer in the room, close the room.
			if (this._protooRoom.peers.length === 0)
			{
				logger.info(
					'last Peer in the room left, closing the room [roomId:%s]',
					this._roomId);

				this.close();
			}
		});
	}

	getRouterRtpCapabilities()
	{
		return this._mediasoupRouter.rtpCapabilities;
	}

	/**
	 * Create a Broadcaster. This is for HTTP API requests (see server.js).
	 *
	 * @async
	 *
	 * @type {String} id - Broadcaster id.
	 * @type {String} displayName - Descriptive name.
	 * @type {Object} [device] - Additional info with name, version and flags fields.
	 * @type {RTCRtpCapabilities} [rtpCapabilities] - Device RTP capabilities.
	 */
	async createBroadcaster({ id, displayName, device = {}, rtpCapabilities })
	{
		if (typeof id !== 'string' || !id)
			throw new TypeError('missing body.id');
		else if (typeof displayName !== 'string' || !displayName)
			throw new TypeError('missing body.displayName');
		else if (typeof device.name !== 'string' || !device.name)
			throw new TypeError('missing body.device.name');
		else if (rtpCapabilities && typeof rtpCapabilities !== 'object')
			throw new TypeError('wrong body.rtpCapabilities');

		if (this._broadcasters.has(id))
			throw new Error(`broadcaster with id "${id}" already exists`);

		const broadcaster =
		{
			id,
			data :
			{
				displayName,
				device :
				{
					flag    : 'broadcaster',
					name    : device.name || 'Unknown device',
					version : device.version
				},
				rtpCapabilities,
				transports    : new Map(),
				producers     : new Map(),
				consumers     : new Map(),
				dataProducers : new Map(),
				dataConsumers : new Map()
			}
		};

		// Store the Broadcaster into the map.
		this._broadcasters.set(broadcaster.id, broadcaster);

		// Notify the new Broadcaster to all Peers.
		for (const otherPeer of this._getJoinedPeers())
		{
			otherPeer.notify(
				'newPeer',
				{
					id          : broadcaster.id,
					displayName : broadcaster.data.displayName,
					device      : broadcaster.data.device
				})
				.catch(() => {});
		}

		// Reply with the list of Peers and their Producers.
		const peerInfos = [];
		const joinedPeers = this._getJoinedPeers();

		// Just fill the list of Peers if the Broadcaster provided its rtpCapabilities.
		if (rtpCapabilities)
		{
			for (const joinedPeer of joinedPeers)
			{
				const peerInfo =
				{
					id          : joinedPeer.id,
					displayName : joinedPeer.data.displayName,
					device      : joinedPeer.data.device,
					producers   : []
				};

				for (const producer of joinedPeer.data.producers.values())
				{
					// Ignore Producers that the Broadcaster cannot consume.
					if (
						!this._mediasoupRouter.canConsume(
							{
								producerId : producer.id,
								rtpCapabilities
							})
					)
					{
						continue;
					}

					peerInfo.producers.push(
						{
							id   : producer.id,
							kind : producer.kind
						});
				}

				peerInfos.push(peerInfo);
			}
		}

		return { peers: peerInfos };
	}

	/**
	 * Delete a Broadcaster.
	 *
	 * @type {String} broadcasterId
	 */
	deleteBroadcaster({ broadcasterId })
	{
		const broadcaster = this._broadcasters.get(broadcasterId);

		if (!broadcaster)
			throw new Error(`broadcaster with id "${broadcasterId}" does not exist`);

		for (const transport of broadcaster.data.transports.values())
		{
			transport.close();
		}

		this._broadcasters.delete(broadcasterId);

		for (const peer of this._getJoinedPeers())
		{
			peer.notify('peerClosed', { peerId: broadcasterId })
				.catch(() => {});
		}
	}

	/**
	 * Create a mediasoup Transport associated to a Broadcaster. It can be a
	 * PlainRtpTransport or a WebRtcTransport.
	 *
	 * @async
	 *
	 * @type {String} broadcasterId
	 * @type {String} type - Can be 'plain' (PlainRtpTransport) or 'webrtc'
	 *   (WebRtcTransport).
	 * @type {Boolean} [rtcpMux=true] - Just for PlainRtpTransport, use RTCP mux.
	 * @type {Boolean} [comedia=true] - Just for PlainRtpTransport, enable remote IP:port
	 *   autodetection.
	 * @type {Boolean} [multiSource=false] - Just for PlainRtpTransport, allow RTP from any
	 *   remote IP and port (no RTCP feedback will be sent to the remote).
	 * @type {Object} [sctpCapabilities] - SCTP capabilities
	 */
	async createBroadcasterTransport(
		{
			broadcasterId,
			type,
			rtcpMux = true,
			comedia = true,
			multiSource = false,
			sctpCapabilities
		})
	{
		const broadcaster = this._broadcasters.get(broadcasterId);

		if (!broadcaster)
			throw new Error(`broadcaster with id "${broadcasterId}" does not exist`);

		switch (type)
		{
			case 'webrtc':
			{
				const webRtcTransportOptions =
				{
					...config.mediasoup.webRtcTransportOptions,
					enableSctp     : Boolean(sctpCapabilities),
					numSctpStreams : (sctpCapabilities || {}).numStreams
				};

				const transport = await this._mediasoupRouter.createWebRtcTransport(
					webRtcTransportOptions);

				// Store it.
				broadcaster.data.transports.set(transport.id, transport);

				return {
					id             : transport.id,
					iceParameters  : transport.iceParameters,
					iceCandidates  : transport.iceCandidates,
					dtlsParameters : transport.dtlsParameters,
					sctpParameters : transport.sctpParameters
				};
			}

			case 'plain':
			{
				const plainRtpTransportOptions =
				{
					...config.mediasoup.plainRtpTransportOptions,
					rtcpMux     : Boolean(rtcpMux),
					comedia     : Boolean(comedia),
					multiSource : Boolean(multiSource)
				};

				const transport = await this._mediasoupRouter.createPlainRtpTransport(
					plainRtpTransportOptions);

				// Store it.
				broadcaster.data.transports.set(transport.id, transport);

				return {
					id       : transport.id,
					ip       : transport.tuple.localIp,
					port     : transport.tuple.localPort,
					rtcpPort : transport.rtcpTuple ? transport.rtcpTuple.localPort : undefined
				};
			}

			default:
			{
				throw new TypeError('invalid type');
			}
		}
	}

	/**
	 * Connect a Broadcaster mediasoup WebRtcTransport.
	 *
	 * @async
	 *
	 * @type {String} broadcasterId
	 * @type {String} transportId
	 * @type {RTCDtlsParameters} dtlsParameters - Remote DTLS parameters.
	 */
	async connectBroadcasterTransport(
		{
			broadcasterId,
			transportId,
			dtlsParameters
		}
	)
	{
		const broadcaster = this._broadcasters.get(broadcasterId);

		if (!broadcaster)
			throw new Error(`broadcaster with id "${broadcasterId}" does not exist`);

		const transport = broadcaster.data.transports.get(transportId);

		if (!transport)
			throw new Error(`transport with id "${transportId}" does not exist`);

		if (transport.constructor.name !== 'WebRtcTransport')
		{
			throw new Error(
				`transport with id "${transportId}" is not a WebRtcTransport`);
		}

		await transport.connect({ dtlsParameters });
	}

	/**
	 * Create a mediasoup Producer associated to a Broadcaster.
	 *
	 * @async
	 *
	 * @type {String} broadcasterId
	 * @type {String} transportId
	 * @type {String} kind - 'audio' or 'video' kind for the Producer.
	 * @type {RTCRtpParameters} rtpParameters - RTP parameters for the Producer.
	 */
	async createBroadcasterProducer(
		{
			broadcasterId,
			transportId,
			kind,
			rtpParameters
		}
	)
	{
		const broadcaster = this._broadcasters.get(broadcasterId);

		if (!broadcaster)
			throw new Error(`broadcaster with id "${broadcasterId}" does not exist`);

		const transport = broadcaster.data.transports.get(transportId);

		if (!transport)
			throw new Error(`transport with id "${transportId}" does not exist`);

		const producer =
			await transport.produce({ kind, rtpParameters });

		// Store it.
		broadcaster.data.producers.set(producer.id, producer);

		// Set Producer events.
		// producer.on('score', (score) =>
		// {
		// 	logger.debug(
		// 		'broadcaster producer "score" event [producerId:%s, score:%o]',
		// 		producer.id, score);
		// });

		producer.on('videoorientationchange', (videoOrientation) =>
		{
			logger.debug(
				'broadcaster producer "videoorientationchange" event [producerId:%s, videoOrientation:%o]',
				producer.id, videoOrientation);
		});

		// Optimization: Create a server-side Consumer for each Peer.
		for (const peer of this._getJoinedPeers())
		{
			this._createConsumer(
				{
					consumerPeer : peer,
					producerPeer : broadcaster,
					producer
				});
		}

		// Add into the audioLevelObserver.
		if (producer.kind === 'audio')
		{
			this._audioLevelObserver.addProducer({ producerId: producer.id })
				.catch(() => {});
		}

		return { id: producer.id };
	}

	/**
	 * Create a mediasoup Consumer associated to a Broadcaster.
	 *
	 * @async
	 *
	 * @type {String} broadcasterId
	 * @type {String} transportId
	 * @type {String} producerId
	 */
	async createBroadcasterConsumer(
		{
			broadcasterId,
			transportId,
			producerId
		}
	)
	{
		const broadcaster = this._broadcasters.get(broadcasterId);

		if (!broadcaster)
			throw new Error(`broadcaster with id "${broadcasterId}" does not exist`);

		if (!broadcaster.data.rtpCapabilities)
			throw new Error('broadcaster does not have rtpCapabilities');

		const transport = broadcaster.data.transports.get(transportId);

		if (!transport)
			throw new Error(`transport with id "${transportId}" does not exist`);

		const consumer = await transport.consume(
			{
				producerId,
				rtpCapabilities : broadcaster.data.rtpCapabilities
			});

		// Store it.
		broadcaster.data.consumers.set(consumer.id, consumer);

		// Set Consumer events.
		consumer.on('transportclose', () =>
		{
			// Remove from its map.
			broadcaster.data.consumers.delete(consumer.id);
		});

		consumer.on('producerclose', () =>
		{
			// Remove from its map.
			broadcaster.data.consumers.delete(consumer.id);
		});

		return {
			id            : consumer.id,
			producerId,
			kind          : consumer.kind,
			rtpParameters : consumer.rtpParameters,
			type          : consumer.type
		};
	}

	_handleAudioLevelObserver()
	{
		this._audioLevelObserver.on('volumes', (volumes) =>
		{
			const { producer, volume } = volumes[0];

			// logger.debug(
			// 	'audioLevelObserver "volumes" event [producerId:%s, volume:%s]',
			// 	producer.id, volume);

			// Notify all Peers.
			for (const peer of this._getJoinedPeers())
			{
				peer.notify(
					'activeSpeaker',
					{
						peerId : producer.appData.peerId,
						volume : volume
					})
					.catch(() => {});
			}
		});

		this._audioLevelObserver.on('silence', () =>
		{
			// logger.debug('audioLevelObserver "silence" event');

			// Notify all Peers.
			for (const peer of this._getJoinedPeers())
			{
				peer.notify('activeSpeaker', { peerId: null })
					.catch(() => {});
			}
		});
	}

	/**
	 * Handle protoo requests from browsers.
	 *
	 * @async
	 */
	async _handleProtooRequest(peer, request, accept, reject)
	{
		switch (request.method)
		{
			case 'getRouterRtpCapabilities':
			{
				accept(this._mediasoupRouter.rtpCapabilities);

				break;
			}

			case 'join':
			{
				// Ensure the Peer is not already joined.
				if (peer.data.joined)
					throw new Error('Peer already joined');

				const {
					displayName,
					device,
					rtpCapabilities,
					sctpCapabilities
				} = request.data;

				// Store client data into the protoo Peer data object.
				peer.data.joined = true;
				peer.data.displayName = displayName;
				peer.data.device = device;
				peer.data.rtpCapabilities = rtpCapabilities;
				peer.data.sctpCapabilities = sctpCapabilities;

				// Tell the new Peer about already joined Peers.
				// And also create Consumers for existing Producers.

				const joinedPeers =
				[
					...this._getJoinedPeers(),
					...this._broadcasters.values()
				];

				// Reply now the request with the list of joined peers (all but the new one).
				const peerInfos = joinedPeers
					.filter((joinedPeer) => joinedPeer.id !== peer.id)
					.map((joinedPeer) => ({
						id          : joinedPeer.id,
						displayName : joinedPeer.data.displayName,
						device      : joinedPeer.data.device
					}));

				accept({ peers: peerInfos });

				// Mark the new Peer as joined.
				peer.data.joined = true;

				for (const joinedPeer of joinedPeers)
				{
					// Create Consumers for existing Producers.
					for (const producer of joinedPeer.data.producers.values())
					{
						this._createConsumer(
							{
								consumerPeer : peer,
								producerPeer : joinedPeer,
								producer
							});
					}

					// Create DataConsumers for existing DataProducers.
					for (const dataProducer of joinedPeer.data.dataProducers.values())
					{
						if (dataProducer.label === 'bot')
							continue;

						this._createDataConsumer(
							{
								dataConsumerPeer : peer,
								dataProducerPeer : joinedPeer,
								dataProducer
							});
					}
				}

				// Create DataConsumers for bot DataProducer.
				this._createDataConsumer(
					{
						dataConsumerPeer : peer,
						dataProducerPeer : null,
						dataProducer     : this._bot.dataProducer
					});

				// Notify the new Peer to all other Peers.
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					otherPeer.notify(
						'newPeer',
						{
							id          : peer.id,
							displayName : peer.data.displayName,
							device      : peer.data.device
						})
						.catch(() => {});
				}

				break;
			}

			case 'createWebRtcTransport':
			{
				// NOTE: Don't require that the Peer is joined here, so the client can
				// initiate mediasoup Transports and be ready when he later joins.

				const {
					forceTcp,
					producing,
					consuming,
					sctpCapabilities
				} = request.data;

				const webRtcTransportOptions =
				{
					...config.mediasoup.webRtcTransportOptions,
					enableSctp     : Boolean(sctpCapabilities),
					numSctpStreams : (sctpCapabilities || {}).numStreams,
					appData        : { producing, consuming }
				};

				if (forceTcp)
				{
					webRtcTransportOptions.enableUdp = false;
					webRtcTransportOptions.enableTcp = true;
				}

				const transport = await this._mediasoupRouter.createWebRtcTransport(
					webRtcTransportOptions);

				transport.on('sctpstatechange', (sctpState) =>
				{
					logger.debug('WebRtcTransport "sctpstatechange" event [sctpState:%s]', sctpState);
				});

				transport.on('dtlsstatechange', (dtlsState) =>
				{
					if (dtlsState === 'failed' || dtlsState === 'closed')
						logger.warn('WebRtcTransport "dtlsstatechange" event [dtlsState:%s]', dtlsState);
				});

				// NOTE: For testing.
				// await transport.enablePacketEvent([ 'probation' ]);
				// await transport.enablePacketEvent([ 'bwe' ]);

				transport.on('packet', (packet) =>
				{
					logger.info(
						'transport "packet" event [transportId:%s, packet.type:%s, packet:%o]',
						transport.id, packet.type, packet);
				});

				// Store the WebRtcTransport into the protoo Peer data Object.
				peer.data.transports.set(transport.id, transport);

				accept(
					{
						id             : transport.id,
						iceParameters  : transport.iceParameters,
						iceCandidates  : transport.iceCandidates,
						dtlsParameters : transport.dtlsParameters,
						sctpParameters : transport.sctpParameters
					});

				const { maxIncomingBitrate } = config.mediasoup.webRtcTransportOptions;

				// If set, apply max incoming bitrate limit.
				if (maxIncomingBitrate)
				{
					try { await transport.setMaxIncomingBitrate(maxIncomingBitrate); }
					catch (error) {}
				}

				break;
			}

			case 'connectWebRtcTransport':
			{
				const { transportId, dtlsParameters } = request.data;
				const transport = peer.data.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				await transport.connect({ dtlsParameters });

				accept();

				break;
			}

			case 'restartIce':
			{
				const { transportId } = request.data;
				const transport = peer.data.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				const iceParameters = await transport.restartIce();

				accept(iceParameters);

				break;
			}

			case 'produce':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { transportId, kind, rtpParameters } = request.data;
				let { appData } = request.data;
				const transport = peer.data.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				// Add peerId into appData to later get the associated Peer during
				// the 'loudest' event of the audioLevelObserver.
				appData = { ...appData, peerId: peer.id };

				const producer =
					await transport.produce({ kind, rtpParameters, appData });

				// Store the Producer into the protoo Peer data Object.
				peer.data.producers.set(producer.id, producer);

				// Set Producer events.
				producer.on('score', (score) =>
				{
					// logger.debug(
					// 	'producer "score" event [producerId:%s, score:%o]',
					// 	producer.id, score);

					peer.notify('producerScore', { producerId: producer.id, score })
						.catch(() => {});
				});

				producer.on('videoorientationchange', (videoOrientation) =>
				{
					logger.debug(
						'producer "videoorientationchange" event [producerId:%s, videoOrientation:%o]',
						producer.id, videoOrientation);
				});

				// NOTE: For testing.
				// await producer.enablePacketEvent([ 'rtp', 'nack', 'pli', 'fir' ]);
				// await producer.enablePacketEvent([ 'pli', 'fir' ]);
				// await producer.enablePacketEvent([ 'keyframe' ]);

				producer.on('packet', (packet) =>
				{
					logger.info(
						'producer "packet" event [producerId:%s, packet.type:%s, packet:%o]',
						producer.id, packet.type, packet);
				});

				accept({ id: producer.id });

				// Optimization: Create a server-side Consumer for each Peer.
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					this._createConsumer(
						{
							consumerPeer : otherPeer,
							producerPeer : peer,
							producer
						});
				}

				// Add into the audioLevelObserver.
				if (producer.kind === 'audio')
				{
					this._audioLevelObserver.addProducer({ producerId: producer.id })
						.catch(() => {});
				}

				break;
			}

			case 'closeProducer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { producerId } = request.data;
				const producer = peer.data.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				producer.close();

				// Remove from its map.
				peer.data.producers.delete(producer.id);

				accept();

				break;
			}

			case 'pauseProducer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { producerId } = request.data;
				const producer = peer.data.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				await producer.pause();

				accept();

				break;
			}

			case 'resumeProducer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { producerId } = request.data;
				const producer = peer.data.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				await producer.resume();

				accept();

				break;
			}

			case 'pauseConsumer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.data.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.pause();

				accept();

				break;
			}

			case 'resumeConsumer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.data.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.resume();

				accept();

				break;
			}

			case 'setConsumerPreferredLayers':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId, spatialLayer, temporalLayer } = request.data;
				const consumer = peer.data.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.setPreferredLayers({ spatialLayer, temporalLayer });

				accept();

				break;
			}

			case 'setConsumerPriority':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId, priority } = request.data;
				const consumer = peer.data.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.setPriority(priority);

				accept();

				break;
			}

			case 'requestConsumerKeyFrame':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.data.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.requestKeyFrame();

				accept();

				break;
			}

			case 'produceData':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const {
					transportId,
					sctpStreamParameters,
					label,
					protocol,
					appData
				} = request.data;

				const transport = peer.data.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				const dataProducer = await transport.produceData(
					{
						sctpStreamParameters,
						label,
						protocol,
						appData
					});

				// Store the Producer into the protoo Peer data Object.
				peer.data.dataProducers.set(dataProducer.id, dataProducer);

				accept({ id: dataProducer.id });

				switch (dataProducer.label)
				{
					case 'chat':
					{
						// Create a server-side DataConsumer for each Peer.
						for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
						{
							this._createDataConsumer(
								{
									dataConsumerPeer : otherPeer,
									dataProducerPeer : peer,
									dataProducer
								});
						}

						break;
					}

					case 'bot':
					{
						// Pass it to the bot.
						this._bot.handleDataProducer(
							{
								dataProducerId : dataProducer.id,
								peer
							});

						break;
					}
				}

				break;
			}

			case 'changeDisplayName':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { displayName } = request.data;
				const oldDisplayName = peer.data.displayName;

				// Store the display name into the custom data Object of the protoo
				// Peer.
				peer.data.displayName = displayName;

				// Notify other joined Peers.
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					otherPeer.notify(
						'peerDisplayNameChanged',
						{
							peerId : peer.id,
							displayName,
							oldDisplayName
						})
						.catch(() => {});
				}

				accept();

				break;
			}

			case 'getTransportStats':
			{
				const { transportId } = request.data;
				const transport = peer.data.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				const stats = await transport.getStats();

				accept(stats);

				break;
			}

			case 'getProducerStats':
			{
				const { producerId } = request.data;
				const producer = peer.data.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				const stats = await producer.getStats();

				accept(stats);

				break;
			}

			case 'getConsumerStats':
			{
				const { consumerId } = request.data;
				const consumer = peer.data.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				const stats = await consumer.getStats();

				accept(stats);

				break;
			}

			case 'getDataProducerStats':
			{
				const { dataProducerId } = request.data;
				const dataProducer = peer.data.dataProducers.get(dataProducerId);

				if (!dataProducer)
					throw new Error(`dataProducer with id "${dataProducerId}" not found`);

				const stats = await dataProducer.getStats();

				accept(stats);

				break;
			}

			case 'getDataConsumerStats':
			{
				const { dataConsumerId } = request.data;
				const dataConsumer = peer.data.dataConsumers.get(dataConsumerId);

				if (!dataConsumer)
					throw new Error(`dataConsumer with id "${dataConsumerId}" not found`);

				const stats = await dataConsumer.getStats();

				accept(stats);

				break;
			}

			case 'applyNetworkThrottle':
			{
				const DefaultUplink = 1000000;
				const DefaultDownlink = 1000000;
				const DefaultRtt = 0;

				const { uplink, downlink, rtt, secret } = request.data;

				if (!secret || secret !== process.env.NETWORK_THROTTLE_SECRET)
				{
					reject(403, 'operation NOT allowed, modda fuckaa');

					return;
				}

				try
				{
					await throttle.start(
						{
							up   : uplink || DefaultUplink,
							down : downlink || DefaultDownlink,
							rtt  : rtt || DefaultRtt
						});

					logger.warn(
						'network throttle set [uplink:%s, downlink:%s, rtt:%s]',
						uplink || DefaultUplink,
						downlink || DefaultDownlink,
						rtt || DefaultRtt);

					accept();
				}
				catch (error)
				{
					logger.error('network throttle apply failed: %o', error);

					reject(500, error.toString());
				}

				break;
			}

			case 'resetNetworkThrottle':
			{
				const { secret } = request.data;

				if (!secret || secret !== process.env.NETWORK_THROTTLE_SECRET)
				{
					reject(403, 'operation NOT allowed, modda fuckaa');

					return;
				}

				try
				{
					await throttle.stop({});

					logger.warn('network throttle stopped');

					accept();
				}
				catch (error)
				{
					logger.error('network throttle stop failed: %o', error);

					reject(500, error.toString());
				}

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				reject(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	/**
	 * Helper to get the list of joined protoo peers.
	 */
	_getJoinedPeers({ excludePeer = undefined } = {})
	{
		return this._protooRoom.peers
			.filter((peer) => peer.data.joined && peer !== excludePeer);
	}

	/**
	 * Creates a mediasoup Consumer for the given mediasoup Producer.
	 *
	 * @async
	 */
	async _createConsumer({ consumerPeer, producerPeer, producer })
	{
		// Optimization:
		// - Create the server-side Consumer in paused mode.
		// - Tell its Peer about it and wait for its response.
		// - Upon receipt of the response, resume the server-side Consumer.
		// - If video, this will mean a single key frame requested by the
		//   server-side Consumer (when resuming it).
		// - If audio (or video), it will avoid that RTP packets are received by the
		//   remote endpoint *before* the Consumer is locally created in the endpoint
		//   (and before the local SDP O/A procedure ends). If that happens (RTP
		//   packets are received before the SDP O/A is done) the PeerConnection may
		//   fail to associate the RTP stream.

		// NOTE: Don't create the Consumer if the remote Peer cannot consume it.
		if (
			!consumerPeer.data.rtpCapabilities ||
			!this._mediasoupRouter.canConsume(
				{
					producerId      : producer.id,
					rtpCapabilities : consumerPeer.data.rtpCapabilities
				})
		)
		{
			return;
		}

		// Must take the Transport the remote Peer is using for consuming.
		const transport = Array.from(consumerPeer.data.transports.values())
			.find((t) => t.appData.consuming);

		// This should not happen.
		if (!transport)
		{
			logger.warn('_createConsumer() | Transport for consuming not found');

			return;
		}

		// Create the Consumer in paused mode.
		let consumer;

		try
		{
			consumer = await transport.consume(
				{
					producerId      : producer.id,
					rtpCapabilities : consumerPeer.data.rtpCapabilities,
					paused          : true
				});
		}
		catch (error)
		{
			logger.warn('_createConsumer() | transport.consume():%o', error);

			return;
		}

		// Store the Consumer into the protoo consumerPeer data Object.
		consumerPeer.data.consumers.set(consumer.id, consumer);

		// Set Consumer events.
		consumer.on('transportclose', () =>
		{
			// Remove from its map.
			consumerPeer.data.consumers.delete(consumer.id);
		});

		consumer.on('producerclose', () =>
		{
			// Remove from its map.
			consumerPeer.data.consumers.delete(consumer.id);

			consumerPeer.notify('consumerClosed', { consumerId: consumer.id })
				.catch(() => {});
		});

		consumer.on('producerpause', () =>
		{
			consumerPeer.notify('consumerPaused', { consumerId: consumer.id })
				.catch(() => {});
		});

		consumer.on('producerresume', () =>
		{
			consumerPeer.notify('consumerResumed', { consumerId: consumer.id })
				.catch(() => {});
		});

		consumer.on('score', (score) =>
		{
			// logger.debug(
			// 	'consumer "score" event [consumerId:%s, score:%o]',
			// 	consumer.id, score);

			consumerPeer.notify('consumerScore', { consumerId: consumer.id, score })
				.catch(() => {});
		});

		consumer.on('layerschange', (layers) =>
		{
			consumerPeer.notify(
				'consumerLayersChanged',
				{
					consumerId    : consumer.id,
					spatialLayer  : layers ? layers.spatialLayer : null,
					temporalLayer : layers ? layers.temporalLayer : null
				})
				.catch(() => {});
		});

		// NOTE: For testing.
		// await consumer.enablePacketEvent([ 'rtp', 'nack', 'pli', 'fir' ]);
		// await consumer.enablePacketEvent([ 'pli', 'fir' ]);
		// await consumer.enablePacketEvent([ 'keyframe' ]);

		consumer.on('packet', (packet) =>
		{
			logger.info(
				'consumer "packet" event [producerId:%s, packet.type:%s, packet:%o]',
				consumer.id, packet.type, packet);
		});

		// Send a protoo request to the remote Peer with Consumer parameters.
		try
		{
			await consumerPeer.request(
				'newConsumer',
				{
					peerId         : producerPeer.id,
					producerId     : producer.id,
					id             : consumer.id,
					kind           : consumer.kind,
					rtpParameters  : consumer.rtpParameters,
					type           : consumer.type,
					appData        : producer.appData,
					producerPaused : consumer.producerPaused
				});

			// Now that we got the positive response from the remote endpoint, resume
			// the Consumer so the remote endpoint will receive the a first RTP packet
			// of this new stream once its PeerConnection is already ready to process
			// and associate it.
			await consumer.resume();

			consumerPeer.notify(
				'consumerScore',
				{
					consumerId : consumer.id,
					score      : consumer.score
				})
				.catch(() => {});
		}
		catch (error)
		{
			logger.warn('_createConsumer() | failed:%o', error);
		}
	}

	/**
	 * Creates a mediasoup DataConsumer for the given mediasoup DataProducer.
	 *
	 * @async
	 */
	async _createDataConsumer(
		{
			dataConsumerPeer,
			dataProducerPeer = null, // This is null for the bot DataProducer.
			dataProducer
		})
	{
		// NOTE: Don't create the DataConsumer if the remote Peer cannot consume it.
		if (!dataConsumerPeer.data.sctpCapabilities)
			return;

		// Must take the Transport the remote Peer is using for consuming.
		const transport = Array.from(dataConsumerPeer.data.transports.values())
			.find((t) => t.appData.consuming);

		// This should not happen.
		if (!transport)
		{
			logger.warn('_createDataConsumer() | Transport for consuming not found');

			return;
		}

		// Create the DataConsumer.
		let dataConsumer;

		try
		{
			dataConsumer = await transport.consumeData(
				{
					dataProducerId : dataProducer.id
				});
		}
		catch (error)
		{
			logger.warn('_createDataConsumer() | transport.consumeData():%o', error);

			return;
		}

		// Store the DataConsumer into the protoo dataConsumerPeer data Object.
		dataConsumerPeer.data.dataConsumers.set(dataConsumer.id, dataConsumer);

		// Set DataConsumer events.
		dataConsumer.on('transportclose', () =>
		{
			// Remove from its map.
			dataConsumerPeer.data.dataConsumers.delete(dataConsumer.id);
		});

		dataConsumer.on('dataproducerclose', () =>
		{
			// Remove from its map.
			dataConsumerPeer.data.dataConsumers.delete(dataConsumer.id);

			dataConsumerPeer.notify(
				'dataConsumerClosed', { dataConsumerId: dataConsumer.id })
				.catch(() => {});
		});

		// Send a protoo request to the remote Peer with Consumer parameters.
		try
		{
			await dataConsumerPeer.request(
				'newDataConsumer',
				{
					// This is null for bot DataProducer.
					peerId               : dataProducerPeer ? dataProducerPeer.id : null,
					dataProducerId       : dataProducer.id,
					id                   : dataConsumer.id,
					sctpStreamParameters : dataConsumer.sctpStreamParameters,
					label                : dataConsumer.label,
					protocol             : dataConsumer.protocol,
					appData              : dataProducer.appData
				});
		}
		catch (error)
		{
			logger.warn('_createDataConsumer() | failed:%o', error);
		}
	}
}

module.exports = Room;
