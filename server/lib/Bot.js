const dgram = require('dgram');
const EventEmitter = require('events').EventEmitter;
const sctp = require('sctp');
const Logger = require('./Logger');

const logger = new Logger('Bot');

class Bot extends EventEmitter
{
	constructor({ transport })
	{
		super();
		this.setMaxListeners(Infinity);

		// Node UDP socket.
		// @type {dgram.Socket}
		this._udpSocket = null;

		// SCTP socket.
		// @type {sctp.Socket}
		this._sctpSocket = null;

		// SCTP stream.
		// @type {sctp.Stream}
		this._sctpStream = null;

		// mediasoup PlainRtpTransport.
		// @type {mediasoup.PlainRtpTransport}
		this._transport = transport;

		// mediasoup DataProducer.
		// @type {mediasoup.DataProducer}
		this._dataProducer = null;

		this._run();
	}

	async _run()
	{
		this._udpSocket = dgram.createSocket({ type: 'udp4' });

		await new Promise((resolve) => this._udpSocket.bind(0, '127.0.0.1', resolve));

		const localUdpPort = this._udpSocket.address().port;

		await this._transport.connect({ ip: '127.0.0.1', port: localUdpPort });

		const remoteUdpIp = this._transport.tuple.localIp;
		const remoteUdpPort = this._transport.tuple.localPort;
		const { numStreams } = this._transport.sctpParameters;

		// Connected UDP socket if Node >= 12.
		if (process.version.slice(1, 3) >= '12')
		{
			await new Promise((resolve, reject) =>
			{
				this._udpSocket.connect(remoteUdpPort, remoteUdpIp, (error) =>
				{
					if (error)
					{
						logger.error('UDP socket connect() failed:%o', error);

						reject(error);

						return;
					}

					this._sctpSocket = sctp.connect(
						{
							localPort    : 5000, // Required for SCTP over UDP in mediasoup.
							port         : 5000, // Required for SCTP over UDP in mediasoup.
							passive      : true,
							MIS          : numStreams,
							OS           : numStreams,
							udpTransport : this._udpSocket
						});

					resolve();
				});
			});
		}
		// Disconnected UDP socket if Node < 12.
		else
		{
			this._sctpSocket = sctp.connect(
				{
					localPort    : 5000, // Required for SCTP over UDP in mediasoup.
					port         : 5000, // Required for SCTP over UDP in mediasoup.
					passive      : true,
					MIS          : numStreams,
					OS           : numStreams,
					udpTransport : this._udpSocket,
					udpPeer      :
					{
						address : remoteUdpIp,
						port    : remoteUdpPort
					}
				});
		}

		this._sctpSocket.on('error', (error) =>
		{
			logger.error('SCTP socket "error" event:%o', error);
		});

		this._sctpSocket.on('connect', () =>
		{
			logger.info('SCTP socket "connect" event');
		});

		this._sctpSocket.on('stream', (stream, id) =>
		{
			logger.info('SCTP socket "stream" event [id:%o]', id);
		});

		this._sctpStream = this._sctpSocket.createStream(666);

		this._sctpStream.on('data', (data) =>
		{
			logger.warn(
				'SCTP stream "data" event in SCTP outgoing stream! [data:%o]', data);

			// For testing purposes.
			global.LAST_DATA = data;
		});

		// Create DataProducer.
		this._dataProducer = await this._transport.produceData(
			{
				sctpStreamParameters :
				{
					streamId          : 666,
					ordered           : true,
					maxPacketLifeTime : 5000
				},
				label : 'bot'
			});
	}
}

module.exports = Bot;
