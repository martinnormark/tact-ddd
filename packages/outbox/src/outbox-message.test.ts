import { describe, expect, test } from 'bun:test';
import type { OutboxMessage, OutboxMessageStatus } from './outbox-message';

describe('OutboxMessage', () => {
	test('creates valid outbox message with all fields', () => {
		const message: OutboxMessage = {
			id: 'msg_123',
			eventName: 'UserCreated',
			eventType: 'user.UserCreatedIntegrationEvent',
			payload: { userId: 'user_456', email: 'test@example.com' },
			occurredAt: new Date('2025-11-20T10:00:00Z'),
			createdAt: new Date('2025-11-20T10:00:01Z'),
			status: 'pending',
			retryCount: 0,
			correlationId: 'corr_789',
			causationId: 'cause_012',
		};

		expect(message.id).toBe('msg_123');
		expect(message.eventName).toBe('UserCreated');
		expect(message.eventType).toBe('user.UserCreatedIntegrationEvent');
		expect(message.status).toBe('pending');
		expect(message.retryCount).toBe(0);
		expect(message.correlationId).toBe('corr_789');
		expect(message.causationId).toBe('cause_012');
	});

	test('creates valid outbox message without optional fields', () => {
		const message: OutboxMessage = {
			id: 'msg_456',
			eventName: 'OrderPlaced',
			eventType: 'order.OrderPlacedIntegrationEvent',
			payload: { orderId: 'order_789' },
			occurredAt: new Date('2025-11-20T11:00:00Z'),
			createdAt: new Date('2025-11-20T11:00:01Z'),
			status: 'pending',
			retryCount: 0,
		};

		expect(message.id).toBe('msg_456');
		expect(message.correlationId).toBeUndefined();
		expect(message.causationId).toBeUndefined();
		expect(message.lastError).toBeUndefined();
	});

	test('supports all status types', () => {
		const statuses: OutboxMessageStatus[] = ['pending', 'processing', 'failed', 'processed'];

		statuses.forEach((status) => {
			const message: OutboxMessage = {
				id: `msg_${status}`,
				eventName: 'TestEvent',
				eventType: 'test.TestIntegrationEvent',
				payload: {},
				occurredAt: new Date(),
				createdAt: new Date(),
				status,
				retryCount: 0,
			};

			expect(message.status).toBe(status);
		});
	});

	test('handles failed status with error message', () => {
		const message: OutboxMessage = {
			id: 'msg_failed',
			eventName: 'PaymentProcessed',
			eventType: 'payment.PaymentProcessedIntegrationEvent',
			payload: { paymentId: 'pay_123' },
			occurredAt: new Date('2025-11-20T12:00:00Z'),
			createdAt: new Date('2025-11-20T12:00:01Z'),
			status: 'failed',
			retryCount: 3,
			lastError: 'Connection timeout after 3 attempts',
		};

		expect(message.status).toBe('failed');
		expect(message.retryCount).toBe(3);
		expect(message.lastError).toBe('Connection timeout after 3 attempts');
	});

	test('tracks retry count for failed messages', () => {
		const message: OutboxMessage = {
			id: 'msg_retry',
			eventName: 'EmailSent',
			eventType: 'notification.EmailSentIntegrationEvent',
			payload: { emailId: 'email_123' },
			occurredAt: new Date('2025-11-20T13:00:00Z'),
			createdAt: new Date('2025-11-20T13:00:01Z'),
			status: 'failed',
			retryCount: 5,
			lastError: 'SMTP server unreachable',
		};

		expect(message.retryCount).toBe(5);
	});

	test('allows different payload types', () => {
		const stringPayload: OutboxMessage = {
			id: 'msg_1',
			eventName: 'Event1',
			eventType: 'Event1Type',
			payload: 'string payload',
			occurredAt: new Date(),
			createdAt: new Date(),
			status: 'pending',
			retryCount: 0,
		};

		const objectPayload: OutboxMessage = {
			id: 'msg_2',
			eventName: 'Event2',
			eventType: 'Event2Type',
			payload: { key: 'value', nested: { data: 123 } },
			occurredAt: new Date(),
			createdAt: new Date(),
			status: 'pending',
			retryCount: 0,
		};

		const arrayPayload: OutboxMessage = {
			id: 'msg_3',
			eventName: 'Event3',
			eventType: 'Event3Type',
			payload: [1, 2, 3, 4, 5],
			occurredAt: new Date(),
			createdAt: new Date(),
			status: 'pending',
			retryCount: 0,
		};

		expect(stringPayload.payload).toBe('string payload');
		expect(objectPayload.payload).toEqual({ key: 'value', nested: { data: 123 } });
		expect(arrayPayload.payload).toEqual([1, 2, 3, 4, 5]);
	});

	test('maintains temporal ordering with occurredAt and createdAt', () => {
		const occurredAt = new Date('2025-11-20T10:00:00Z');
		const createdAt = new Date('2025-11-20T10:00:05Z');

		const message: OutboxMessage = {
			id: 'msg_temporal',
			eventName: 'TemporalEvent',
			eventType: 'temporal.TemporalIntegrationEvent',
			payload: {},
			occurredAt,
			createdAt,
			status: 'pending',
			retryCount: 0,
		};

		expect(message.occurredAt.getTime()).toBeLessThan(message.createdAt.getTime());
	});

	test('supports processing status for in-flight messages', () => {
		const message: OutboxMessage = {
			id: 'msg_processing',
			eventName: 'DataProcessed',
			eventType: 'data.DataProcessedIntegrationEvent',
			payload: { dataId: 'data_123' },
			occurredAt: new Date('2025-11-20T14:00:00Z'),
			createdAt: new Date('2025-11-20T14:00:01Z'),
			status: 'processing',
			retryCount: 0,
		};

		expect(message.status).toBe('processing');
	});

	test('supports processed status for completed messages', () => {
		const message: OutboxMessage = {
			id: 'msg_processed',
			eventName: 'TaskCompleted',
			eventType: 'task.TaskCompletedIntegrationEvent',
			payload: { taskId: 'task_123' },
			occurredAt: new Date('2025-11-20T15:00:00Z'),
			createdAt: new Date('2025-11-20T15:00:01Z'),
			status: 'processed',
			retryCount: 0,
		};

		expect(message.status).toBe('processed');
	});
});
