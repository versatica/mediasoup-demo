#!/usr/bin/env -S npx tsx

import process from 'node:process';

import { Logger } from './Logger';
import { Broadcaster } from './Broadcaster';
import { BroadcasterError } from './errors';
import * as utils from './utils';
import { RoomId, PeerId, PeerDevice } from './types';

const logger = new Logger();

let broadcaster: Broadcaster | undefined;
let processTerminationStarted: boolean = false;

handleProcess();
void run();

async function run(): Promise<void> {
	logger.debug('run()');

	const baseUrl: string = 'https://local.aliax.net:4443';
	const roomId: RoomId = 'dev';
	const peerId: PeerId = utils.generateRandomString(8);
	const displayName: string = 'Broadcaster';
	const device: PeerDevice = {
		flag: 'gstreamer',
		name: `GStreamer-${utils.generateRandomString(4)}`,
	};

	try {
		broadcaster = await Broadcaster.create({
			baseUrl,
			roomId,
			peerId,
			displayName,
			device,
		});

		console.log('TODO: Do more stuff, hehe');

		void broadcaster.close();
	} catch (error) {
		// Only log if error is of unknown type. Otherwise we know it was logged
		// already by other class.
		if (!(error instanceof BroadcasterError)) {
			logger.error('run() | failed:', error);
		}

		exitWithError();
	}
}

function exitGracefully(): void {
	if (processTerminationStarted) {
		return;
	}

	processTerminationStarted = true;

	void broadcaster?.close();

	logger.info('exiting gracefully...');

	process.exit(0);
}

function exitWithError(): void {
	if (processTerminationStarted) {
		return;
	}

	processTerminationStarted = true;

	void broadcaster?.close();

	logger.error('exiting with error...');

	process.exit(1);
}

function handleProcess(): void {
	process.on('SIGINT', () => {
		void exitGracefully();
	});

	process.on('SIGTERM', () => {
		void exitGracefully();
	});
}
