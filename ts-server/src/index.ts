#!/usr/bin/env node

process.title = 'mediasoup-demo-server';
process.env['DEBUG'] ??= '*INFO* *WARN* *ERROR*';

import * as util from 'node:util';

import { Logger } from './Logger';
import { Server } from './Server';
import { TerminalServer } from './TerminalServer';
import { TerminalClient } from './TerminalClient';
// @ts-expect-error --- config.js has no TS declaration.
import config from '../config.mjs';

/* eslint-disable no-console */
console.log('process.env.DEBUG: %o', process.env['DEBUG']);
console.log('config:', util.inspect(config, { depth: null, colors: true }));
/* eslint-enable no-console */

const logger = new Logger();

// If we launch the server with nodemon --no-stdin, we need to listen to Ctrl+C
// or Cmd+C via stdin.
if (process.env['npm_lifecycle_script']?.includes('nodemon')) {
	logger.info('nodemon detected, listening to Cmd/Ctrl + C via stdin');

	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.on('data', chunk => {
		// Ctrl+C.
		if (chunk[0] === 3) {
			logger.info('caught Ctrl+C, exiting');

			exit();
		}
	});
}

void start().catch(error => {
	logger.error('failed to start:', error);

	exitWithError();
});

async function start(): Promise<void> {
	logger.info('start()');

	// Start the interactive terminal server.
	await TerminalServer.start();

	// Start the interactive terminal client.
	if (process.env['TERMINAL'] === 'true' || process.env['TERMINAL'] === '1') {
		await TerminalClient.start();
	}

	const server = await Server.create({ config });

	handleServer(server);

	logger.info('server started');
}

function handleServer(server: Server): void {
	server.on('mediasoup-worker-died', () => {
		exitWithError();
	});
}

function exit(): void {
	process.exit(0);
}

function exitWithError(): void {
	logger.error('exiting with error');

	process.exit(1);
}
