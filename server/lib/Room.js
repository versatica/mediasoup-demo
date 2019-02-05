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
			'logStatus() [roomId:%s, protoo Peers:%s, mediasoup Transports:%s]',
			this._roomId,
			this._protooRoom.peers.length,
			this._mediasoupRouter._transports.size); // NOTE: Private API.
	}

	handleProtooConnection({ peerId, protooWebSocketTransport })
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

		try
		{
			peer = this._protooRoom.createPeer(peerId, protooWebSocketTransport);
		}
		catch (error)
		{
			logger.error('protooRoom.createPeer() failed:%o', error);
		}

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

			// Notify other joined Peers.
			for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
			{
				otherPeer.notify('peerClosed', { peerId: peer.id })
					.catch(() => {});
			}

			// Iterate and close all mediasoup Transport associated to this Peer, so all
			// its Producers and Consumers will also be closed.
			for (const transport of peer.data.transports)
			{
				transport.close();
			}

			// // If this is the latest Peer in the room, close the room.
			if (this._protooRoom.peers.length === 0)
			{
				logger.info(
					'last Peer in the room left, closing the room [roomId:%s]',
					this._roomId);

				this.close();
			}
		});
	}

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

				const { displayName, rtpCapabilities } = request.data;

				if (typeof rtpCapabilities !== 'object')
					throw new TypeError('missing rtpCapabilities');

				// Store client data into the protoo Peer data object.
				peer.data.displayName = displayName;
				peer.data.rtpCapabilities = rtpCapabilities;
				peer.data.transports = new Map();
				peer.data.producers = new Map();
				peer.data.consumers = new Map();

				// Collect info about joined Peers and their Producers to reply
				// the joining Peer with them.
				const otherPeerInfos = [];

				for (const otherPeer of this._getJoinedPeers())
				{
					const otherPeerInfo =
					{
						id          : otherPeer.id,
						displayName : otherPeer.data.displayName,
						producers   : Array.from(otherPeer.data.producers)
							.map((producer) => (
								{
									id         : producer.id,
									kind       : producer.kind,
									appData    : producer.appData,
									consumable : this._mediasoupRouter.canConsume(
										{
											producerId      : producer.id,
											rtpCapabilities : peer.data.rtpCapabilities
										})
								}
							))
					};

					otherPeerInfos.push(otherPeerInfo);
				}

				// Accept the new Peer and reply him with the list of other Peers and
				// their Producers.
				accept({ peers: otherPeerInfos });

				// Mark the new Peer as joined.
				peer.data.joined = true;

				// Notify the new Peer to all other Peers.
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					otherPeer.notify(
						'newPeer',
						{
							peerId      : peer.id,
							displayName : peer.data.displayName
						})
						.catch(() => {});
				}

				break;
			}

			case 'changeDisplayName':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { displayName } = request.data;

				// Store the display name into the custom data Object of the protoo
				// Peer.
				peer.data.displayName = displayName;

				// Notify other joined Peers.
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					otherPeer.notify(
						'peerDisplayNameChanged',
						{
							peerId      : peer.id,
							displayName : displayName
						})
						.catch(() => {});
				}

				accept();

				break;
			}

			case 'createWebRtcTransport':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const transport = await this._mediasoupRouter.createWebRtcTransport(
					{
						listenIps : config.mediasoup.webRtcTransport.listenIps,
						enableTcp : true,
						preferUdp : true
					});

				// Store the WebRtcTransport into the protoo Peer data Object.
				peer.data.transports.set(transport.id, transport);

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
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { transportId, dtlsParameters } = request.data;
				const transport = peer.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				await transport.connect({ dtlsParameters });

				accept();

				break;
			}

			case 'produce':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { transportId, kind, rtpParameters, appData } = request.data;
				const transport = peer.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				const producer =
					await transport.produce({ kind, rtpParameters, appData });

				// Store the Producer into the protoo Peer data Object.
				peer.data.producers.set(producer.id, producer);

				accept({ id: producer.id });

				// Notify the new Producer to all other Peers.
				for (const otherPeer of this._getJoinedPeers({ excludePeer: peer }))
				{
					otherPeer.notify(
						'newProducer',
						{
							peerId   : peer.id,
							producer :
							{
								id         : producer.id,
								kind       : producer.kind,
								appData    : producer.appData,
								consumable : this._mediasoupRouter.canConsume(
									{
										producerId      : producer.id,
										rtpCapabilities : otherPeer.data.rtpCapabilities
									})
							}
						})
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
				const producer = peer.producers.get(producerId);

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
				const producer = peer.producers.get(producerId);

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
				const producer = peer.producers.get(producerId);

				if (!producer)
					throw new Error(`producer with id "${producerId}" not found`);

				await producer.resume();

				accept();

				break;
			}

			case 'consume':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { transportId, producerId } = request.data;
				const transport = peer.transports.get(transportId);

				if (!transport)
					throw new Error(`transport with id "${transportId}" not found`);

				const consumer = await transport.consume(
					{
						producerId,
						rtpCapabilities : peer.data.rtpCapabilities
					});

				// Store the Consumer into the protoo Peer data Object.
				peer.data.consumers.set(consumer.id, consumer);

				// Reply the peer with the server-side Consumer data.
				accept(
					{
						id            : consumer.id,
						kind          : consumer.kind,
						rtpParameters : consumer.rtpParameters
					});

				consumer.on('transportclose', () =>
				{
					// Remove from its map.
					peer.data.consumers.delete(consumer.id);
				});

				consumer.on('producerclose', () =>
				{
					// Remove from its map.
					peer.data.consumers.delete(consumer.id);

					peer.notify('consumerClosed', { consumerId: consumer.id })
						.catch(() => {});
				});

				consumer.on('producerpause', () =>
				{
					peer.notify('consumerPaused', { consumerId: consumer.id })
						.catch(() => {});
				});

				consumer.on('producerresume', () =>
				{
					peer.notify('consumerResumed', { consumerId: consumer.id })
						.catch(() => {});
				});

				consumer.on('layerschange', (layers) =>
				{
					peer.notify('consumerLayersChanged', { consumerId: consumer.id, layers })
						.catch(() => {});
				});

				break;
			}

			case 'startConsumer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.start();

				accept();

				break;
			}

			case 'closeConsumer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				consumer.close();

				// Remove from its map.
				peer.data.consumers.delete(consumer.id);

				accept();

				break;
			}

			case 'pauseConsumer':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.consumers.get(consumerId);

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
				const consumer = peer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.resume();

				accept();

				break;
			}

			case 'setConsumerPreferedLayers':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId, spatialLayer, temporalLayer } = request.data;
				const consumer = peer.consumers.get(consumerId);

				if (!consumer)
					throw new Error(`consumer with id "${consumerId}" not found`);

				await consumer.setPreferredLayers({ spatialLayer, temporalLayer });

				accept();

				break;
			}

			case 'requestConsumerKeyFrame':
			{
				// Ensure the Peer is joined.
				if (!peer.data.joined)
					throw new Error('Peer not yet joined');

				const { consumerId } = request.data;
				const consumer = peer.consumers.get(consumerId);

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
