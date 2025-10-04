export class InvalidStateError extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'InvalidStateError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, InvalidStateError);
		} else {
			this.stack = new Error(message).stack;
		}
	}
}

export class UnauthorizedError extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'UnauthorizedError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, UnauthorizedError);
		} else {
			this.stack = new Error(message).stack;
		}
	}
}
