#!/usr/bin/env node

import * as process from 'node:process';
import * as util from 'node:util';

import { Logger } from './Logger';
import { Server } from './Server';
import { TerminalServer } from './TerminalServer';
import { TerminalClient } from './TerminalClient';
import * as envs from './envs';
import { Config } from './types';

const logger = new Logger();

let server: Server | undefined;
let terminalClient: TerminalClient | undefined;

void start();

async function start(): Promise<void> {
	logger.info('start()');

	try {
		logger.info('start() | debug: %o', envs.getDebug());
		logger.info('start() | terminal: %o', envs.getTerminal());
		logger.info(
			'start() | network throttle secret: %o',
			envs.getNetworkThrottleSecret() ? '********' : undefined
		);
		logger.info('start() | config file: %o', envs.getConfigFile());

		const config = await getConfig();

		logger.info(
			'start() | config:',
			util.inspect(config, { depth: null, colors: true })
		);

		// Start the interactive terminal server.
		await TerminalServer.listen({
			onQuit: () => {
				exitGracefully();
			},
			onForceQuit: () => {
				exitWithError();
			},
		});

		server = await Server.create({
			config,
			networkThrottleSecret: envs.getNetworkThrottleSecret(),
		});

		logger.info('start() | server started');

		handleServer();

		// Start the interactive terminal client if requested.
		if (envs.getTerminal()) {
			terminalClient = await TerminalClient.connect();

			handleTerminalClient();
		}
	} catch (error) {
		logger.error('start() | failed:', error);

		exitWithError();
	}
}

async function getConfig(): Promise<Config> {
	const configFile = envs.getConfigFile();

	try {
		return (await import(configFile)).config;
	} catch (error) {
		logger.error(
			`start() | failed to read config file %o: ${error}`,
			configFile
		);

		throw error;
	}
}

/**
 * Here we close everything that keeps the Node process alive.
 */
function exitGracefully(): void {
	logger.info('exiting gracefully...');

	TerminalServer.stop();
	server?.close();
}

function exitWithError(): void {
	logger.error('exiting with error...');

	try {
		TerminalServer.stop();
		server?.close();
	} catch (error) {}

	process.exit(1);
}

function handleServer(): void {
	server?.on('died', () => {
		logger.error('server died, exiting');

		exitWithError();
	});
}

function handleTerminalClient(): void {
	terminalClient?.on('closed', () => {
		exitGracefully();
	});
}
