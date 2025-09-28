#!/usr/bin/env node

process.title = 'mediasoup-demo-server';
process.env['DEBUG'] ??= '*INFO* *WARN* *ERROR*';

import * as util from 'node:util';

import { Logger } from './Logger';
import { Server } from './Server';
// const interactiveServer = require('./lib/interactiveServer');
// const interactiveClient = require('./lib/interactiveClient');
// @ts-expect-error --- config.js has no TS declaration.
import config from '../config.mjs';

/* eslint-disable no-console */
console.log('process.env.DEBUG: %o', process.env['DEBUG']);
console.log('config:', util.inspect(config, { depth: null, colors: true }));
/* eslint-enable no-console */

const logger = new Logger();

void run().catch(error => {
	logger.error('failed to run: %s', String(error));

	exitWithError();
});

async function run(): Promise<void> {
	logger.info('run()');

	const server = await Server.create({ config });

	handleServer(server);
}

function handleServer(server: Server): void {
	server.on('mediasoup-worker-died', () => {
		exitWithError();
	});
}

function exitWithError(): void {
	logger.error('exiting with error');

	process.exit(1);
}
