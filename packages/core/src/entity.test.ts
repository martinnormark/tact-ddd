import { describe, expect, test } from 'bun:test';
import { Entity } from './entity';

class User extends Entity<string> {
	constructor(id: string, public readonly name: string) {
		super(id);
	}
}

class Product extends Entity<number> {
	constructor(id: number, public readonly name: string, public readonly price: number) {
		super(id);
	}
}

class Order extends Entity<string> {
	constructor(id: string, public readonly customerId: string) {
		super(id);
	}
}

describe('Entity', () => {
	describe('constructor', () => {
		test('creates entity with string id', () => {
			const user = new User('user_123', 'John Doe');
			expect(user.id).toBe('user_123');
			expect(user.name).toBe('John Doe');
		});

		test('creates entity with number id', () => {
			const product = new Product(1, 'Laptop', 999.99);
			expect(product.id).toBe(1);
			expect(product.name).toBe('Laptop');
			expect(product.price).toBe(999.99);
		});

		test('id is accessible', () => {
			const user = new User('user_123', 'John Doe');
			// TypeScript readonly prevents modification at compile time
			// At runtime, the property is still accessible
			expect(user.id).toBe('user_123');
		});
	});

	describe('equals', () => {
		test('returns true for entities with same id and type', () => {
			const user1 = new User('user_123', 'John Doe');
			const user2 = new User('user_123', 'Jane Smith'); // Different name, same ID
			expect(user1.equals(user2)).toBe(true);
		});

		test('returns false for entities with different ids', () => {
			const user1 = new User('user_123', 'John Doe');
			const user2 = new User('user_456', 'John Doe'); // Same name, different ID
			expect(user1.equals(user2)).toBe(false);
		});

		test('returns false for null', () => {
			const user = new User('user_123', 'John Doe');
			expect(user.equals(null)).toBe(false);
		});

		test('returns false for undefined', () => {
			const user = new User('user_123', 'John Doe');
			expect(user.equals(undefined)).toBe(false);
		});

		test('returns true when comparing same instance', () => {
			const user = new User('user_123', 'John Doe');
			expect(user.equals(user)).toBe(true);
		});

		test('returns false for different entity types even with same id', () => {
			const user = new User('123', 'John Doe');
			const order = new Order('123', 'customer_456');
			expect(user.equals(order as any)).toBe(false);
		});

		test('is symmetric', () => {
			const user1 = new User('user_123', 'John Doe');
			const user2 = new User('user_123', 'Jane Smith');

			expect(user1.equals(user2)).toBe(user2.equals(user1));
		});

		test('is transitive', () => {
			const user1 = new User('user_123', 'John Doe');
			const user2 = new User('user_123', 'Jane Smith');
			const user3 = new User('user_123', 'Bob Johnson');

			expect(user1.equals(user2)).toBe(true);
			expect(user2.equals(user3)).toBe(true);
			expect(user1.equals(user3)).toBe(true);
		});

		test('uses Object.is for id comparison', () => {
			const product1 = new Product(0, 'Product A', 10);
			const product2 = new Product(-0, 'Product B', 20);

			// Object.is(0, -0) is false, unlike 0 === -0
			expect(product1.equals(product2)).toBe(false);
		});

		test('handles NaN ids correctly', () => {
			const product1 = new Product(NaN, 'Product A', 10);
			const product2 = new Product(NaN, 'Product B', 20);

			// Object.is(NaN, NaN) is true, unlike NaN === NaN
			expect(product1.equals(product2)).toBe(true);
		});
	});

	describe('identity semantics', () => {
		test('entities are equal based on identity, not attributes', () => {
			const user1 = new User('user_123', 'John Doe');
			const user2 = new User('user_123', 'Completely Different Name');

			// Despite different names, they're the same entity
			expect(user1.equals(user2)).toBe(true);
		});

		test('different ids mean different entities even with identical attributes', () => {
			const product1 = new Product(1, 'Laptop', 999.99);
			const product2 = new Product(2, 'Laptop', 999.99);

			// Same attributes but different IDs
			expect(product1.equals(product2)).toBe(false);
		});
	});
});
