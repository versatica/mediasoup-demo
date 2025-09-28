// #!/usr/bin/env node

// process.title = 'mediasoup-demo-server';
// process.env['DEBUG'] ??= '*INFO* *WARN* *ERROR*';

// import * as util from 'node:util';
// import * as mediasoup from 'mediasoup';
// import * as http from 'node:http';
// import * as https from 'node:https';
// import * as fs from 'node:fs';
// import * as url from 'node:url';
// // const protoo = require('protoo-server');
// // const express = require('express');
// // const bodyParser = require('body-parser');
// // const { AwaitQueue } = require('awaitqueue');
// // const throttle = require('@sitespeed.io/throttle');

// import { Logger } from './Logger';
// // const utils = require('./lib/utils');
// // const Room = require('./lib/Room');
// // const interactiveServer = require('./lib/interactiveServer');
// // const interactiveClient = require('./lib/interactiveClient');
// // @ts-expect-error --- config.js has no TS declaration.
// import config from '../config.mjs';

// /* eslint-disable no-console */
// console.log('process.env.DEBUG: %o', process.env['DEBUG']);
// console.log('config:', util.inspect(config, { depth: null, colors: true }));
// /* eslint-enable no-console */

// const logger = new Logger();

// void run();

// async function run(): Promise<void> {
// 	logger.info('run()');

// 	const worker = await mediasoup.createWorker({
// 		logLevel: 'debug',
// 		logTags: ['info'],
// 	});

// 	logger.debug('index mediasoup worker running!!!');

// 	console.log(await worker.dump());
// }

// server.on('mediasoup-worker-died', () => {
// 	process.exit(1)
// })
