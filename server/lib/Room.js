const EventEmitter = require('events').EventEmitter;
const protooServer = require('protoo-server');
const Logger = require('./Logger');
const config = require('../config');

const MAX_BITRATE = config.mediasoup.maxBitrate || 1000000;
const MIN_BITRATE = Math.min(50000, MAX_BITRATE);
const BITRATE_FACTOR = 0.75;

const logger = new Logger('Room');

class Room extends EventEmitter
{
	constructor(roomId, mediaServer, { forceH264 })
	{
		logger.info('constructor() [roomId:%s, forceH264:%s]', roomId, forceH264);

		super();
		this.setMaxListeners(Infinity);

		// Room ID.
		this._roomId = roomId;

		// Closed flag.
		this._closed = false;

		try
		{
			// Protoo Room instance.
			this._protooRoom = new protooServer.Room();

			let mediaCodecs;

			// Select codecs.
			if (!forceH264)
			{
				mediaCodecs = config.mediasoup.mediaCodecs;
			}
			else
			{
				mediaCodecs = config.mediasoup.mediaCodecs
					.filter((codec) => (
						codec.name.toLowerCase() !== 'vp8' &&
						codec.name.toLowerCase() !== 'vp9'
					));
			}

			// mediasoup Room instance.
			this._mediaRoom = mediaServer.Room(mediaCodecs);
		}
		catch (error)
		{
			this.close();

			throw error;
		}

		// Current max bitrate for all the participants.
		this._maxBitrate = MAX_BITRATE;

		// Current active speaker.
		// @type {mediasoup.Peer}
		this._currentActiveSpeaker = null;

		this._handleMediaRoom();
	}

	get id()
	{
		return this._roomId;
	}

	close()
	{
		logger.debug('close()');

		this._closed = true;

		// Close the protoo Room.
		if (this._protooRoom)
			this._protooRoom.close();

		// Close the mediasoup Room.
		if (this._mediaRoom)
			this._mediaRoom.close();

		// Emit 'close' event.
		this.emit('close');
	}

	logStatus()
	{
		if (!this._mediaRoom)
			return;

		logger.info(
			'logStatus() [roomId:%s, protoo peers:%s, mediasoup peers:%s]',
			this._roomId,
			this._protooRoom.peers.length,
			this._mediaRoom.peers.length);
	}

	handleConnection(peerName, transport)
	{
		logger.info('handleConnection() [peerName:%s]', peerName);

		if (this._protooRoom.hasPeer(peerName))
		{
			logger.warn(
				'handleConnection() | there is already a peer with same peerName, ' +
				'closing the previous one [peerName:%s]',
				peerName);

			const protooPeer = this._protooRoom.getPeer(peerName);

			protooPeer.close();
		}

		const protooPeer = this._protooRoom.createPeer(peerName, transport);

		this._handleProtooPeer(protooPeer);
	}

	_handleMediaRoom()
	{
		logger.debug('_handleMediaRoom()');

		const activeSpeakerDetector = this._mediaRoom.createActiveSpeakerDetector();

		activeSpeakerDetector.on('activespeakerchange', (activePeer) =>
		{
			if (activePeer)
			{
				logger.info('new active speaker [peerName:%s]', activePeer.name);

				this._currentActiveSpeaker = activePeer;

				const activeVideoProducer = activePeer.producers
					.find((producer) => producer.kind === 'video');

				for (const peer of this._mediaRoom.peers)
				{
					for (const consumer of peer.consumers)
					{
						if (consumer.kind !== 'video')
							continue;

						if (consumer.source === activeVideoProducer)
						{
							consumer.setPreferredProfile('high');
						}
						else
						{
							consumer.setPreferredProfile('low');
						}
					}
				}
			}
			else
			{
				logger.info('no active speaker');

				this._currentActiveSpeaker = null;

				for (const peer of this._mediaRoom.peers)
				{
					for (const consumer of peer.consumers)
					{
						if (consumer.kind !== 'video')
							continue;

						consumer.setPreferredProfile('low');
					}
				}
			}

			// Spread to others via protoo.
			this._protooRoom.spread(
				'active-speaker',
				{
					peerName : activePeer ? activePeer.name : null
				});
		});
	}

	_handleProtooPeer(protooPeer)
	{
		logger.debug('_handleProtooPeer() [peer:%s]', protooPeer.id);

		protooPeer.on('request', (request, accept, reject) =>
		{
			logger.debug(
				'protoo "request" event [method:%s, peer:%s]',
				request.method, protooPeer.id);

			switch (request.method)
			{
				case 'mediasoup-request':
				{
					const mediasoupRequest = request.data;

					this._handleMediasoupClientRequest(
						protooPeer, mediasoupRequest, accept, reject);

					break;
				}

				case 'mediasoup-notification':
				{
					accept();

					const mediasoupNotification = request.data;

					this._handleMediasoupClientNotification(
						protooPeer, mediasoupNotification);

					break;
				}

				case 'change-display-name':
				{
					accept();

					const { displayName } = request.data;
					const { mediaPeer } = protooPeer.data;
					const oldDisplayName = mediaPeer.appData.displayName;

					mediaPeer.appData.displayName = displayName;

					// Spread to others via protoo.
					this._protooRoom.spread(
						'display-name-changed',
						{
							peerName       : protooPeer.id,
							displayName    : displayName,
							oldDisplayName : oldDisplayName
						},
						[ protooPeer ]);

					break;
				}

				case 'change-consumer-preferred-profile':
				{
					const { consumerId, profile } = request.data;
					const { mediaPeer } = protooPeer.data;
					const consumer = mediaPeer.consumers
						.find((_consumer) => _consumer.id === consumerId);

					if (!consumer)
					{
						logger.warn('consumer with id "%s" not found', consumerId);

						reject(404, 'consumer not found');

						return;
					}

					consumer.setPreferredProfile(profile);

					accept();

					break;
				}

				case 'request-consumer-keyframe':
				{
					const { consumerId } = request.data;
					const { mediaPeer } = protooPeer.data;
					const consumer = mediaPeer.consumers
						.find((_consumer) => _consumer.id === consumerId);

					if (!consumer)
					{
						logger.warn('consumer with id "%s" not found', consumerId);

						reject(404, 'consumer not found');

						return;
					}

					consumer.requestKeyFrame();

					accept();

					break;
				}

				default:
				{
					logger.error('unknown request.method "%s"', request.method);

					reject(400, `unknown request.method "${request.method}"`);
				}
			}
		});

		protooPeer.on('close', () =>
		{
			logger.debug('protoo Peer "close" event [peer:%s]', protooPeer.id);

			const { mediaPeer } = protooPeer.data;

			if (mediaPeer && !mediaPeer.closed)
				mediaPeer.close();

			// If this is the latest peer in the room, close the room.
			if (this._mediaRoom && this._mediaRoom.closed)
				return;

			if (this._mediaRoom.peers.length === 0)
			{
				logger.info(
					'last peer in the room left, closing the room [roomId:%s]',
					this._roomId);

				this.close();
			}
		});
	}

	_handleMediaPeer(protooPeer, mediaPeer)
	{
		mediaPeer.on('notify', (notification) =>
		{
			protooPeer.send('mediasoup-notification', notification)
				.catch(() => {});
		});

		mediaPeer.on('newtransport', (transport) =>
		{
			logger.info(
				'mediaPeer "newtransport" event [peer.name:%s, transport.id:%s, direction:%s]',
				mediaPeer.name, transport.id, transport.direction);

			// Update peers max sending  bitrate.
			if (transport.direction === 'send')
			{
				this._updateMaxBitrate();

				transport.on('close', () =>
				{
					this._updateMaxBitrate();
				});
			}

			this._handleMediaTransport(transport);
		});

		mediaPeer.on('newproducer', (producer) =>
		{
			logger.info(
				'mediaPeer "newproducer" event [peer.name:%s, id:%s]',
				mediaPeer.name, producer.id);

			this._handleMediaProducer(producer);
		});

		mediaPeer.on('newconsumer', (consumer) =>
		{
			logger.info(
				'mediaPeer "newconsumer" event [peer.name:%s, id:%s]',
				mediaPeer.name, consumer.id);

			this._handleMediaConsumer(consumer);
		});

		// Also handle already existing Consumers.
		for (const consumer of mediaPeer.consumers)
		{
			logger.debug(
				'mediaPeer existing "consumer" [peer.name:%s, id:%s]',
				mediaPeer.name, consumer.id);

			this._handleMediaConsumer(consumer);
		}

		// Notify about the existing active speaker.
		if (this._currentActiveSpeaker)
		{
			protooPeer.send(
				'active-speaker',
				{
					peerName : this._currentActiveSpeaker.name
				})
				.catch(() => {});
		}
	}

	_handleMediaTransport(transport)
	{
		transport.on('close', (originator) =>
		{
			logger.info(
				'Transport "close" event [id:%s, originator:%s]', transport.id, originator);
		});
	}

	_handleMediaProducer(producer)
	{
		producer.on('close', (originator) =>
		{
			logger.info(
				'Producer "close" event [id:%s, originator:%s]', producer.id, originator);
		});

		producer.on('pause', (originator) =>
		{
			logger.info(
				'Producer "pause" event [id:%s, originator:%s]', producer.id, originator);
		});

		producer.on('resume', (originator) =>
		{
			logger.info(
				'Producer "resume" event [id:%s, originator:%s]', producer.id, originator);
		});
	}

	_handleMediaConsumer(consumer)
	{
		consumer.on('close', (originator) =>
		{
			logger.info(
				'Consumer "close" event [id:%s, originator:%s]', consumer.id, originator);
		});

		consumer.on('pause', (originator) =>
		{
			logger.info(
				'Consumer "pause" event [id:%s, originator:%s]', consumer.id, originator);
		});

		consumer.on('resume', (originator) =>
		{
			logger.info(
				'Consumer "resume" event [id:%s, originator:%s]', consumer.id, originator);
		});

		if (consumer.kind === 'video')
		{
			consumer.on('effectiveprofilechange', (profile) =>
			{
				logger.info(
					'Consumer "effectiveprofilechange" event [id:%s, profile:%s]',
					consumer.id, profile);
			});
		}

		// If video, initially make it 'low' profile unless this is for the current
		// active speaker.
		if (consumer.kind === 'video' && consumer.peer !== this._currentActiveSpeaker)
			consumer.setPreferredProfile('low');
	}

	_handleMediasoupClientRequest(protooPeer, request, accept, reject)
	{
		logger.debug(
			'mediasoup-client request [method:%s, peer:%s]',
			request.method, protooPeer.id);

		switch (request.method)
		{
			case 'queryRoom':
			{
				this._mediaRoom.receiveRequest(request)
					.then((response) => accept(response))
					.catch((error) => reject(500, error.toString()));

				break;
			}

			case 'join':
			{
				// TODO: Handle appData. Yes?
				const { peerName } = request;

				if (peerName !== protooPeer.id)
				{
					reject(403, 'that is not your corresponding mediasoup Peer name');

					break;
				}
				else if (protooPeer.data.mediaPeer)
				{
					reject(500, 'already have a mediasoup Peer');

					break;
				}

				this._mediaRoom.receiveRequest(request)
					.then((response) =>
					{
						accept(response);

						// Get the newly created mediasoup Peer.
						const mediaPeer = this._mediaRoom.getPeerByName(peerName);

						protooPeer.data.mediaPeer = mediaPeer;

						this._handleMediaPeer(protooPeer, mediaPeer);
					})
					.catch((error) =>
					{
						reject(500, error.toString());
					});

				break;
			}

			default:
			{
				const { mediaPeer } = protooPeer.data;

				if (!mediaPeer)
				{
					logger.error(
						'cannot handle mediasoup request, no mediasoup Peer [method:%s]',
						request.method);

					reject(400, 'no mediasoup Peer');
				}

				// TODO: Temporal to catch a possible bug.
				if (request.method === 'createTransport')
				{
					logger.info(
						'"createTransport" request [peer.name:%s, transport.id:%s, direction:%s]',
						mediaPeer.name, request.id, request.direction);
				}

				mediaPeer.receiveRequest(request)
					.then((response) => accept(response))
					.catch((error) => reject(500, error.toString()));
			}
		}
	}

	_handleMediasoupClientNotification(protooPeer, notification)
	{
		logger.debug(
			'mediasoup-client notification [method:%s, peer:%s]',
			notification.method, protooPeer.id);

		// NOTE: mediasoup-client just sends notifications with target 'peer',
		// so first of all, get the mediasoup Peer.
		const { mediaPeer } = protooPeer.data;

		if (!mediaPeer)
		{
			logger.error(
				'cannot handle mediasoup notification, no mediasoup Peer [method:%s]',
				notification.method);

			return;
		}

		mediaPeer.receiveNotification(notification);
	}

	_updateMaxBitrate()
	{
		if (this._mediaRoom.closed)
			return;

		const numPeers = this._mediaRoom.peers.length;
		const previousMaxBitrate = this._maxBitrate;
		let newMaxBitrate;

		if (numPeers <= 2)
		{
			newMaxBitrate = MAX_BITRATE;
		}
		else
		{
			newMaxBitrate = Math.round(MAX_BITRATE / ((numPeers - 1) * BITRATE_FACTOR));

			if (newMaxBitrate < MIN_BITRATE)
				newMaxBitrate = MIN_BITRATE;
		}

		this._maxBitrate = newMaxBitrate;

		for (const peer of this._mediaRoom.peers)
		{
			for (const transport of peer.transports)
			{
				if (transport.direction === 'send')
				{
					transport.setMaxBitrate(newMaxBitrate)
						.catch((error) =>
						{
							logger.error('transport.setMaxBitrate() failed: %s', String(error));
						});
				}
			}
		}

		logger.info(
			'_updateMaxBitrate() [num peers:%s, before:%skbps, now:%skbps]',
			numPeers,
			Math.round(previousMaxBitrate / 1000),
			Math.round(newMaxBitrate / 1000));
	}
}

module.exports = Room;
