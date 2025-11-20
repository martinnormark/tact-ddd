import { describe, expect, test } from 'bun:test';
import { DomainError, InvariantViolation, NotFoundError } from './errors';

describe('DomainError', () => {
	test('creates error with code', () => {
		const error = new DomainError('TEST_ERROR');
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(DomainError);
		expect(error.code).toBe('TEST_ERROR');
	});

	test('uses code as message when no message provided', () => {
		const error = new DomainError('TEST_ERROR');
		expect(error.message).toBe('TEST_ERROR');
	});

	test('uses custom message when provided', () => {
		const error = new DomainError('TEST_ERROR', 'This is a custom error message');
		expect(error.code).toBe('TEST_ERROR');
		expect(error.message).toBe('This is a custom error message');
	});

	test('has correct prototype chain', () => {
		const error = new DomainError('TEST_ERROR');
		expect(error instanceof Error).toBe(true);
		expect(error instanceof DomainError).toBe(true);
	});

	test('can be caught as Error', () => {
		try {
			throw new DomainError('TEST_ERROR', 'Test message');
		} catch (e) {
			expect(e instanceof Error).toBe(true);
			expect((e as Error).message).toBe('Test message');
		}
	});

	test('maintains stack trace', () => {
		const error = new DomainError('TEST_ERROR');
		expect(error.stack).toBeDefined();
		expect(error.stack).toContain('Error');
	});
});

describe('InvariantViolation', () => {
	test('extends DomainError', () => {
		const error = new InvariantViolation('INVARIANT_FAILED');
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(DomainError);
		expect(error).toBeInstanceOf(InvariantViolation);
	});

	test('creates error with code', () => {
		const error = new InvariantViolation('INVARIANT_FAILED');
		expect(error.code).toBe('INVARIANT_FAILED');
	});

	test('uses code as message when no message provided', () => {
		const error = new InvariantViolation('INVARIANT_FAILED');
		expect(error.message).toBe('INVARIANT_FAILED');
	});

	test('uses custom message when provided', () => {
		const error = new InvariantViolation('INVARIANT_FAILED', 'Age must be positive');
		expect(error.code).toBe('INVARIANT_FAILED');
		expect(error.message).toBe('Age must be positive');
	});

	test('can be caught as DomainError', () => {
		try {
			throw new InvariantViolation('INVARIANT_FAILED', 'Test message');
		} catch (e) {
			expect(e instanceof DomainError).toBe(true);
			expect((e as DomainError).code).toBe('INVARIANT_FAILED');
		}
	});
});

describe('NotFoundError', () => {
	test('extends DomainError', () => {
		const error = new NotFoundError('User', 'user_123');
		expect(error).toBeInstanceOf(Error);
		expect(error).toBeInstanceOf(DomainError);
		expect(error).toBeInstanceOf(NotFoundError);
	});

	test('generates code from entity name', () => {
		const error = new NotFoundError('User', 'user_123');
		expect(error.code).toBe('User.NotFound');
	});

	test('generates message with entity name and id', () => {
		const error = new NotFoundError('User', 'user_123');
		expect(error.message).toBe("User with id 'user_123' was not found");
	});

	test('works with string ids', () => {
		const error = new NotFoundError('Order', 'order_456');
		expect(error.code).toBe('Order.NotFound');
		expect(error.message).toBe("Order with id 'order_456' was not found");
	});

	test('works with number ids', () => {
		const error = new NotFoundError('Product', 123);
		expect(error.code).toBe('Product.NotFound');
		expect(error.message).toBe("Product with id '123' was not found");
	});

	test('works with complex ids', () => {
		const id = { tenantId: 'tenant_1', userId: 'user_123' };
		const error = new NotFoundError('TenantUser', id);
		expect(error.code).toBe('TenantUser.NotFound');
		expect(error.message).toContain('[object Object]');
	});

	test('handles null id', () => {
		const error = new NotFoundError('User', null);
		expect(error.message).toBe("User with id 'null' was not found");
	});

	test('handles undefined id', () => {
		const error = new NotFoundError('User', undefined);
		expect(error.message).toBe("User with id 'undefined' was not found");
	});

	test('can be caught as DomainError', () => {
		try {
			throw new NotFoundError('User', 'user_123');
		} catch (e) {
			expect(e instanceof DomainError).toBe(true);
			expect((e as DomainError).code).toBe('User.NotFound');
		}
	});
});

describe('Error hierarchy', () => {
	test('all errors extend Error', () => {
		const domainError = new DomainError('TEST');
		const invariantViolation = new InvariantViolation('TEST');
		const notFoundError = new NotFoundError('User', '123');

		expect(domainError instanceof Error).toBe(true);
		expect(invariantViolation instanceof Error).toBe(true);
		expect(notFoundError instanceof Error).toBe(true);
	});

	test('specific errors extend DomainError', () => {
		const invariantViolation = new InvariantViolation('TEST');
		const notFoundError = new NotFoundError('User', '123');

		expect(invariantViolation instanceof DomainError).toBe(true);
		expect(notFoundError instanceof DomainError).toBe(true);
	});

	test('can catch specific error types', () => {
		let caughtType = '';

		try {
			throw new InvariantViolation('TEST');
		} catch (e) {
			if (e instanceof InvariantViolation) {
				caughtType = 'InvariantViolation';
			} else if (e instanceof DomainError) {
				caughtType = 'DomainError';
			}
		}

		expect(caughtType).toBe('InvariantViolation');
	});

	test('can catch as base DomainError', () => {
		const errors = [new DomainError('TEST'), new InvariantViolation('TEST'), new NotFoundError('User', '123')];

		errors.forEach((error) => {
			try {
				throw error;
			} catch (e) {
				expect(e instanceof DomainError).toBe(true);
			}
		});
	});
});
