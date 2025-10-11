export class BroadcasterError extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'BroadcasterError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, BroadcasterError);
		} else {
			this.stack = new Error(message).stack;
		}
	}
}

export class BroadcasterApiClientError extends BroadcasterError {
	readonly #statusCode: number | undefined;

	constructor(message: string, statusCode?: number) {
		super(message);

		this.name = 'BroadcasterApiClientError';
		this.#statusCode = statusCode;

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, BroadcasterApiClientError);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	get statusCode(): number | undefined {
		return this.#statusCode;
	}
}
