import * as net from 'node:net';
import * as process from 'node:process';

import { Logger } from './Logger';
import { SOCKET_PATH } from './TerminalServer';

const logger = new Logger('TerminalClient');

export class TerminalClient {
	static async start(): Promise<void> {
		logger.debug('start()');

		if (!process.stdin.isTTY) {
			throw new Error('terminal is not a TTY');
		}

		const socket = net.connect(SOCKET_PATH);

		process.stdin.pipe(socket);
		socket.pipe(process.stdout);

		socket.on('connect', () => process.stdin.setRawMode(true));
		socket.on('close', () => process.exit(0));
		socket.on('exit', () => socket.end());

		await new Promise<void>((resolve, reject) => {
			socket.once('connect', resolve);
			socket.once('error', reject);
		});
	}
}
