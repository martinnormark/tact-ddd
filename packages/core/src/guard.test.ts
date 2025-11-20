import { describe, expect, test } from 'bun:test';
import { ensure } from './guard';
import { InvariantViolation } from './errors';

describe('ensure', () => {
	test('does not throw when condition is true', () => {
		expect(() => ensure(true, 'TEST_CODE')).not.toThrow();
		expect(() => ensure(1, 'TEST_CODE')).not.toThrow();
		expect(() => ensure('non-empty', 'TEST_CODE')).not.toThrow();
		expect(() => ensure({}, 'TEST_CODE')).not.toThrow();
		expect(() => ensure([], 'TEST_CODE')).not.toThrow();
	});

	test('throws InvariantViolation when condition is false', () => {
		expect(() => ensure(false, 'TEST_CODE')).toThrow(InvariantViolation);
	});

	test('throws InvariantViolation when condition is null', () => {
		expect(() => ensure(null, 'TEST_CODE')).toThrow(InvariantViolation);
	});

	test('throws InvariantViolation when condition is undefined', () => {
		expect(() => ensure(undefined, 'TEST_CODE')).toThrow(InvariantViolation);
	});

	test('throws InvariantViolation when condition is 0', () => {
		expect(() => ensure(0, 'TEST_CODE')).toThrow(InvariantViolation);
	});

	test('throws InvariantViolation when condition is empty string', () => {
		expect(() => ensure('', 'TEST_CODE')).toThrow(InvariantViolation);
	});

	test('throws with correct code', () => {
		try {
			ensure(false, 'INVALID_STATE');
			expect.unreachable('Should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(InvariantViolation);
			expect((error as InvariantViolation).code).toBe('INVALID_STATE');
		}
	});

	test('throws with custom message when provided', () => {
		try {
			ensure(false, 'INVALID_STATE', 'Custom error message');
			expect.unreachable('Should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(InvariantViolation);
			expect((error as InvariantViolation).message).toBe('Custom error message');
		}
	});

	test('throws with code as message when no custom message provided', () => {
		try {
			ensure(false, 'INVALID_STATE');
			expect.unreachable('Should have thrown');
		} catch (error) {
			expect(error).toBeInstanceOf(InvariantViolation);
			expect((error as InvariantViolation).message).toBe('INVALID_STATE');
		}
	});

	test('type narrows correctly after ensure', () => {
		const value: string | null = 'test';
		ensure(value !== null, 'VALUE_NULL');
		// If ensure passes, TypeScript knows value is string, not null
		const length: number = value.length;
		expect(length).toBe(4);
	});
});
