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

export class BroadcasterInvalidStateError extends BroadcasterError {
	constructor(message: string) {
		super(message);

		this.name = 'BroadcasterInvalidStateError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, BroadcasterInvalidStateError);
		} else {
			this.stack = new Error(message).stack;
		}
	}
}

export class BroadcasterNotImplementedError extends BroadcasterError {
	constructor(message: string) {
		super(message);

		this.name = 'BroadcasterNotImplementedError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, BroadcasterNotImplementedError);
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

export class BroadcasterSpawnError extends BroadcasterError {
	constructor(message: string) {
		super(message);

		this.name = 'BroadcasterSpawnError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, BroadcasterSpawnError);
		} else {
			this.stack = new Error(message).stack;
		}
	}
}
