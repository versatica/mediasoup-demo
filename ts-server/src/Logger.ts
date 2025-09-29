import debug from 'debug';
import * as process from 'node:process';

const APP_NAME = 'mediasoup-demo-server';

const useColor = process.stderr.isTTY;

const RED_COLOR = useColor ? '\x1b[31m' : '';
const RESET_COLOR = useColor ? '\x1b[0m' : '';

export class Logger {
	readonly #debug: debug.Debugger;
	readonly #info: debug.Debugger;
	readonly #warn: debug.Debugger;
	readonly #error: debug.Debugger;

	constructor(prefix?: string) {
		if (prefix) {
			this.#debug = debug(`${APP_NAME}:${prefix}`);
			this.#info = debug(`${APP_NAME}:INFO:${prefix}`);
			this.#warn = debug(`${APP_NAME}:WARN:${prefix}`);
			this.#error = debug(`${APP_NAME}:ERROR:${prefix}`);
		} else {
			this.#debug = debug(APP_NAME);
			this.#info = debug(`${APP_NAME}:INFO`);
			this.#warn = debug(`${APP_NAME}:WARN`);
			this.#error = debug(`${APP_NAME}:ERROR`);
		}

		/* eslint-disable no-console */
		this.#debug.log = console.info.bind(console);
		this.#info.log = console.info.bind(console);
		this.#warn.log = console.warn.bind(console);
		this.#error.log = console.error.bind(console);
		/* eslint-enable no-console */
	}

	get debug(): debug.Debugger {
		return this.#debug;
	}

	get info(): debug.Debugger {
		return this.#info;
	}

	get warn(): debug.Debugger {
		return this.#warn;
	}

	/**
	 * error() logger always prints to stderr no matter the Debug instance is not
	 * enabled (if so it uses console.error() directly).
	 */
	get error(): debug.Debugger | typeof console.error {
		if (this.#error.enabled) {
			return this.#error;
		} else {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			return (...args: any[]) => {
				if (typeof args[0] === 'string') {
					const [first, ...rest] = args;

					// eslint-disable-next-line no-console
					console.error(`${RED_COLOR}ERROR: ${first}${RESET_COLOR}`, ...rest);
				} else {
					// eslint-disable-next-line no-console
					console.error(`${RED_COLOR}ERROR:${RESET_COLOR}`, ...args);
				}
			};
		}
	}
}
