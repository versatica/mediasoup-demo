import debug from 'debug';

const APP_NAME = 'mediasoup-demo-server';

export class Logger {
	readonly #debug: debug.Debugger;
	readonly #info: debug.Debugger;
	readonly #warn: debug.Debugger;
	readonly #error: debug.Debugger;

	constructor(prefix?: string, parentLogger?: Logger) {
		if (parentLogger) {
			if (!prefix) {
				throw TypeError('prefix is mandatory if parentLogger is given');
			}

			this.#debug = parentLogger.debug.extend(prefix);
			this.#info = parentLogger.info.extend(prefix);
			this.#warn = parentLogger.warn.extend(prefix);
			this.#error = parentLogger.error.extend(prefix);
		} else {
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

	get error(): debug.Debugger {
		return this.#error;
	}
}
