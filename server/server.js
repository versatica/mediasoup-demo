#!/usr/bin/env node

process.title = 'mediasoup-demo-server';
process.env.DEBUG = process.env.DEBUG || '*WARN* *ERROR*';

const config = require('./config');

/* eslint-disable no-console */
console.log('- process.env.DEBUG:', process.env.DEBUG);
console.log('- config.mediasoup.worker.logLevel:', config.mediasoup.worker.logLevel);
console.log('- config.mediasoup.worker.logTags:', config.mediasoup.worker.logTags);
/* eslint-enable no-console */

const fs = require('fs');
const https = require('https');
const url = require('url');
const protoo = require('protoo-server');
const mediasoup = require('mediasoup');
const AwaitQueue = require('awaitqueue');
const Logger = require('./lib/Logger');
const Room = require('./lib/Room');
const interactive = require('./lib/interactive');

const logger = new Logger();

// Async queue to manage rooms.
// @type {AwaitQueue}
const queue = new AwaitQueue();

// Map of Room instances indexed by roomId.
// @type {Map<Number, Room>}
const rooms = new Map();

// Protoo WebSocket server.
// @type {protoo.WebSocketServer}
let protooWebSocketServer;

// mediasoup Worker.
// @type {mediasoup.Worker}
let mediasoupWorker;

run();

async function run()
{
	// Open the interactive console/terminal.
	interactive();

	// Run a mediasoup Worker.
	await runMediasoupWorker();

	// Run a protoo WebSocketServer.
	await runProtooWebSocketServer();

	// Log rooms status every 30 seconds.
	setInterval(() =>
	{
		for (const room of rooms.values())
		{
			room.logStatus();
		}
	}, 30000);
}

async function runMediasoupWorker()
{
	mediasoupWorker = await mediasoup.createWorker(
		{
			logLevel   : config.mediasoup.worker.logLevel,
			logTags    : config.mediasoup.worker.logTags,
			rtcMinPort : config.mediasoup.worker.rtcMinPort,
			rtcMaxPort : config.mediasoup.worker.rtcMaxPort
		});

	mediasoupWorker.on('died', () =>
	{
		logger.error('mediasoup Worker "died" event, exiting  in 2 seconds...');

		setTimeout(() => process.exit(1), 2000);
	});
}

async function runProtooWebSocketServer()
{
	// HTTPS server for the protoo WebSocket server.
	const tls =
	{
		cert : fs.readFileSync(config.protoo.tls.cert),
		key  : fs.readFileSync(config.protoo.tls.key)
	};

	const httpsServer = https.createServer(tls, (req, res) =>
	{
		res.writeHead(404, 'No HTTP here, please');
		res.end();
	});

	await new Promise((resolve) =>
	{
		httpsServer.listen(config.protoo.listenPort, config.protoo.listenIp, resolve);
	});

	// Create the protoo WebSocket server.
	protooWebSocketServer = new protoo.WebSocketServer(httpsServer,
		{
			maxReceivedFrameSize     : 960000, // 960 KBytes.
			maxReceivedMessageSize   : 960000,
			fragmentOutgoingMessages : true,
			fragmentationThreshold   : 960000
		});

	// Handle connections from clients.
	protooWebSocketServer.on('connectionrequest', (info, accept, reject) =>
	{
		// The client indicates the roomId and peerId in the URL query.
		const u = url.parse(info.request.url, true);
		const roomId = u.query['roomId'];
		const peerId = u.query['peerId'];
		const forceH264 = u.query['forceH264'] === 'true';

		if (!roomId || !peerId)
		{
			logger.warn('connection request without roomId and/or peerId');

			reject(400, 'Connection request without roomId and/or peerId');

			return;
		}

		logger.info(
			'protoo connection request [roomId:%s, peerId:%s, address:%s, origin:%s]',
			roomId, peerId, info.socket.remoteAddress, info.origin);

		// Serialize this code into the queue to avoid that two peers connecting at
		// the same time with the same roomId create two separate rooms with same
		// roomId.
		queue.push(async () =>
		{
			let room = rooms.get(roomId);

			// If the Room does not exist create a new one.
			if (!room)
			{
				logger.info('creating a new Room [roomId:%s]', roomId);

				room = await Room.create({ mediasoupWorker, roomId, forceH264 });

				rooms.set(roomId, room);
				room.on('close', () => rooms.delete(roomId));
			}

			// Accept the protoo WebSocket connection.
			const protooWebSocketTransport = accept();

			room.handleProtooConnection({ peerId, protooWebSocketTransport });
		})
			.catch(reject);
	});
}
