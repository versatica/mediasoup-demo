#!/usr/bin/env node

import * as process from 'node:process';
import * as util from 'node:util';

import { Logger } from './Logger';
import { Server } from './Server';
import { TerminalServer } from './TerminalServer';
import { TerminalClient } from './TerminalClient';
// @ts-expect-error --- config.js has no TS declaration.
import config from '../config.mjs';

const logger = new Logger();

// eslint-disable-next-line no-console
console.log('process.env.DEBUG: %o', process.env['DEBUG']);

logger.info('config:', util.inspect(config, { depth: null, colors: true }));

void start();

async function start(): Promise<void> {
	logger.info('start()');

	try {
		// Start the interactive terminal server.
		await TerminalServer.start({
			onQuit: () => exit(),
		});

		const server = await Server.create({ config });

		handleServer(server);

		// Start the interactive terminal client if requested.
		if (process.env['TERMINAL'] === 'true') {
			await TerminalClient.start();
		}

		logger.info('start() | server started');
	} catch (error) {
		logger.error('start() | failed:', error);

		exitWithError();
	}
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
