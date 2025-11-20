import { describe, expect, test } from 'bun:test';
import { IntegrationEventBase } from '@tact-ddd/events';
import type { OutboxStore } from './store';
import type { OutboxMessage } from './outbox-message';
import type { OutboxSerializer } from './serializer';

// Test event class
class TestEvent extends IntegrationEventBase {
	constructor(public readonly testId: string, correlationId?: string, causationId?: string) {
		super('TestEvent', 'test-service', correlationId, causationId);
	}
}

// Mock implementation of OutboxStore for testing
class MockOutboxStore implements OutboxStore {
	private messages: OutboxMessage[] = [];
	private idCounter = 1;

	constructor(public readonly serializer: OutboxSerializer) {}

	async add(event: TestEvent): Promise<void> {
		const serialized = this.serializer.serialize(event);
		const message: OutboxMessage = {
			id: `msg_${this.idCounter++}`,
			eventName: serialized.eventName,
			eventType: serialized.eventType,
			payload: serialized.payload,
			occurredAt: serialized.occurredAt,
			createdAt: new Date(),
			status: 'pending',
			retryCount: 0,
			correlationId: serialized.correlationId,
			causationId: serialized.causationId,
		};
		this.messages.push(message);
	}

	async getPending(batchSize: number): Promise<OutboxMessage[]> {
		return this.messages.filter((msg) => msg.status === 'pending').slice(0, batchSize);
	}

	async markProcessed(id: string): Promise<void> {
		const message = this.messages.find((msg) => msg.id === id);
		if (message) {
			(message as any).status = 'processed';
		}
	}

	async markFailed(id: string, error: string): Promise<void> {
		const message = this.messages.find((msg) => msg.id === id);
		if (message) {
			(message as any).status = 'failed';
			(message as any).lastError = error;
			(message as any).retryCount += 1;
		}
	}

	// Test helper methods
	getAll(): OutboxMessage[] {
		return this.messages;
	}

	clear(): void {
		this.messages = [];
		this.idCounter = 1;
	}
}

describe('OutboxStore', () => {
	const mockSerializer: OutboxSerializer = {
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
			return new TestEvent(data.testId, message.correlationId, message.causationId);
		},
	};

	test('adds event to outbox with pending status', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const event = new TestEvent('test_123', 'corr_456', 'cause_789');

		await store.add(event);

		const messages = store.getAll();
		expect(messages.length).toBe(1);
		expect(messages[0]!.eventName).toBe('TestEvent');
		expect(messages[0]!.status).toBe('pending');
		expect(messages[0]!.retryCount).toBe(0);
		expect(messages[0]!.correlationId).toBe('corr_456');
		expect(messages[0]!.causationId).toBe('cause_789');
	});

	test('retrieves pending messages up to batch size', async () => {
		const store = new MockOutboxStore(mockSerializer);

		// Add 5 events
		for (let i = 1; i <= 5; i++) {
			await store.add(new TestEvent(`test_${i}`));
		}

		const pending = await store.getPending(3);
		expect(pending.length).toBe(3);
		expect(pending.every((msg) => msg.status === 'pending')).toBe(true);
	});

	test('marks message as processed', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const event = new TestEvent('test_123');

		await store.add(event);
		const messages = store.getAll();
		const messageId = messages[0]!.id;

		await store.markProcessed(messageId);

		const updatedMessages = store.getAll();
		expect(updatedMessages[0]!.status).toBe('processed');
	});

	test('marks message as failed with error and increments retry count', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const event = new TestEvent('test_123');

		await store.add(event);
		const messages = store.getAll();
		const messageId = messages[0]!.id;

		await store.markFailed(messageId, 'Connection timeout');

		const updatedMessages = store.getAll();
		expect(updatedMessages[0]!.status).toBe('failed');
		expect(updatedMessages[0]!.lastError).toBe('Connection timeout');
		expect(updatedMessages[0]!.retryCount).toBe(1);
	});

	test('does not return processed messages in pending batch', async () => {
		const store = new MockOutboxStore(mockSerializer);

		// Add 3 events
		await store.add(new TestEvent('test_1'));
		await store.add(new TestEvent('test_2'));
		await store.add(new TestEvent('test_3'));

		// Mark first one as processed
		const messages = store.getAll();
		await store.markProcessed(messages[0]!.id);

		const pending = await store.getPending(10);
		expect(pending.length).toBe(2);
		expect(pending.some((msg) => msg.id === messages[0]!.id)).toBe(false);
	});

	test('serializes event payload correctly', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const event = new TestEvent('test_456', 'corr_123');

		await store.add(event);

		const messages = store.getAll();
		const payload = JSON.parse(messages[0]!.payload as string);
		expect(payload.testId).toBe('test_456');
		expect(payload.name).toBe('TestEvent');
	});
});
