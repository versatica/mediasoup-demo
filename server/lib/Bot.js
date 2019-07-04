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
		const transport = await mediasoupRouter.createPlainRtpTransport(
			{
				listenIp           : { ip: '127.0.0.1' },
				enableSctp         : true,
				numSctpStreams     : { OS: 4096, MIS: 4096 },
				maxSctpMessageSize : 262144
			});

		const udpSocket = dgram.createSocket({ type: 'udp4' });

		await new Promise((resolve) => udpSocket.bind(0, '127.0.0.1', resolve));

		const localUdpPort = udpSocket.address().port;

		await transport.connect({ ip: '127.0.0.1', port: localUdpPort });

		const remoteUdpIp = transport.tuple.localIp;
		const remoteUdpPort = transport.tuple.localPort;
		const { OS, MIS } = transport.sctpParameters;

		let sctpSocket;

		// Connected UDP socket if Node >= 12.
		if (parseInt(process.version.slice(1, 3)) >= 12)
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
		// Disconnected UDP socket if Node < 12.
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

		const streamId = 666;
		const sendStream = sctpSocket.createStream(streamId);

		// Create DataProducer.
		const dataProducer = await transport.produceData(
			{
				sctpStreamParameters :
				{
					streamId : streamId,
					ordered  : true
				},
				label : 'bot'
			});

		const bot = new Bot({ transport, sctpSocket, sendStream, dataProducer });

		return bot;
	}

	constructor({ sctpSocket, sendStream, transport, dataProducer })
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

		// SCTP socket.
		// @type {sctp.Socket}
		this._sctpSocket = sctpSocket;

		// SCTP sending stream.
		// @type {sctp.Stream}
		this._sendStream = sendStream;

		transport.on('sctpstatechange', (sctpState) =>
		{
			logger.info(
				'bot PlainRtpTransport "sctpstatechange" event [sctpState:%s]', sctpState);
		});

		sctpSocket.on('connect', () =>
		{
			logger.info('SCTP socket "connect" event');
		});

		sctpSocket.on('error', (error) =>
		{
			logger.error('SCTP socket "error" event:%o', error);
		});

		sctpSocket.on('stream', (stream, streamId) =>
		{
			logger.info('SCTP socket "stream" event [streamId:%d]', streamId);

			stream.on('data', (data) =>
			{
				const { ppid } = data;

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

				logger.info(
					'SCTP stream "data" event in SCTP inbound stream [streamId:%d, peerId:%s, text:%o, ppid:%o]',
					streamId, peer.id, text, ppid);

				const buffer = Buffer.from(`${peer.data.displayName} said me "${text}"`);

				buffer.ppid = sctp.PPID.WEBRTC_STRING;

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
