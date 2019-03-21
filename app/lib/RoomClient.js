import protooClient from 'protoo-client';
import * as mediasoupClient from 'mediasoup-client';
import Logger from './Logger';
import { getProtooUrl } from './urlFactory';
import * as cookiesManager from './cookiesManager';
import * as requestActions from './redux/requestActions';
import * as stateActions from './redux/stateActions';

const VIDEO_CONSTRAINS =
{
	qvga : { width: { ideal: 320 }, height: { ideal: 240 } },
	vga  : { width: { ideal: 640 }, height: { ideal: 480 } },
	hd   : { width: { ideal: 1280 }, height: { ideal: 720 } }
};

const VIDEO_ENCODINGS =
[
	{ maxBitrate: 100000 },
	{ maxBitrate: 300000 },
	{ maxBitrate: 900000 }
];

const EXTERNAL_VIDEO_SRC = '/resources/videos/video-audio-stereo.mp4';

const logger = new Logger('RoomClient');

let store;

export default class RoomClient
{
	/**
	 * @param  {Object} data
	 * @param  {Object} data.store - The Redux store.
	 */
	static init(data)
	{
		store = data.store;
	}

	constructor(
		{
			roomId,
			peerId,
			displayName,
			device,
			useSimulcast,
			forceTcp,
			spy,
			forceH264,
			externalVideo
		}
	)
	{
		logger.debug(
			'constructor() [roomId:"%s", peerId:"%s", displayName:"%s", device:%s]',
			roomId, peerId, displayName, device.flag);

		// Closed flag.
		// @type {Boolean}
		this._closed = false;

		// Display name.
		// @type {String}
		this._displayName = displayName;

		// Device info.
		// @type {Object}
		this._device = device;

		// Whether we want to force RTC over TCP.
		// @type {Boolean}
		this._forceTcp = forceTcp;

		// Whether we should be a spy.
		// @type {Boolean}
		this._spy = spy;

		// Whether we want to force H264 codec.
		// @type {Boolean}
		this._forceH264 = forceH264;

		// External video.
		// @type {HTMLVideoElement}
		this._externalVideo = null;

		// MediaStream of the external video.
		// @type {MediaStream}
		this._externalVideoStream = null;

		if (externalVideo)
		{
			this._externalVideo = document.createElement('video');

			this._externalVideo.controls = true;
			this._externalVideo.muted = true;
			this._externalVideo.loop = true;
			this._externalVideo.setAttribute('playsinline', '');
			this._externalVideo.src = EXTERNAL_VIDEO_SRC;

			this._externalVideo.play()
				.catch((error) => logger.warn('externalVideo.play() failed:%o', error));
		}

		// Whether simulcast should be used.
		// @type {Boolean}
		this._useSimulcast = useSimulcast;

		// Protoo URL.
		// @type {String}
		this._protooUrl = getProtooUrl({ roomId, peerId, forceH264 });

		// protoo-client Peer instance.
		// @type {protooClient.Peer}
		this._protoo = null;

		// mediasoup-client Device instance.
		// @type {mediasoupClient.Device}
		this._mediasoupDevice = null;

		// mediasoup Transport for sending.
		// @type {mediasoupClient.Transport}
		this._sendTransport = null;

		// mediasoup Transport for receiving.
		// @type {mediasoupClient.Transport}
		this._recvTransport = null;

		// Local mic mediasoup Producer.
		// @type {mediasoupClient.Producer}
		this._micProducer = null;

		// Local webcam mediasoup Producer.
		// @type {mediasoupClient.Producer}
		this._webcamProducer = null;

		// mediasoup Consumers.
		// @type {Map<String, mediasoupClient.Consumer>}
		this._consumers = new Map();

		// Map of webcam MediaDeviceInfos indexed by deviceId.
		// @type {Map<String, MediaDeviceInfos>}
		this._webcams = new Map();

		// Local Webcam.
		// @type {Object} with:
		// - {MediaDeviceInfo} [device]
		// - {String} [resolution] - 'qvga' / 'vga' / 'hd'.
		this._webcam =
		{
			device     : null,
			resolution : 'hd'
		};
	}

	close()
	{
		if (this._closed)
			return;

		this._closed = true;

		logger.debug('close()');

		// Close protoo Peer
		this._protoo.close();

		// Close mediasoup Transports.
		if (this._sendTransport)
			this._sendTransport.close();

		if (this._recvTransport)
			this._recvTransport.close();

		store.dispatch(
			stateActions.setRoomState('closed'));
	}

	async join()
	{
		const protooTransport = new protooClient.WebSocketTransport(this._protooUrl);

		this._protoo = new protooClient.Peer(protooTransport);

		store.dispatch(
			stateActions.setRoomState('connecting'));

		this._protoo.on('open', () => this._joinRoom());

		this._protoo.on('failed', () =>
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'WebSocket connection failed'
				}));
		});

		this._protoo.on('disconnected', () =>
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : 'WebSocket disconnected'
				}));

			// Close mediasoup Transports.
			if (this._sendTransport)
			{
				this._sendTransport.close();
				this._sendTransport = null;
			}

			if (this._recvTransport)
			{
				this._recvTransport.close();
				this._recvTransport = null;
			}

			store.dispatch(
				stateActions.setRoomState('closed'));
		});

		this._protoo.on('close', () =>
		{
			if (this._closed)
				return;

			this.close();
		});

		// eslint-disable-next-line no-unused-vars
		this._protoo.on('request', async (request, accept, reject) =>
		{
			logger.debug(
				'proto "request" event [method:%s, data:%o]',
				request.method, request.data);

			switch (request.method)
			{
				case 'newConsumer':
				{
					const {
						peerId,
						producerId,
						id,
						kind,
						rtpParameters,
						type,
						appData,
						producerPaused
					} = request.data;

					let codecOptions;

					if (kind === 'audio')
					{
						codecOptions =
						{
							opusStereo : 1
						};
					}

					const consumer = await this._recvTransport.consume(
						{
							id,
							producerId,
							kind,
							rtpParameters,
							codecOptions,
							appData : { ...appData, peerId } // Trick.
						});

					// Store in the map.
					this._consumers.set(consumer.id, consumer);

					consumer.on('transportclose', () =>
					{
						this._consumers.delete(consumer.id);
					});

					store.dispatch(stateActions.addConsumer(
						{
							id             : consumer.id,
							type           : type,
							locallyPaused  : false,
							remotelyPaused : producerPaused,
							rtpParameters  : consumer.rtpParameters,
							track          : consumer.track,
							codec          : consumer.rtpParameters.codecs[0].mimeType.split('/')[1]
						},
						peerId));

					// We are ready. Answer the protoo request so the server will
					// resume this Consumer (which was paused for now).
					accept();

					// If audio-only mode is enabled, pause it.
					if (consumer.kind === 'video' && store.getState().me.audioOnly)
						this._pauseConsumer(consumer);

					break;
				}
			}
		});

		this._protoo.on('notification', (notification) =>
		{
			logger.debug(
				'proto "notification" event [method:%s, data:%o]',
				notification.method, notification.data);

			switch (notification.method)
			{
				case 'producerScore':
				{
					const { producerId, score } = notification.data;

					store.dispatch(
						stateActions.setProducerScore(producerId, score));

					break;
				}

				case 'newPeer':
				{
					const peer = notification.data;

					store.dispatch(
						stateActions.addPeer({ ...peer, consumers: [] }));

					store.dispatch(requestActions.notify(
						{
							text : `${peer.displayName} has joined the room`
						}));

					break;
				}

				case 'peerClosed':
				{
					const { peerId } = notification.data;

					store.dispatch(
						stateActions.removePeer(peerId));

					break;
				}

				case 'peerDisplayNameChanged':
				{
					const { peerId, displayName, oldDisplayName } = notification.data;

					store.dispatch(
						stateActions.setPeerDisplayName(displayName, peerId));

					store.dispatch(requestActions.notify(
						{
							text : `${oldDisplayName} is now ${displayName}`
						}));

					break;
				}

				case 'consumerClosed':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					consumer.close();
					this._consumers.delete(consumerId);

					const { peerId } = consumer.appData;

					store.dispatch(
						stateActions.removeConsumer(consumerId, peerId));

					break;
				}

				case 'consumerPaused':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					store.dispatch(
						stateActions.setConsumerPaused(consumerId, 'remote'));

					break;
				}

				case 'consumerResumed':
				{
					const { consumerId } = notification.data;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					store.dispatch(
						stateActions.setConsumerResumed(consumerId, 'remote'));

					break;
				}

				case 'consumerLayersChanged':
				{
					const { consumerId, layers } = notification.data;
					const { spatialLayer } = layers;
					const consumer = this._consumers.get(consumerId);

					if (!consumer)
						break;

					store.dispatch(
						stateActions.setConsumerCurrentSpatialLayer(consumerId, spatialLayer));

					break;
				}

				case 'consumerScore':
				{
					const { consumerId, score } = notification.data;

					store.dispatch(
						stateActions.setConsumerScore(consumerId, score));

					break;
				}

				case 'activeSpeaker':
				{
					const { peerId } = notification.data;

					store.dispatch(
						stateActions.setRoomActiveSpeaker(peerId));

					break;
				}

				default:
				{
					logger.error(
						'unknown protoo notification.method "%s"', notification.method);
				}
			}
		});
	}

	async enableMic()
	{
		logger.debug('enableMic()');

		if (this._micProducer)
			return;

		if (!this._mediasoupDevice.canProduce('audio'))
		{
			logger.error('enableMic() | cannot produce audio');

			return;
		}

		let track;

		try
		{
			if (!this._externalVideo)
			{
				logger.debug('enableMic() | calling getUserMedia()');

				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

				track = stream.getAudioTracks()[0];
			}
			else
			{
				const stream = await this._getExternalVideoStream();

				track = stream.getAudioTracks()[0].clone();
			}

			this._micProducer = await this._sendTransport.produce(
				{
					track,
					codecOptions :
					{
						opusStereo : 1,
						opusDtx    : 1
					}
				});

			store.dispatch(stateActions.addProducer(
				{
					id            : this._micProducer.id,
					paused        : this._micProducer.paused,
					track         : this._micProducer.track,
					rtpParameters : this._micProducer.rtpParameters,
					codec         : this._micProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
				}));

			this._micProducer.on('transportclose', () =>
			{
				this._micProducer = null;
			});

			this._micProducer.on('trackended', () =>
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : 'Microphone disconnected!'
					}));

				this.disableMic()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableMic() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error enabling microphone: ${error}`
				}));

			if (track)
				track.stop();
		}
	}

	async disableMic()
	{
		logger.debug('disableMic()');

		if (!this._micProducer)
			return;

		this._micProducer.close();

		store.dispatch(
			stateActions.removeProducer(this._micProducer.id));

		try
		{
			await this._protoo.request(
				'closeProducer', { producerId: this._micProducer.id });
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error closing server-side mic Producer: ${error}`
				}));
		}

		this._micProducer = null;
	}

	async muteMic()
	{
		logger.debug('muteMic()');

		this._micProducer.pause();

		try
		{
			await this._protoo.request(
				'pauseProducer', { producerId: this._micProducer.id });

			store.dispatch(
				stateActions.setProducerPaused(this._micProducer.id));
		}
		catch (error)
		{
			logger.error('muteMic() | failed: %o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error pausing server-side mic Producer: ${error}`
				}));
		}
	}

	async unmuteMic()
	{
		logger.debug('unmuteMic()');

		this._micProducer.resume();

		try
		{
			await this._protoo.request(
				'resumeProducer', { producerId: this._micProducer.id });

			store.dispatch(
				stateActions.setProducerResumed(this._micProducer.id));
		}
		catch (error)
		{
			logger.error('unmuteMic() | failed: %o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error resuming server-side mic Producer: ${error}`
				}));
		}
	}

	async enableWebcam()
	{
		logger.debug('enableWebcam()');

		if (this._webcamProducer)
			return;

		if (!this._mediasoupDevice.canProduce('video'))
		{
			logger.error('enableWebcam() | cannot produce video');

			return;
		}

		let track;
		let device;

		store.dispatch(
			stateActions.setWebcamInProgress(true));

		try
		{
			if (!this._externalVideo)
			{
				await this._updateWebcams();
				device = this._webcam.device;

				const { resolution } = this._webcam;

				if (!device)
					throw new Error('no webcam devices');

				logger.debug('enableWebcam() | calling getUserMedia()');

				const stream = await navigator.mediaDevices.getUserMedia(
					{
						video :
						{
							deviceId : { exact: device.deviceId },
							...VIDEO_CONSTRAINS[resolution]
						}
					});

				track = stream.getVideoTracks()[0];
			}
			else
			{
				device = { label: 'external video' };

				const stream = await this._getExternalVideoStream();

				track = stream.getVideoTracks()[0].clone();
			}

			if (this._useSimulcast)
			{
				this._webcamProducer = await this._sendTransport.produce(
					{
						track,
						encodings    : VIDEO_ENCODINGS,
						codecOptions :
						{
							videoGoogleStartBitrate : 1000
						}
					});
			}
			else
			{
				this._webcamProducer = await this._sendTransport.produce({ track });
			}

			store.dispatch(stateActions.addProducer(
				{
					id            : this._webcamProducer.id,
					deviceLabel   : device.label,
					type          : this._getWebcamType(device),
					paused        : this._webcamProducer.paused,
					track         : this._webcamProducer.track,
					rtpParameters : this._webcamProducer.rtpParameters,
					codec         : this._webcamProducer.rtpParameters.codecs[0].mimeType.split('/')[1]
				}));

			this._webcamProducer.on('transportclose', () =>
			{
				this._webcamProducer = null;
			});

			this._webcamProducer.on('trackended', () =>
			{
				store.dispatch(requestActions.notify(
					{
						type : 'error',
						text : 'Webcam disconnected!'
					}));

				this.disableWebcam()
					.catch(() => {});
			});
		}
		catch (error)
		{
			logger.error('enableWebcam() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error enabling webcam: ${error}`
				}));

			if (track)
				track.stop();
		}

		store.dispatch(
			stateActions.setWebcamInProgress(false));
	}

	async disableWebcam()
	{
		logger.debug('disableWebcam()');

		if (!this._webcamProducer)
			return;

		this._webcamProducer.close();

		store.dispatch(
			stateActions.removeProducer(this._webcamProducer.id));

		try
		{
			await this._protoo.request(
				'closeProducer', { producerId: this._webcamProducer.id });
		}
		catch (error)
		{
			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error closing server-side webcam Producer: ${error}`
				}));
		}

		this._webcamProducer = null;
	}

	async changeWebcam()
	{
		logger.debug('changeWebcam()');

		store.dispatch(
			stateActions.setWebcamInProgress(true));

		try
		{
			await this._updateWebcams();

			const array = Array.from(this._webcams.keys());
			const len = array.length;
			const deviceId =
				this._webcam.device ? this._webcam.device.deviceId : undefined;
			let idx = array.indexOf(deviceId);

			if (idx < len - 1)
				idx++;
			else
				idx = 0;

			this._webcam.device = this._webcams.get(array[idx]);

			logger.debug(
				'changeWebcam() | new selected webcam [device:%o]',
				this._webcam.device);

			// Reset video resolution to HD.
			this._webcam.resolution = 'hd';

			if (!this._webcam.device)
				throw new Error('no webcam devices');

			// Closing the current video track before asking for a new one (mobiles do not like
			// having both front/back cameras open at the same time).
			this._webcamProducer.track.stop();

			logger.debug('changeWebcam() | calling getUserMedia()');

			const stream = await navigator.mediaDevices.getUserMedia(
				{
					video :
					{
						deviceId : { exact: this._webcam.device.deviceId },
						...VIDEO_CONSTRAINS[this._webcam.resolution]
					}
				});

			const track = stream.getVideoTracks()[0];

			await this._webcamProducer.replaceTrack({ track });

			store.dispatch(
				stateActions.setProducerTrack(this._webcamProducer.id, track));
		}
		catch (error)
		{
			logger.error('changeWebcam() | failed: %o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Could not change webcam: ${error}`
				}));
		}

		store.dispatch(
			stateActions.setWebcamInProgress(false));
	}

	async changeWebcamResolution()
	{
		logger.debug('changeWebcamResolution()');

		store.dispatch(
			stateActions.setWebcamInProgress(true));

		try
		{
			switch (this._webcam.resolution)
			{
				case 'qvga':
					this._webcam.resolution = 'vga';
					break;
				case 'vga':
					this._webcam.resolution = 'hd';
					break;
				case 'hd':
					this._webcam.resolution = 'qvga';
					break;
				default:
					this._webcam.resolution = 'hd';
			}

			logger.debug('changeWebcamResolution() | calling getUserMedia()');

			const stream = await navigator.mediaDevices.getUserMedia(
				{
					video :
					{
						deviceId : { exact: this._webcam.device.deviceId },
						...VIDEO_CONSTRAINS[this._webcam.resolution]
					}
				});

			const track = stream.getVideoTracks()[0];

			await this._webcamProducer.replaceTrack({ track });

			store.dispatch(
				stateActions.setProducerTrack(this._webcamProducer.id, track));
		}
		catch (error)
		{
			logger.error('changeWebcamResolution() | failed: %o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Could not change webcam resolution: ${error}`
				}));
		}

		store.dispatch(
			stateActions.setWebcamInProgress(false));
	}

	async enableAudioOnly()
	{
		logger.debug('enableAudioOnly()');

		store.dispatch(
			stateActions.setAudioOnlyInProgress(true));

		this.disableWebcam();

		for (const consumer of this._consumers.values())
		{
			if (consumer.kind !== 'video')
				continue;

			this._pauseConsumer(consumer);
		}

		store.dispatch(
			stateActions.setAudioOnlyState(true));

		store.dispatch(
			stateActions.setAudioOnlyInProgress(false));
	}

	async disableAudioOnly()
	{
		logger.debug('disableAudioOnly()');

		store.dispatch(
			stateActions.setAudioOnlyInProgress(true));

		if (
			!this._webcamProducer &&
			!this._spy &&
			(cookiesManager.getDevices() || {}).webcamEnabled
		)
		{
			this.enableWebcam();
		}

		for (const consumer of this._consumers.values())
		{
			if (consumer.kind !== 'video')
				continue;

			this._resumeConsumer(consumer);
		}

		store.dispatch(
			stateActions.setAudioOnlyState(false));

		store.dispatch(
			stateActions.setAudioOnlyInProgress(false));
	}

	async muteAudio()
	{
		logger.debug('muteAudio()');

		store.dispatch(
			stateActions.setAudioMutedState(true));
	}

	async unmuteAudio()
	{
		logger.debug('unmuteAudio()');

		store.dispatch(
			stateActions.setAudioMutedState(false));
	}

	async restartIce()
	{
		logger.debug('restartIce()');

		store.dispatch(
			stateActions.setRestartIceInProgress(true));

		try
		{
			if (this._sendTransport)
			{
				const iceParameters = await this._protoo.request(
					'restartIce',
					{ transportId: this._sendTransport.id });

				await this._sendTransport.restartIce({ iceParameters });
			}

			if (this._recvTransport)
			{
				const iceParameters = await this._protoo.request(
					'restartIce',
					{ transportId: this._recvTransport.id });

				await this._recvTransport.restartIce({ iceParameters });
			}

			store.dispatch(requestActions.notify(
				{
					text : 'ICE restarted'
				}));
		}
		catch (error)
		{
			logger.error('restartIce() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `ICE restart failed: ${error}`
				}));
		}

		store.dispatch(
			stateActions.setRestartIceInProgress(false));
	}

	async setMaxSendingSpatialLayer(spatialLayer)
	{
		logger.debug('setMaxSendingSpatialLayer() [spatialLayer:%s]', spatialLayer);

		try
		{
			await this._webcamProducer.setMaxSpatialLayer(spatialLayer);
		}
		catch (error)
		{
			logger.error('setMaxSendingSpatialLayer() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error setting max sending video spatial layer: ${error}`
				}));
		}
	}

	async setConsumerPreferredSpatialLayer(consumerId, spatialLayer)
	{
		logger.debug(
			'changeConsumerPreferredSpatialLayer() [consumerId:%s, spatialLayer:%s]',
			consumerId, spatialLayer);

		try
		{
			await this._protoo.request(
				'setConsumerPreferedLayers', { consumerId, spatialLayer });

			store.dispatch(
				stateActions.setConsumerPreferredSpatialLayer(consumerId, spatialLayer));
		}
		catch (error)
		{
			logger.error('setConsumerPreferredSpatialLayer() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error setting Consumer preferred spatial layer: ${error}`
				}));
		}
	}

	async requestConsumerKeyFrame(consumerId)
	{
		logger.debug('requestConsumerKeyFrame() [consumerId:%s]', consumerId);

		try
		{
			await this._protoo.request('requestConsumerKeyFrame', { consumerId });

			store.dispatch(requestActions.notify(
				{
					text : 'Keyframe requested for video consumer'
				}));
		}
		catch (error)
		{
			logger.error('requestConsumerKeyFrame() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error requesting key frame for Consumer: ${error}`
				}));
		}
	}

	async changeDisplayName(displayName)
	{
		logger.debug('changeDisplayName() [displayName:"%s"]', displayName);

		// Store in cookie.
		cookiesManager.setUser({ displayName });

		try
		{
			await this._protoo.request('changeDisplayName', { displayName });

			this._displayName = displayName;

			store.dispatch(
				stateActions.setDisplayName(displayName));

			store.dispatch(requestActions.notify(
				{
					text : 'Display name changed'
				}));
		}
		catch (error)
		{
			logger.error('changeDisplayName() | failed: %o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Could not change display name: ${error}`
				}));

			// We need to refresh the component for it to render the previous
			// displayName again.
			store.dispatch(
				stateActions.setDisplayName());
		}
	}

	async getSendTransportRemoteStats()
	{
		logger.debug('getSendTransportRemoteStats()');

		if (!this._sendTransport)
			return;

		return this._protoo.request(
			'getTransportStats', { transportId: this._sendTransport.id });
	}

	async getRecvTransportRemoteStats()
	{
		logger.debug('getRecvTransportRemoteStats()');

		if (!this._recvTransport)
			return;

		return this._protoo.request(
			'getTransportStats', { transportId: this._recvTransport.id });
	}

	async getMicRemoteStats()
	{
		logger.debug('getMicRemoteStats()');

		if (!this._micProducer)
			return;

		return this._protoo.request(
			'getProducerStats', { producerId: this._micProducer.id });
	}

	async getWebcamRemoteStats()
	{
		logger.debug('getWebcamRemoteStats()');

		if (!this._webcamProducer)
			return;

		return this._protoo.request(
			'getProducerStats', { producerId: this._webcamProducer.id });
	}

	async getConsumerRemoteStats(consumerId)
	{
		logger.debug('getConsumerRemoteStats()');

		const consumer = this._consumers.get(consumerId);

		if (!consumer)
			return;

		return this._protoo.request('getConsumerStats', { consumerId });
	}

	async getSendTransportLocalStats()
	{
		logger.debug('getSendTransportLocalStats()');

		if (!this._sendTransport)
			return;

		return this._sendTransport.getStats();
	}

	async getRecvTransportLocalStats()
	{
		logger.debug('getRecvTransportLocalStats()');

		if (!this._recvTransport)
			return;

		return this._recvTransport.getStats();
	}

	async getMicLocalStats()
	{
		logger.debug('getMicLocalStats()');

		if (!this._micProducer)
			return;

		return this._micProducer.getStats();
	}

	async getWebcamLocalStats()
	{
		logger.debug('getWebcamLocalStats()');

		if (!this._webcamProducer)
			return;

		return this._webcamProducer.getStats();
	}

	async getConsumerLocalStats(consumerId)
	{
		const consumer = this._consumers.get(consumerId);

		if (!consumer)
			return;

		return consumer.getStats();
	}

	async _joinRoom()
	{
		logger.debug('_joinRoom()');

		try
		{
			this._mediasoupDevice = new mediasoupClient.Device();

			const routerRtpCapabilities =
				await this._protoo.request('getRouterRtpCapabilities');

			await this._mediasoupDevice.load({ routerRtpCapabilities });

			// NOTE: Stuff to play remote audios due to browsers' new autoplay policy.
			//
			// Just get access to the mic and DO NOT close the mic track for a while.
			// Super hack!
			{
				const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
				const audioTrack = stream.getAudioTracks()[0];

				audioTrack.enabled = false;

				setTimeout(() => audioTrack.stop(), 120000);
			}

			// Create mediasoup Transport for sending (unless we are spy).
			if (!this._spy)
			{
				const transportInfo = await this._protoo.request(
					'createWebRtcTransport',
					{
						forceTcp  : this._forceTcp,
						producing : true,
						consuming : false
					});

				const {
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters
				} = transportInfo;

				this._sendTransport = this._mediasoupDevice.createSendTransport(
					{
						id,
						iceParameters,
						iceCandidates,
						dtlsParameters
					});

				this._sendTransport.on(
					'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
					{
						this._protoo.request(
							'connectWebRtcTransport',
							{
								transportId : this._sendTransport.id,
								dtlsParameters
							})
							.then(callback)
							.catch(errback);
					});

				this._sendTransport.on(
					'produce', async ({ kind, rtpParameters, appData }, callback, errback) =>
					{
						try
						{
							// eslint-disable-next-line no-shadow
							const { id } = await this._protoo.request(
								'produce',
								{
									transportId : this._sendTransport.id,
									kind,
									rtpParameters,
									appData
								});

							callback({ id });
						}
						catch (error)
						{
							errback(error);
						}
					});
			}

			// Create mediasoup Transport for receiving.
			{
				const transportInfo = await this._protoo.request(
					'createWebRtcTransport',
					{
						forceTcp  : this._forceTcp,
						producing : false,
						consuming : true
					});

				const {
					id,
					iceParameters,
					iceCandidates,
					dtlsParameters
				} = transportInfo;

				this._recvTransport = this._mediasoupDevice.createRecvTransport(
					{
						id,
						iceParameters,
						iceCandidates,
						dtlsParameters
					});

				this._recvTransport.on(
					'connect', ({ dtlsParameters }, callback, errback) => // eslint-disable-line no-shadow
					{
						this._protoo.request(
							'connectWebRtcTransport',
							{
								transportId : this._recvTransport.id,
								dtlsParameters
							})
							.then(callback)
							.catch(errback);
					});
			}

			// Join now into the room.
			const { peers } = await this._protoo.request(
				'join',
				{
					displayName     : this._displayName,
					device          : this._device,
					rtpCapabilities : this._mediasoupDevice.rtpCapabilities
				});

			store.dispatch(
				stateActions.setRoomState('connected'));

			// Clean all the existing notifcations.
			store.dispatch(
				stateActions.removeAllNotifications());

			store.dispatch(requestActions.notify(
				{
					text    : 'You are in the room!',
					timeout : 3000
				}));

			for (const peer of peers)
			{
				store.dispatch(
					stateActions.addPeer({ ...peer, consumers: [] }));
			}

			// Enable mic/webcam.
			if (!this._spy)
			{
				// Set our media capabilities.
				store.dispatch(stateActions.setMediaCapabilities(
					{
						canSendMic    : this._mediasoupDevice.canProduce('audio'),
						canSendWebcam : this._mediasoupDevice.canProduce('video')
					}));

				this.enableMic();

				const devicesCookie = cookiesManager.getDevices();

				if (!devicesCookie || devicesCookie.webcamEnabled || this._externalVideo)
					this.enableWebcam();
			}
		}
		catch (error)
		{
			logger.error('_joinRoom() failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Could not join the room: ${error}`
				}));

			this.close();
		}
	}

	async _updateWebcams()
	{
		logger.debug('_updateWebcams()');

		// Reset the list.
		this._webcams = new Map();

		logger.debug('_updateWebcams() | calling enumerateDevices()');

		const devices = await navigator.mediaDevices.enumerateDevices();

		for (const device of devices)
		{
			if (device.kind !== 'videoinput')
				continue;

			this._webcams.set(device.deviceId, device);
		}

		const array = Array.from(this._webcams.values());
		const len = array.length;
		const currentWebcamId =
			this._webcam.device ? this._webcam.device.deviceId : undefined;

		logger.debug('_updateWebcams() [webcams:%o]', array);

		if (len === 0)
			this._webcam.device = null;
		else if (!this._webcams.has(currentWebcamId))
			this._webcam.device = array[0];

		store.dispatch(
			stateActions.setCanChangeWebcam(this._webcams.size > 1));
	}

	_getWebcamType(device)
	{
		if (/(back|rear)/i.test(device.label))
		{
			logger.debug('_getWebcamType() | it seems to be a back camera');

			return 'back';
		}
		else
		{
			logger.debug('_getWebcamType() | it seems to be a front camera');

			return 'front';
		}
	}

	async _pauseConsumer(consumer)
	{
		if (consumer.paused)
			return;

		try
		{
			await this._protoo.request('pauseConsumer', { consumerId: consumer.id });

			consumer.pause();

			store.dispatch(
				stateActions.setConsumerPaused(consumer.id, 'local'));
		}
		catch (error)
		{
			logger.error('_pauseConsumer() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error pausing Consumer: ${error}`
				}));
		}
	}

	async _resumeConsumer(consumer)
	{
		if (!consumer.paused)
			return;

		try
		{
			await this._protoo.request('resumeConsumer', { consumerId: consumer.id });

			consumer.resume();

			store.dispatch(
				stateActions.setConsumerResumed(consumer.id, 'local'));
		}
		catch (error)
		{
			logger.error('_resumeConsumer() | failed:%o', error);

			store.dispatch(requestActions.notify(
				{
					type : 'error',
					text : `Error resuming Consumer: ${error}`
				}));
		}
	}

	async _getExternalVideoStream()
	{
		if (this._externalVideoStream)
			return this._externalVideoStream;

		if (this._externalVideo.readyState < 3)
		{
			await new Promise((resolve) => (
				this._externalVideo.addEventListener('canplay', resolve)
			));
		}

		if (this._externalVideo.captureStream)
			this._externalVideoStream = this._externalVideo.captureStream();
		else if (this._externalVideo.mozCaptureStream)
			this._externalVideoStream = this._externalVideo.mozCaptureStream();
		else
			throw new Error('video.captureStream() not supported');

		return this._externalVideoStream;
	}
}
