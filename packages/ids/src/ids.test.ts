import { describe, expect, test } from 'bun:test';
import { defineIdType } from './ids';

describe('defineIdType', () => {
	test('creates and validates IDs correctly', () => {
		const UserId = defineIdType({ prefix: 'user', length: 10 });

		const newId = UserId.create();
		expect(typeof newId).toBe('string');
		expect(newId.startsWith('user_')).toBe(true);
		expect(newId.length).toBe('user_'.length + 10);
	});

	test('parses valid IDs and rejects invalid ones', () => {
		const OrderId = defineIdType({ prefix: 'order', length: 12 });
		const validId = OrderId.create();

		const parsedId = OrderId.parse(validId);
		expect(parsedId).toBe(validId);

		expect(() => OrderId.parse('invalid_prefix_123456')).toThrow();
		expect(() => OrderId.parse('order_123')).toThrow();
	});

	test('does not allow characters outside the defined alphabet', () => {
		const ProductId = defineIdType({ prefix: 'product', length: 8, strict: true });
		const validId = ProductId.create();

		// Assuming the ID generator only uses alphanumeric characters
		expect(ProductId.is(validId)).toBe(true);
		expect(() => ProductId.parse('product_!@#$%^&*')).toThrow();
	});

	test('non-strict allow characters outside the defined alphabet', () => {
		const ProductId = defineIdType({ prefix: 'product', length: 8, strict: false });
		const validId = ProductId.create();

		ProductId.parse('product_!@#$%^&*');

		// Assuming the ID generator only uses alphanumeric characters
		expect(ProductId.is(validId)).toBe(true);
		expect(() => ProductId.parse('product_!@#$%^&*')).not.toThrow();
	});
});
