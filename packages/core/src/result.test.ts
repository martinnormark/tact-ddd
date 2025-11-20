import { describe, expect, test } from 'bun:test';
import { ok, err, isOk, isErr, type Result } from './result';
import { DomainError } from './errors';

describe('Result', () => {
	describe('ok', () => {
		test('creates a successful result', () => {
			const result = ok(42);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(42);
			}
		});

		test('creates a successful result with object', () => {
			const data = { name: 'John', age: 30 };
			const result = ok(data);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toEqual(data);
			}
		});

		test('creates a successful result with null', () => {
			const result = ok(null);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(null);
			}
		});

		test('creates a successful result with undefined', () => {
			const result = ok(undefined);
			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value).toBe(undefined);
			}
		});
	});

	describe('err', () => {
		test('creates a failed result', () => {
			const error = new DomainError('TEST_ERROR', 'Test error message');
			const result = err(error);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe(error);
			}
		});

		test('creates a failed result with custom error type', () => {
			const error = { message: 'Custom error' };
			const result = err(error);
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toEqual(error);
			}
		});

		test('creates a failed result with string error', () => {
			const result = err('Something went wrong');
			expect(result.ok).toBe(false);
			if (!result.ok) {
				expect(result.error).toBe('Something went wrong');
			}
		});
	});

	describe('isOk', () => {
		test('returns true for successful result', () => {
			const result = ok(42);
			expect(isOk(result)).toBe(true);
		});

		test('returns false for failed result', () => {
			const result = err(new DomainError('TEST_ERROR'));
			expect(isOk(result)).toBe(false);
		});

		test('type guards correctly', () => {
			const result: Result<number> = ok(42);
			if (isOk(result)) {
				// TypeScript knows result.value is available
				const value: number = result.value;
				expect(value).toBe(42);
			}
		});
	});

	describe('isErr', () => {
		test('returns false for successful result', () => {
			const result = ok(42);
			expect(isErr(result)).toBe(false);
		});

		test('returns true for failed result', () => {
			const result = err(new DomainError('TEST_ERROR'));
			expect(isErr(result)).toBe(true);
		});

		test('type guards correctly', () => {
			const result: Result<number> = err(new DomainError('TEST_ERROR'));
			if (isErr(result)) {
				// TypeScript knows result.error is available
				const error: DomainError = result.error;
				expect(error.code).toBe('TEST_ERROR');
			}
		});
	});

	describe('Result patterns', () => {
		test('pattern matching with ok result', () => {
			const result: Result<number> = ok(42);

			const value = result.ok ? result.value : 0;
			expect(value).toBe(42);
		});

		test('pattern matching with err result', () => {
			const result: Result<number> = err(new DomainError('TEST_ERROR'));

			const value = result.ok ? result.value : 0;
			expect(value).toBe(0);
		});

		test('chaining results', () => {
			function divide(a: number, b: number): Result<number> {
				if (b === 0) {
					return err(new DomainError('DIVISION_BY_ZERO', 'Cannot divide by zero'));
				}
				return ok(a / b);
			}

			const result1 = divide(10, 2);
			expect(isOk(result1)).toBe(true);
			if (isOk(result1)) {
				expect(result1.value).toBe(5);
			}

			const result2 = divide(10, 0);
			expect(isErr(result2)).toBe(true);
			if (isErr(result2)) {
				expect(result2.error.code).toBe('DIVISION_BY_ZERO');
			}
		});
	});
});
