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
let delayedProcessTerminationStarted: boolean = false;

handleProcess();
void run();

async function run(): Promise<void> {
	logger.debug('run()');

	// const baseUrl: string = 'https://local.aliax.net:4443';
	const baseUrl: string = 'https://local.dev:4443';
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

		// TODO: Testing.
		// await broadcaster.produceMediaFile({
		// 	mediaClientType: 'ffmpeg',
		// 	// mediaClientType: 'gstreamer',
		// 	mediaFile:
		// 		'/Users/ibc/src/mediasoup-demo/app/public/videos/video-audio-stereo.mp4',
		// });

		await broadcaster.consume({ mediaClientType: 'ffmpeg' });

		await exitGracefully();
	} catch (error) {
		// Only log full error is of unknown type. Otherwise we know it was logged
		// already by other class.
		if (error instanceof BroadcasterError) {
			logger.error(`run() | failed: ${error}`);
		} else {
			logger.error('run() | failed:', error);
		}

		void exitWithError();
	}
}

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
	}

	delayedProcessTerminationStarted = true;

	await broadcaster?.close();
}

function handleProcess(): void {
	process.on('SIGINT', () => {
		void exitGracefully();
	});

	process.on('SIGTERM', () => {
		void exitGracefully();
	});
}
