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

	get status(): number {
		// HTTP 409 Conflict.
		return 409;
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

	get status(): number {
		// HTTP 403 Forbidden.
		return 403;
	}
}

export class RoomNotFound extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'RoomNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, RoomNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class PeerNotFound extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'PeerNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, PeerNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}
