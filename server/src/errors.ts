export class ServerError extends Error {
	constructor(message: string) {
		super(message);

		this.name = 'ServerError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, ServerError);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	get status(): number {
		// HTTP 500 Internal Server Error.
		return 500;
	}
}

export class InvalidStateError extends ServerError {
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

	override get status(): number {
		// HTTP 409 Conflict.
		return 409;
	}
}

export class UnsupportedError extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'UnsupportedError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, UnsupportedError);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 409 Conflict.
		return 409;
	}
}

export class ForbiddenError extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'ForbiddenError';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, ForbiddenError);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 403 Forbidden.
		return 403;
	}
}

export class RoomNotFound extends ServerError {
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

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class PeerNotFound extends ServerError {
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

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class TransportNotFound extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'TransportNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, TransportNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class ProducerNotFound extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'ProducerNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, ProducerNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class ConsumerNotFound extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'ConsumerNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, ConsumerNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class DataProducerNotFound extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'DataProducerNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, DataProducerNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}

export class DataConsumerNotFound extends ServerError {
	constructor(message: string) {
		super(message);

		this.name = 'DataConsumerNotFound';

		if (Error.hasOwnProperty('captureStackTrace')) {
			// Just in V8.
			Error.captureStackTrace(this, DataConsumerNotFound);
		} else {
			this.stack = new Error(message).stack;
		}
	}

	override get status(): number {
		// HTTP 404 Not Found.
		return 404;
	}
}
