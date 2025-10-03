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

let server: Server | undefined;

void start();

async function start(): Promise<void> {
	logger.info('start()');

	try {
		server = await Server.create({ config });

		logger.info('start() | server started');

		handleServer();

		// Start the interactive terminal server.
		await TerminalServer.start({
			onQuit: exitGracefully,
		});

		// Start the interactive terminal client if requested.
		if (process.env['TERMINAL'] === 'true') {
			await TerminalClient.start();
		}
	} catch (error) {
		logger.error('start() | failed:', error);

		exitWithError();
	}
}

function handleServer(): void {
	server?.on('died', () => {
		logger.error('server died, exiting');

		exitWithError();
	});
}

/**
 * Here we close everything that keeps the Node process alive.
 */
function exitGracefully(): void {
	logger.info('exiting gracefully...');

	TerminalServer.close();
	server?.close();
}

function exitWithError(): void {
	logger.error('exiting with error...');

	process.exit(1);
}
