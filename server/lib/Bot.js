const dgram = require('dgram');
const sctp = require('sctp');
const Logger = require('./Logger');

const logger = new Logger('Bot');

// Set node-sctp default PMTU to 1200.
sctp.defaults({ PMTU: 1200 });

class Bot
{
	static async create({ mediasoupRouter })
	{
		// Create a PlainRtpTransport for connecting the bot.
		// Assume no more than 256 participants.
		const transport = await mediasoupRouter.createPlainRtpTransport(
			{
				listenIp           : { ip: '127.0.0.1' },
				enableSctp         : true,
				numSctpStreams     : { OS: 256, MIS: 256 },
				maxSctpMessageSize : 262144
			});

		// Node UDP socket for SCTP.
		const udpSocket = dgram.createSocket({ type: 'udp4' });

		await new Promise((resolve) => udpSocket.bind(0, '127.0.0.1', resolve));

		const localUdpPort = udpSocket.address().port;

		// Connect the mediasoup PlainRtpTransport to the UDP socket port.
		await transport.connect({ ip: '127.0.0.1', port: localUdpPort });

		const remoteUdpIp = transport.tuple.localIp;
		const remoteUdpPort = transport.tuple.localPort;
		const { OS, MIS } = transport.sctpParameters;

		// SCTP socket.
		let sctpSocket;

		// Use UDP connected socket if Node >= 12.
		if (typeof udpSocket.connect === 'function')
		{
			await new Promise((resolve, reject) =>
			{
				udpSocket.connect(remoteUdpPort, remoteUdpIp, (error) =>
				{
					if (error)
					{
						logger.error('UDP socket connect() failed:%o', error);

						reject(error);

						return;
					}

					sctpSocket = sctp.connect(
						{
							localPort    : 5000, // Required for SCTP over UDP in mediasoup.
							port         : 5000, // Required for SCTP over UDP in mediasoup.
							OS           : OS,
							MIS          : MIS,
							udpTransport : udpSocket
						});

					resolve();
				});
			});
		}
		// Use UDP disconnected socket if Node < 12.
		else
		{
			sctpSocket = sctp.connect(
				{
					localPort    : 5000, // Required for SCTP over UDP in mediasoup.
					port         : 5000, // Required for SCTP over UDP in mediasoup.
					OS           : OS,
					MIS          : MIS,
					udpTransport : udpSocket,
					udpPeer      :
					{
						address : remoteUdpIp,
						port    : remoteUdpPort
					}
				});
		}

		// Create a SCTP outgoing stream with id 1 (since id 0 is already used
		// by the implicit SCTP outgoing stream built-in the SCTP socket).
		const streamId = 1;
		const sendStream = sctpSocket.createStream(streamId);

		// Create DataProducer with the corresponding SCTP stream id.
		const dataProducer = await transport.produceData(
			{
				sctpStreamParameters :
				{
					streamId : streamId,
					ordered  : true
				},
				label : 'bot'
			});

		// Create the Bot instance.
		const bot =
			new Bot({ udpSocket, transport, sctpSocket, sendStream, dataProducer });

		return bot;
	}

	constructor({ udpSocket, sctpSocket, sendStream, transport, dataProducer })
	{
		// mediasoup PlainRtpTransport.
		// @type {mediasoup.PlainRtpTransport}
		this._transport = transport;

		// mediasoup DataProducer.
		// @type {mediasoup.DataProducer}
		this._dataProducer = dataProducer;

		// Map of peers indexed by SCTP streamId.
		// @type{Map<Number, Object>}
		this._mapStreamIdPeer = new Map();

		// UDP socket.
		// @type {UDP.Socket}
		this._udpSocket = udpSocket;

		// SCTP socket.
		// @type {sctp.Socket}
		this._sctpSocket = sctpSocket;

		// SCTP sending stream.
		// @type {sctp.Stream}
		this._sendStream = sendStream;

		transport.on('sctpstatechange', (sctpState) =>
		{
			logger.debug(
				'bot PlainRtpTransport "sctpstatechange" event [sctpState:%s]', sctpState);
		});

		sctpSocket.on('connect', () =>
		{
			logger.debug('SCTP socket "connect" event');
		});

		sctpSocket.on('error', (error) =>
		{
			logger.error('SCTP socket "error" event:%o', error);
		});

		// New SCTP inbound stream. Handle it.
		sctpSocket.on('stream', (stream, streamId) =>
		{
			logger.debug('SCTP socket "stream" event [streamId:%d]', streamId);

			stream.on('data', (data) =>
			{
				const { ppid } = data;

				// Ensure it's a WebRTC DataChannel string.
				if (ppid !== sctp.PPID.WEBRTC_STRING)
				{
					logger.warn(
						'ignoring non string receivied data in SCTP inbound stream');

					return;
				}

				const text = data.toString('utf8');
				const peer = this._mapStreamIdPeer.get(streamId);

				if (!peer)
				{
					logger.warn('no peer associated to streamId [streamId:%d]', streamId);

					return;
				}

				logger.debug(
					'SCTP stream "data" event in SCTP inbound stream [streamId:%d, peerId:%s, size:%d, ppid:%o]',
					streamId, peer.id, data.byteLength, ppid);

				// Create a buffer to send it back to mediasoup using our SCTP outgoing
				// stream.
				const buffer = Buffer.from(`${peer.data.displayName} said me: "${text}"`);

				// Set ppid of type WebRTC DataChannel string.
				buffer.ppid = sctp.PPID.WEBRTC_STRING;

				// Send it.
				sendStream.write(buffer);
			});
		});

		sendStream.on('data', (data) =>
		{
			logger.warn(
				'SCTP stream "data" event in SCTP outgoing stream! [data:%o]', data);
		});
	}

	get dataProducer()
	{
		return this._dataProducer;
	}

	close()
	{
		this._udpSocket.close();
		this._sctpSocket.end();
	}

	async handleDataProducer({ dataProducerId, peer })
	{
		const dataConsumer = await this._transport.consumeData(
			{
				dataProducerId
			});

		const { streamId } = dataConsumer.sctpStreamParameters;

		this._mapStreamIdPeer.set(streamId, peer);

		dataConsumer.observer.on('close', () =>
		{
			this._mapStreamIdPeer.delete(streamId);
		});
	}
}

module.exports = Bot;
