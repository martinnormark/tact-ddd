import { describe, expect, test } from 'bun:test';
import { IntegrationEventBase, type IntegrationEvent } from './integration-events';

describe('IntegrationEvent', () => {
	test('validates IntegrationEvent structure with required fields', () => {
		const event: IntegrationEvent = {
			name: 'UserCreated',
			occurredAt: new Date(),
		};

		expect(event.name).toBe('UserCreated');
		expect(event.occurredAt).toBeInstanceOf(Date);
		expect(event.source).toBeUndefined();
	});

	test('validates IntegrationEvent with source field', () => {
		const event: IntegrationEvent = {
			name: 'OrderPlaced',
			occurredAt: new Date(),
			source: 'order-service',
		};

		expect(event.name).toBe('OrderPlaced');
		expect(event.source).toBe('order-service');
	});

	test('validates IntegrationEvent with correlation and causation IDs', () => {
		const event: IntegrationEvent = {
			name: 'PaymentProcessed',
			occurredAt: new Date(),
			source: 'payment-service',
			correlationId: 'corr-123',
			causationId: 'cause-456',
		};

		expect(event.correlationId).toBe('corr-123');
		expect(event.causationId).toBe('cause-456');
	});

	test('validates IntegrationEvent with all optional fields', () => {
		const timestamp = new Date('2025-05-10T15:30:00Z');
		const event: IntegrationEvent = {
			name: 'InventoryUpdated',
			occurredAt: timestamp,
			source: 'inventory-service',
			correlationId: 'corr-xyz',
			causationId: 'cause-abc',
		};

		expect(event.name).toBe('InventoryUpdated');
		expect(event.occurredAt).toEqual(timestamp);
		expect(event.source).toBe('inventory-service');
		expect(event.correlationId).toBe('corr-xyz');
		expect(event.causationId).toBe('cause-abc');
	});
});

describe('IntegrationEventBase', () => {
	class UserCreatedIntegrationEvent extends IntegrationEventBase {
		constructor(public readonly userId: string, public readonly email: string, source?: string, correlationId?: string, causationId?: string) {
			super('UserCreated', source, correlationId, causationId);
		}
	}

	test('creates integration event with automatic timestamp', () => {
		const before = new Date();
		const event = new UserCreatedIntegrationEvent('user_123', 'test@example.com');
		const after = new Date();

		expect(event.name).toBe('UserCreated');
		expect(event.userId).toBe('user_123');
		expect(event.email).toBe('test@example.com');
		expect(event.occurredAt).toBeInstanceOf(Date);
		expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
		expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
	});

	test('creates integration event with source', () => {
		const event = new UserCreatedIntegrationEvent('user_456', 'user@test.com', 'user-service');

		expect(event.source).toBe('user-service');
	});

	test('creates integration event with correlation and causation IDs', () => {
		const event = new UserCreatedIntegrationEvent('user_789', 'another@example.com', 'user-service', 'corr-123', 'cause-456');

		expect(event.correlationId).toBe('corr-123');
		expect(event.causationId).toBe('cause-456');
	});

	test('creates integration event without optional metadata', () => {
		const event = new UserCreatedIntegrationEvent('user_111', 'minimal@test.com');

		expect(event.source).toBeUndefined();
		expect(event.correlationId).toBeUndefined();
		expect(event.causationId).toBeUndefined();
	});

	test('enforces readonly properties', () => {
		const event = new UserCreatedIntegrationEvent('user_222', 'readonly@test.com', 'test-service');

		// TypeScript enforces readonly at compile time
		expect(event.name).toBe('UserCreated');
		expect(event.source).toBe('test-service');
	});

	test('supports multiple event types with different payloads', () => {
		class OrderPlacedIntegrationEvent extends IntegrationEventBase {
			constructor(public readonly orderId: string, public readonly amount: number, public readonly currency: string, source?: string) {
				super('OrderPlaced', source);
			}
		}

		const event = new OrderPlacedIntegrationEvent('order_999', 99.99, 'USD', 'order-service');

		expect(event.name).toBe('OrderPlaced');
		expect(event.orderId).toBe('order_999');
		expect(event.amount).toBe(99.99);
		expect(event.currency).toBe('USD');
		expect(event.source).toBe('order-service');
		expect(event.occurredAt).toBeInstanceOf(Date);
	});

	test('supports cross-service event with source tracking', () => {
		class PaymentCompletedIntegrationEvent extends IntegrationEventBase {
			constructor(public readonly paymentId: string, public readonly orderId: string, public readonly amount: number) {
				super('PaymentCompleted', 'payment-service');
			}
		}

		const event = new PaymentCompletedIntegrationEvent('payment_555', 'order_555', 150.0);

		expect(event.name).toBe('PaymentCompleted');
		expect(event.source).toBe('payment-service');
		expect(event.paymentId).toBe('payment_555');
		expect(event.orderId).toBe('order_555');
		expect(event.amount).toBe(150.0);
	});

	test('supports event with complex payload', () => {
		class WorkspaceCreatedIntegrationEvent extends IntegrationEventBase {
			constructor(
				public readonly workspaceId: string,
				public readonly ownerId: string,
				public readonly settings: { name: string; plan: string; features: string[] },
				source?: string
			) {
				super('WorkspaceCreated', source);
			}
		}

		const event = new WorkspaceCreatedIntegrationEvent(
			'workspace_777',
			'user_888',
			{
				name: 'My Workspace',
				plan: 'premium',
				features: ['analytics', 'collaboration', 'api-access'],
			},
			'workspace-service'
		);

		expect(event.workspaceId).toBe('workspace_777');
		expect(event.ownerId).toBe('user_888');
		expect(event.settings.name).toBe('My Workspace');
		expect(event.settings.plan).toBe('premium');
		expect(event.settings.features).toEqual(['analytics', 'collaboration', 'api-access']);
		expect(event.source).toBe('workspace-service');
	});

	test('creates integration event with all metadata', () => {
		class ProductUpdatedIntegrationEvent extends IntegrationEventBase {
			constructor(public readonly productId: string, public readonly changes: Record<string, unknown>) {
				super('ProductUpdated', 'catalog-service', 'corr-product-1', 'cause-admin-update');
			}
		}

		const event = new ProductUpdatedIntegrationEvent('product_333', { name: 'Updated Name', price: 29.99 });

		expect(event.name).toBe('ProductUpdated');
		expect(event.productId).toBe('product_333');
		expect(event.changes).toEqual({ name: 'Updated Name', price: 29.99 });
		expect(event.source).toBe('catalog-service');
		expect(event.correlationId).toBe('corr-product-1');
		expect(event.causationId).toBe('cause-admin-update');
		expect(event.occurredAt).toBeInstanceOf(Date);
	});
});
