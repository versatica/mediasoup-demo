const EventEmitter = require('events').EventEmitter;
const protoo = require('protoo-server');
const Logger = require('./Logger');
const config = require('../config');

const logger = new Logger('Room');

class Room extends EventEmitter
{
	static async create({ mediasoupWorker, roomId, forceH264 })
	{
		logger.info('create() [roomId:%s, forceH264:%s]', roomId, forceH264);

		// Create a protoo Room instance.
		const protooRoom = new protoo.Room();

		// Router media codecs.
		let mediaCodecs = config.mediasoup.router.mediaCodecs;

		// If forceH264 is given, remove all video codecs but H264.
		if (forceH264)
		{
			mediaCodecs = mediaCodecs
				.filter((codec) => (
					codec.kind === 'audio' ||
					codec.name.toLowerCase() === 'h264'
				));
		}

		// Create a mediasoup Router.
		const mediasoupRouter = await mediasoupWorker.createRouter({ mediaCodecs });

		return new Room({ roomId, protooRoom, mediasoupRouter });
	}

	constructor({ roomId, protooRoom, mediasoupRouter })
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

		// mediasoup Router instance.
		// @type {mediasoup.Router}
		this._mediasoupRouter = mediasoupRouter;
	}

	close()
	{
		logger.debug('close()');

		this._closed = true;

		// Close the protoo Room.
		this._protooRoom.close();

		// Close the mediasoup Router.
		this._mediasoupRouter.close();

		// Emit 'close' event.
		this.emit('close');
	}

	logStatus()
	{
		logger.info(
			'logStatus() [roomId:%s, protoo peers:%s, mediasoup transports:%s]',
			this._roomId,
			this._protooRoom.peers.length,
			this._mediasoupRouter._transports.size); // NOTE: Private API.
	}

	handleProtooConnection({ peerId, protooWebSocketTransport })
	{
		const existingProtooPeer = this._protooRoom.getPeer(peerId);

		if (existingProtooPeer)
		{
			logger.warn(
				'handleProtooConnection() | there is already a protoo peer with same peerId, closing it [peerId:%s]',
				peerId);

			existingProtooPeer.close();
		}

		let protooPeer;

		try
		{
			protooPeer = this._protooRoom.createPeer(peerId, protooWebSocketTransport);
		}
		catch (error)
		{
			logger.error('protooRoom.createPeer() failed:%o', error);
		}

		protooPeer.on('request', (request, accept, reject) =>
		{
			logger.debug(
				'protoo peer "request" event [method:%s, peerId:%s]',
				request.method, protooPeer.id);

			this._handleProtooRequest(protooPeer, request, accept, reject)
				.catch((error) =>
				{
					logger.error('request failed:%o', error);

					reject(error);
				});
		});

		protooPeer.on('close', () =>
		{
			if (this._closed)
				return;

			logger.debug('protoo peer "close" event [peerId:%s]', protooPeer.id);

			// Notify other joined Peers.
			for (const peer of this._getJoinedPeers({ excludePeer: protooPeer }))
			{
				peer.notify('peerClosed', { peerId: protooPeer.id })
					.catch(() => {});
			}

			// Iterate and close all mediasoup Transport associated to this Peer, so all
			// its Producers and Consumers will also be closed.
			for (const transport of protooPeer.data.transports)
			{
				transport.close();
			}

			// // If this is the latest Peer in the room, close the room.
			if (this._protooRoom.peers.length === 0)
			{
				logger.info(
					'last peer in the room left, closing the room [roomId:%s]',
					this._roomId);

				this.close();
			}
		});
	}

	async _handleProtooRequest(protooPeer, request, accept, reject)
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
				// Ensure the peer is not already joined.
				if (protooPeer.data.joined)
					throw new Error('peer already joined');

				const { displayName, rtpCapabilities } = request.data;

				if (typeof rtpCapabilities !== 'object')
					throw new TypeError('missing rtpCapabilities');

				// Store peer data into the protoo Peer data object.
				protooPeer.data.displayName = displayName;
				protooPeer.data.rtpCapabilities = rtpCapabilities;
				protooPeer.data.transports = new Map();
				protooPeer.data.producers = new Map();
				protooPeer.data.consumers = new Map();

				// Notify joined Peers about the new joining Peer.
				// Also, collect info about joined Peers and their Producers to reply
				// the joining Peer with them.
				const peerInfos = [];

				for (const peer of this._getJoinedPeers())
				{
					peer.notify(
						'newPeer',
						{
							peerId      : protooPeer.id,
							displayName : displayName
						})
						.catch(() => {});

					const peerInfo =
					{
						id          : peer.id,
						displayName : peer.displayName,
						producers   : []
					};

					for (const producer of peer.data.producers.values())
					{
						peerInfo.producers.push(
							{
								id            : producer.id,
								kind          : producer.kind,
								rtpParameters : producer.rtpParameters,
								appData       : producer.appData,
								canConsume    : this._mediasoupRouter.canConsume(
									{
										producerId : producer.id,
										rtpCapabilities
									})
							});
					}

					peerInfos.push(peerInfo);
				}

				// Mark this peer as joined.
				protooPeer.data.joined = true;

				accept({ peerInfos });

				break;
			}

			case 'changeDisplayName':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { displayName } = request.data;

				// Store the display name into the custom data Object of the protoo
				// Peer.
				protooPeer.data.displayName = displayName;

				// Notify other joined Peers.
				for (const peer of this._getJoinedPeers({ excludePeer: protooPeer }))
				{
					peer.notify(
						'peerDisplayNameChanged',
						{
							peerId      : protooPeer.id,
							displayName : displayName
						})
						.catch(() => {});
				}

				accept();

				break;
			}

			case 'createWebRtcTransport':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const transport = await this._mediasoupRouter.createWebRtcTransport(
					{
						listenIps : config.mediasoup.webRtcTransport.listenIps,
						enableTcp : true,
						preferUdp : true
					});

				// Store the WebRtcTransport into the protoo Peer data Object.
				protooPeer.data.transports.set(transport.id, transport);

				accept(
					{
						id             : transport.id,
						iceParameters  : transport.iceParameters,
						iceCandidates  : transport.iceCandidates,
						dtlsParameters : transport.dtlsParameters
					});

				// If set, apply max incoming bitrate limit.
				const { maxIncomingBitrate } = config.mediasoup.webRtcTransport;

				if (maxIncomingBitrate)
				{
					try { await transport.setMaxIncomingBitrate(maxIncomingBitrate); }
					catch (error) {}
				}

				break;
			}

			case 'connectWebRtcTransport':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { transportId, dtlsParameters } = request.data;
				const transport = protooPeer.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				await transport.connect({ dtlsParameters });

				accept();

				break;
			}

			case 'produce':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { transportId, kind, rtpParameters, appData } = request.data;
				const transport = protooPeer.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				const producer =
					await transport.produce({ kind, rtpParameters, appData });

				// Store the Producer into the protoo Peer data Object.
				protooPeer.data.producers.set(producer.id, producer);

				accept({ id: producer.id });

				break;
			}

			case 'pauseProducer':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { producerId } = request.data;
				const producer = protooPeer.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				await producer.pause();

				accept();

				break;
			}

			case 'resumeProducer':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { producerId } = request.data;
				const producer = protooPeer.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				await producer.resume();

				accept();

				break;
			}

			case 'startConsumer':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { consumerId } = request.data;
				const consumer = protooPeer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.start();

				accept();

				break;
			}

			case 'pauseConsumer':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { consumerId } = request.data;
				const consumer = protooPeer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.pause();

				accept();

				break;
			}

			case 'resumeConsumer':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { consumerId } = request.data;
				const consumer = protooPeer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.resume();

				accept();

				break;
			}

			case 'setConsumerPreferedLayers':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { consumerId, spatialLayer, temporalLayer } = request.data;
				const consumer = protooPeer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.setPreferredLayers({ spatialLayer, temporalLayer });

				accept();

				break;
			}

			case 'requestConsumerKeyFrame':
			{
				// Ensure the peer is joined.
				if (!protooPeer.data.joined)
					throw new Error('peer not yet joined');

				const { consumerId } = request.data;
				const consumer = protooPeer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.requestKeyFrame();

				accept();

				break;
			}

			default:
			{
				logger.error('unknown request.method "%s"', request.method);

				reject(500, `unknown request.method "${request.method}"`);
			}
		}
	}

	_getJoinedPeers({ excludePeer } = {})
	{
		return this._protooRoom.peers
			.find((peer) => peer.data.joined && peer !== excludePeer);
	}
}

module.exports = Room;
