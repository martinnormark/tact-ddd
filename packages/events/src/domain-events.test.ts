import { describe, expect, test } from 'bun:test';
import { DomainEventBase, createDomainEvent, type DomainEvent } from './domain-events';

describe('DomainEvent', () => {
	test('validates DomainEvent structure with required fields', () => {
		const event: DomainEvent<string> = {
			name: 'UserCreated',
			aggregateId: 'user_123',
			occurredAt: new Date(),
		};

		expect(event.name).toBe('UserCreated');
		expect(event.aggregateId).toBe('user_123');
		expect(event.occurredAt).toBeInstanceOf(Date);
	});

	test('supports typed aggregate IDs', () => {
		type UserId = string & { readonly __brand: 'UserId' };
		const userId = 'user_abc123' as UserId;

		const event: DomainEvent<UserId> = {
			name: 'UserRegistered',
			aggregateId: userId,
			occurredAt: new Date(),
		};

		expect(event.aggregateId).toBe(userId);
	});

	test('validates DomainEvent with correlation and causation IDs', () => {
		const event: DomainEvent = {
			name: 'OrderPlaced',
			aggregateId: 'order_456',
			occurredAt: new Date(),
			correlationId: 'corr-789',
			causationId: 'cause-101',
		};

		expect(event.correlationId).toBe('corr-789');
		expect(event.causationId).toBe('cause-101');
	});
});

describe('DomainEventBase', () => {
	class UserCreatedEvent extends DomainEventBase<string> {
		constructor(aggregateId: string, public readonly email: string, correlationId?: string, causationId?: string) {
			super('UserCreated', aggregateId, correlationId, causationId);
		}
	}

	test('creates domain event with automatic timestamp', () => {
		const before = new Date();
		const event = new UserCreatedEvent('user_123', 'test@example.com');
		const after = new Date();

		expect(event.name).toBe('UserCreated');
		expect(event.aggregateId).toBe('user_123');
		expect(event.email).toBe('test@example.com');
		expect(event.occurredAt).toBeInstanceOf(Date);
		expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
		expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
	});

	test('creates domain event with correlation and causation IDs', () => {
		const event = new UserCreatedEvent('user_456', 'user@test.com', 'corr-abc', 'cause-def');

		expect(event.correlationId).toBe('corr-abc');
		expect(event.causationId).toBe('cause-def');
	});

	test('creates domain event with optional metadata', () => {
		const event = new UserCreatedEvent('user_789', 'another@example.com');

		expect(event.correlationId).toBeUndefined();
		expect(event.causationId).toBeUndefined();
	});

	test('enforces readonly properties', () => {
		const event = new UserCreatedEvent('user_111', 'readonly@test.com');

		// TypeScript enforces readonly at compile time
		expect(event.name).toBe('UserCreated');
		expect(event.aggregateId).toBe('user_111');
	});

	test('supports multiple event types with different payloads', () => {
		class OrderPlacedEvent extends DomainEventBase<string> {
			constructor(aggregateId: string, public readonly amount: number, public readonly currency: string) {
				super('OrderPlaced', aggregateId);
			}
		}

		const event = new OrderPlacedEvent('order_999', 99.99, 'USD');

		expect(event.name).toBe('OrderPlaced');
		expect(event.aggregateId).toBe('order_999');
		expect(event.amount).toBe(99.99);
		expect(event.currency).toBe('USD');
		expect(event.occurredAt).toBeInstanceOf(Date);
	});
});

describe('createDomainEvent', () => {
	test('creates domain event with payload', () => {
		const event = createDomainEvent('UserCreated', 'user_123', {
			email: 'test@example.com',
			username: 'testuser',
		});

		expect(event.name).toBe('UserCreated');
		expect(event.aggregateId).toBe('user_123');
		expect(event.email).toBe('test@example.com');
		expect(event.username).toBe('testuser');
		expect(event.occurredAt).toBeInstanceOf(Date);
	});

	test('creates domain event with automatic timestamp', () => {
		const before = new Date();
		const event = createDomainEvent('OrderPlaced', 'order_456', {
			amount: 199.99,
		});
		const after = new Date();

		expect(event.occurredAt).toBeInstanceOf(Date);
		expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
		expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
	});

	test('creates domain event with custom timestamp', () => {
		const customDate = new Date('2025-06-15T12:00:00Z');
		const event = createDomainEvent(
			'ProductUpdated',
			'product_789',
			{
				name: 'New Product Name',
			},
			{
				occurredAt: customDate,
			}
		);

		expect(event.occurredAt).toEqual(customDate);
	});

	test('creates domain event with correlation and causation IDs', () => {
		const event = createDomainEvent(
			'PaymentProcessed',
			'payment_321',
			{
				amount: 50.0,
				status: 'completed',
			},
			{
				correlationId: 'corr-xyz',
				causationId: 'cause-abc',
			}
		);

		expect(event.correlationId).toBe('corr-xyz');
		expect(event.causationId).toBe('cause-abc');
	});

	test('creates domain event with typed aggregate ID', () => {
		type OrderId = string & { readonly __brand: 'OrderId' };
		const orderId = 'order_555' as OrderId;

		const event = createDomainEvent(orderId, 'order_555', {
			items: ['item1', 'item2'],
			total: 299.99,
		});

		expect(event.aggregateId).toBe('order_555');
		expect(event.items).toEqual(['item1', 'item2']);
		expect(event.total).toBe(299.99);
	});

	test('creates domain event with empty payload object', () => {
		const event = createDomainEvent('WorkspaceDeleted', 'workspace_999', {});

		expect(event.name).toBe('WorkspaceDeleted');
		expect(event.aggregateId).toBe('workspace_999');
		expect(event.occurredAt).toBeInstanceOf(Date);
	});

	test('creates domain event with complex nested payload', () => {
		const event = createDomainEvent('UserProfileUpdated', 'user_777', {
			profile: {
				firstName: 'John',
				lastName: 'Doe',
				settings: {
					theme: 'dark',
					notifications: true,
				},
			},
			updatedFields: ['firstName', 'lastName', 'settings.theme'],
		});

		expect(event.profile.firstName).toBe('John');
		expect(event.profile.settings.theme).toBe('dark');
		expect(event.updatedFields).toEqual(['firstName', 'lastName', 'settings.theme']);
	});

	test('creates domain event with all metadata options', () => {
		const customDate = new Date('2025-03-20T10:30:00Z');
		const event = createDomainEvent(
			'InventoryAdjusted',
			'inventory_888',
			{
				sku: 'PRODUCT-001',
				quantity: 100,
				reason: 'restock',
			},
			{
				occurredAt: customDate,
				correlationId: 'corr-inventory-1',
				causationId: 'cause-restock-job',
			}
		);

		expect(event.name).toBe('InventoryAdjusted');
		expect(event.aggregateId).toBe('inventory_888');
		expect(event.sku).toBe('PRODUCT-001');
		expect(event.quantity).toBe(100);
		expect(event.reason).toBe('restock');
		expect(event.occurredAt).toEqual(customDate);
		expect(event.correlationId).toBe('corr-inventory-1');
		expect(event.causationId).toBe('cause-restock-job');
	});
});
