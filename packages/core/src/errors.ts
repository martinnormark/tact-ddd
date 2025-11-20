export class DomainError extends Error {
	readonly code: string;

	constructor(code: string, message?: string) {
		super(message ?? code);
		this.code = code;
		// Set the prototype explicitly for Error subclassing quirks in JS
		Object.setPrototypeOf(this, new.target.prototype);
	}
}

export class InvariantViolation extends DomainError {
	constructor(code: string, message?: string) {
		super(code, message);
	}
}

export class NotFoundError extends DomainError {
	constructor(entityName: string, id: unknown) {
		super(`${entityName}.NotFound`, `${entityName} with id '${String(id)}' was not found`);
	}
}
