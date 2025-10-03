import * as net from 'node:net';
import * as process from 'node:process';
import picocolors from 'picocolors';

import { Logger } from './Logger';
import { SOCKET_PATH } from './TerminalServer';

const logger = new Logger('TerminalClient');

export class TerminalClient {
	readonly #socket: net.Socket;
	readonly #onQuit?: () => void;
	#closed: boolean = false;

	static async connect({
		onQuit,
	}: {
		onQuit?: () => void;
	} = {}): Promise<TerminalClient> {
		logger.debug('connect()');

		if (!process.stdin.isTTY) {
			throw new Error('terminal is not a TTY');
		}

		process.stdin.setRawMode(true);

		const socket = net.connect(SOCKET_PATH);

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

		return new TerminalClient({ socket, onQuit });
	}

	private constructor({
		socket,
		onQuit,
	}: {
		socket: net.Socket;
		onQuit?: () => void;
	}) {
		logger.debug('constructor()');

		logInfo('terminal connected');

		this.#socket = socket;
		this.#onQuit = onQuit;

		this.handleSocket();
	}

	close(): void {
		logger.debug('close()');

		if (this.#closed) {
			return;
		}

		this.#closed = true;

		this.#socket.destroy();

		this.#onQuit?.();
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
