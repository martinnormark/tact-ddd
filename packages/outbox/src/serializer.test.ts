import { describe, expect, test } from 'bun:test';
import { IntegrationEventBase } from '@tact-ddd/events';
import type { OutboxSerializer } from './serializer';
import type { OutboxMessage } from './outbox-message';

// Test event classes
class UserCreatedEvent extends IntegrationEventBase {
	constructor(public readonly userId: string, public readonly email: string, correlationId?: string, causationId?: string) {
		super('UserCreated', 'test-service', correlationId, causationId);
	}
}

class OrderPlacedEvent extends IntegrationEventBase {
	constructor(public readonly orderId: string, public readonly amount: number, correlationId?: string, causationId?: string) {
		super('OrderPlaced', 'test-service', correlationId, causationId);
	}
}

class ProductUpdatedEvent extends IntegrationEventBase {
	constructor(public readonly productId: string) {
		super('ProductUpdated', 'test-service');
	}
}

describe('OutboxSerializer', () => {
	test('serializes integration event correctly', () => {
		const serializer: OutboxSerializer = {
			serialize: (event) => ({
				eventName: event.name,
				eventType: event.constructor.name,
				payload: JSON.stringify(event),
				occurredAt: event.occurredAt,
				correlationId: event.correlationId,
				causationId: event.causationId,
			}),
			deserialize: (message) => {
				const data = JSON.parse(message.payload as string);
				return new UserCreatedEvent(data.userId, data.email, message.correlationId, message.causationId);
			},
		};

		const event = new UserCreatedEvent('user_123', 'test@example.com', 'corr_123', 'cause_456');

		const serialized = serializer.serialize(event);

		expect(serialized.eventName).toBe('UserCreated');
		expect(serialized.eventType).toBe('UserCreatedEvent');
		expect(typeof serialized.payload).toBe('string');
		expect(serialized.occurredAt).toEqual(event.occurredAt);
		expect(serialized.correlationId).toBe('corr_123');
		expect(serialized.causationId).toBe('cause_456');
	});

	test('deserializes outbox message back to integration event', () => {
		const serializer: OutboxSerializer = {
			serialize: (event) => ({
				eventName: event.name,
				eventType: event.constructor.name,
				payload: JSON.stringify(event),
				occurredAt: event.occurredAt,
				correlationId: event.correlationId,
				causationId: event.causationId,
			}),
			deserialize: (message) => {
				const data = JSON.parse(message.payload as string);
				return new OrderPlacedEvent(data.orderId, data.amount, message.correlationId, message.causationId);
			},
		};

		const outboxMessage: OutboxMessage = {
			id: 'msg_123',
			eventName: 'OrderPlaced',
			eventType: 'OrderPlacedEvent',
			payload: JSON.stringify({ orderId: 'order_456', amount: 99.99 }),
			occurredAt: new Date('2025-11-20T11:00:00Z'),
			createdAt: new Date('2025-11-20T11:00:01Z'),
			status: 'pending',
			retryCount: 0,
			correlationId: 'corr_789',
			causationId: 'cause_012',
		};

		const event = serializer.deserialize(outboxMessage);

		expect(event.name).toBe('OrderPlaced');
		// Note: IntegrationEventBase sets occurredAt to new Date() in constructor
		// so we just verify it exists and is a Date
		expect(event.occurredAt).toBeInstanceOf(Date);
		expect(event.correlationId).toBe('corr_789');
		expect(event.causationId).toBe('cause_012');
		expect((event as OrderPlacedEvent).orderId).toBe('order_456');
		expect((event as OrderPlacedEvent).amount).toBe(99.99);
	});

	test('handles events without optional fields', () => {
		const serializer: OutboxSerializer = {
			serialize: (event) => ({
				eventName: event.name,
				eventType: event.constructor.name,
				payload: JSON.stringify(event),
				occurredAt: event.occurredAt,
				correlationId: event.correlationId,
				causationId: event.causationId,
			}),
			deserialize: (message) => {
				const data = JSON.parse(message.payload as string);
				return new ProductUpdatedEvent(data.productId);
			},
		};

		const event = new ProductUpdatedEvent('prod_789');

		const serialized = serializer.serialize(event);

		expect(serialized.eventName).toBe('ProductUpdated');
		expect(serialized.correlationId).toBeUndefined();
		expect(serialized.causationId).toBeUndefined();
	});
});
