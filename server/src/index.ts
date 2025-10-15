import process from 'node:process';
import * as util from 'node:util';

import { Logger } from './Logger';
import { Server } from './Server';
import { TerminalServer } from './TerminalServer';
import { TerminalClient } from './TerminalClient';
import * as envs from './envs';
import { ServerConfig } from './types';

const logger = new Logger();

let server: Server | undefined;
let processTerminationStarted: boolean = false;
let delayedProcessTerminationStarted: boolean = false;

handleProcess();

void start();

async function start(): Promise<void> {
	logger.info('start()');

	try {
		logger.info(
			'start() | process [pid:%o, title:%o, args:%o]',
			process.pid,
			process.title,
			process.argv.join(' ')
		);
		logger.info('start() | debug: %o', envs.getDebug());
		logger.info('start() | terminal: %o', envs.getTerminal());
		logger.info(
			'start() | network throttle secret: %o',
			envs.getNetworkThrottleSecret() ? '********' : undefined
		);
		logger.info('start() | server config file: %o', envs.getConfigFile());

		const config = await getConfig();

		logger.debug(
			'start() | server config:',
			util.inspect(config, { depth: null, colors: true, compact: false })
		);

		// Start the interactive terminal server.
		await TerminalServer.listen({
			onQuit: () => {
				void exitGracefully();
			},
			onForceQuit: () => {
				void exitWithError();
			},
		});

		server = await Server.create({
			config,
			networkThrottleSecret: envs.getNetworkThrottleSecret(),
		});

		logger.info('start() | Server started');

		handleServer();

		// Start the interactive terminal client if requested.
		if (envs.getTerminal()) {
			const terminalClient = await TerminalClient.connect();

			handleTerminalClient(terminalClient);
		}
	} catch (error) {
		logger.error('start() | failed to start Server:', error);

		void exitWithError();
	}
}

async function getConfig(): Promise<ServerConfig> {
	const configFile = envs.getConfigFile();

	try {
		return (await import(configFile)).config;
	} catch (error) {
		logger.error(
			`start() | failed to read server config file %o: ${error}`,
			configFile
		);

		throw error;
	}
}

/**
 * Here we close everything that keeps the Node process alive.
 */
async function exitGracefully(): Promise<void> {
	if (processTerminationStarted) {
		return;
	}

	processTerminationStarted = true;

	logger.info('exiting gracefully...');

	await terminateProcess();
}

async function exitWithError(): Promise<void> {
	if (processTerminationStarted) {
		return;
	}

	processTerminationStarted = true;

	logger.error('exiting with error...');

	try {
		await terminateProcess();
	} catch (error) {}

	process.exit(1);
}

async function terminateProcess(): Promise<void> {
	if (delayedProcessTerminationStarted) {
		logger.info(
			`terminateProcess() | ignored (delayed process termination already started)`
		);

		return;
	} else if (server?.isNetworkThrottleEnabled()) {
		logger.info(
			`terminateProcess() | stopping the Server and waiting for 3 seconds to give a chance to network throttle to stop...`
		);

		delayedProcessTerminationStarted = true;

		server?.close();
		TerminalServer.stop();

		await new Promise(resolve => setTimeout(resolve, 3000));
	} else {
		server?.close();
		TerminalServer.stop();
	}
}

/**
 * We want to catch all the exit ways to ensure that we always close the Server
 * instance (if it still exists) so its closure will stop network throttle.
 */
function handleProcess(): void {
	process.on('SIGINT', () => {
		void exitGracefully();
	});

	process.on('SIGTERM', () => {
		void exitGracefully();
	});
}

function handleServer(): void {
	server?.on('closed', () => {
		server = undefined;
	});

	server?.on('died', () => {
		logger.error('Server died, exiting');

		void exitWithError();
	});
}

function handleTerminalClient(terminalClient: TerminalClient): void {
	terminalClient.on('closed', () => {
		void exitGracefully();
	});
}
