import { InvariantViolation } from './errors';

export function ensure(condition: unknown, code: string, message?: string): asserts condition {
	if (!condition) {
		throw new InvariantViolation(code, message);
	}
}
