#!/usr/bin/env -S npx tsx

import * as http from 'node:http';
import * as https from 'node:https';
import * as crypto from 'node:crypto';

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const ROOM_ID = 'ws-client-test-room';
const PEER_ID = 'ws-client-test-peer';

function connectWebSocket() {
	console.log('> connecting with an upgrade request');

	const peerIdSuffix = crypto.randomInt(1, 1001);
	const url = `https://127.0.0.1:4443/test?roomId=${ROOM_ID}&peerId=${PEER_ID}-${peerIdSuffix}`;
	const wsKey = crypto.randomBytes(16).toString('base64');

	const req = https.request(url, {
		headers: {
			Connection: 'Upgrade',
			Upgrade: 'websocket',
			'Sec-WebSocket-Key': wsKey,
			'Sec-WebSocket-Version': '13',
			'Sec-WebSocket-Protocol': 'protoo',
		},
	});

	req.end();

	req.on('error', error => {
		console.error('> request error:', error);
	});

	req.on('upgrade', (res, socket, upgradeHead) => {
		console.log('> request upgraded [status code:%o]', res.statusCode);
	});
}

connectWebSocket();
