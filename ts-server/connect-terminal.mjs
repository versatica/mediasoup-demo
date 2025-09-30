#!/usr/bin/env node

import picocolors from 'picocolors';

import { TerminalClient } from './lib/TerminalClient.js';

TerminalClient.start()
	.then(() => {
		logInfo('terminal client connected');
	})
	.catch(error => {
		logError(`failed to connect terminal client: ${String(error)}`);
	});

function logInfo(msg) {
	// eslint-disable-next-line no-console
	console.info(`[connect-terminal] ${picocolors.green(msg)}\n`);
}

function logError(msg) {
	// eslint-disable-next-line no-console
	console.error(
		`[connect-terminal] ${picocolors.red(picocolors.bold('ERROR: '))}${picocolors.red(msg)}\n`
	);
}
