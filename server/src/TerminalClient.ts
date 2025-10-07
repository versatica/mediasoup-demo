import * as net from 'node:net';
import * as process from 'node:process';
import picocolors from 'picocolors';

import { Logger } from './Logger';
import { EnhancedEventEmitter } from './enhancedEvents';
import { SOCKET_PATH } from './TerminalServer';

const logger = new Logger('TerminalClient');

export type TerminalClientEvents = {
	/**
	 * Emitted when the terminal client is closed no matter how.
	 */
	closed: [];
};

export class TerminalClient extends EnhancedEventEmitter<TerminalClientEvents> {
	readonly #socket: net.Socket;
	#closed: boolean = false;

	static async connect(): Promise<TerminalClient> {
		logger.debug('connect()');

		if (!process.stdin.isTTY) {
			throw new Error('terminal is not a TTY');
		}

		process.stdin.setRawMode(true);

		logInfo(`connecting to socket '${SOCKET_PATH}'...`);

		const socket = net.connect({ path: SOCKET_PATH });

		process.stdin.pipe(socket);
		socket.pipe(process.stdout);

		await new Promise<void>((resolve, reject) => {
			const onError = (error: Error): void => {
				logError(`failed to connect the terminal: ${error}`);

				reject(error);
			};

			socket.on('connect', () => {
				socket.removeListener('error', onError);

				resolve();
			});

			socket.on('error', onError);
		});

		return new TerminalClient({ socket });
	}

	private constructor({ socket }: { socket: net.Socket }) {
		super();

		logger.debug('constructor()');

		logInfo('terminal connected');

		this.#socket = socket;

		this.handleSocket();
	}

	close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.#socket.destroy();

		this.emit('closed');
	}

	private handleSocket(): void {
		this.#socket.on('close', () => {
			this.close();
		});

		this.#socket.on('error', error => {
			logError(`socket error: ${error}`);
		});
	}
}

function logInfo(msg: string): void {
	// eslint-disable-next-line no-console
	console.log(picocolors.yellow(`[TerminalClient] ${msg}`));
}

function logError(msg: string): void {
	// eslint-disable-next-line no-console
	console.error(
		`${picocolors.red('[TerminalClient]')} ${picocolors.red(picocolors.bold('ERROR:'))} ${picocolors.red(msg)}`
	);
}
