/** Thrown by feature modules when input fails validation. Routes map it to a 400 with field errors. */
export class ValidationError extends Error {
	constructor(public readonly fields: Record<string, string>) {
		super(Object.values(fields).join('; ') || 'Invalid input');
		this.name = 'ValidationError';
	}
}

/** Thrown when a record does not exist *or* belongs to another user (never reveal which). */
export class NotFoundError extends Error {
	constructor(what = 'Record') {
		super(`${what} not found`);
		this.name = 'NotFoundError';
	}
}
