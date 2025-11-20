import { describe, expect, test, mock } from 'bun:test';
import { IntegrationEventBase } from '@tact-ddd/events';
import type { IntegrationEvent, IntegrationEventBus } from '@tact-ddd/events';
import { OutboxProcessor } from './processor';
import type { OutboxStore } from './store';
import type { OutboxMessage } from './outbox-message';
import type { OutboxSerializer } from './serializer';

// Test event class
class TestEvent extends IntegrationEventBase {
	constructor(public readonly testId: string, correlationId?: string, causationId?: string) {
		super('TestEvent', 'test-service', correlationId, causationId);
	}
}

// Mock OutboxStore
class MockOutboxStore implements OutboxStore {
	private messages: OutboxMessage[] = [];
	private idCounter = 1;

	constructor(public readonly serializer: OutboxSerializer) {}

	async add(event: IntegrationEvent): Promise<void> {
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

	getAll(): OutboxMessage[] {
		return this.messages;
	}

	clear(): void {
		this.messages = [];
		this.idCounter = 1;
	}
}

// Mock IntegrationEventBus
class MockEventBus implements IntegrationEventBus {
	private publishedEvents: IntegrationEvent[] = [];
	private shouldFail = false;

	async publish(event: IntegrationEvent): Promise<void> {
		if (this.shouldFail) {
			throw new Error('Bus publishing failed');
		}
		this.publishedEvents.push(event);
	}

	async publishAll(events: IntegrationEvent[]): Promise<void> {
		if (this.shouldFail) {
			throw new Error('Bus publishing failed');
		}
		this.publishedEvents.push(...events);
	}

	getPublished(): IntegrationEvent[] {
		return this.publishedEvents;
	}

	setShouldFail(value: boolean): void {
		this.shouldFail = value;
	}

	clear(): void {
		this.publishedEvents = [];
	}
}

describe('OutboxProcessor', () => {
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

	test('processes pending messages and publishes to bus', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus);

		// Add test events
		await store.add(new TestEvent('test_1'));
		await store.add(new TestEvent('test_2'));

		await processor.runOnce();

		const published = bus.getPublished();
		expect(published.length).toBe(2);
		expect((published[0] as TestEvent).testId).toBe('test_1');
		expect((published[1] as TestEvent).testId).toBe('test_2');

		// Messages should be marked as processed
		const messages = store.getAll();
		expect(messages.every((msg) => msg.status === 'processed')).toBe(true);
	});

	test('respects batch size limit', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus, { batchSize: 2 });

		// Add 5 events
		for (let i = 1; i <= 5; i++) {
			await store.add(new TestEvent(`test_${i}`));
		}

		await processor.runOnce();

		const published = bus.getPublished();
		expect(published.length).toBe(2);

		// Only 2 messages should be processed
		const messages = store.getAll();
		const processedCount = messages.filter((msg) => msg.status === 'processed').length;
		expect(processedCount).toBe(2);
	});

	test('handles publishing failures and marks messages as failed', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		bus.setShouldFail(true);
		const processor = new OutboxProcessor(store, bus);

		await store.add(new TestEvent('test_1'));

		await processor.runOnce();

		const messages = store.getAll();
		expect(messages[0]?.status).toBe('failed');
		expect(messages[0]?.lastError).toBe('Bus publishing failed');
		expect(messages[0]?.retryCount).toBe(1);
	});

	test('does nothing when there are no pending messages', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus);

		await processor.runOnce();

		const published = bus.getPublished();
		expect(published.length).toBe(0);
	});

	test('processes multiple batches correctly', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus, { batchSize: 2 });

		// Add 5 events
		for (let i = 1; i <= 5; i++) {
			await store.add(new TestEvent(`test_${i}`));
		}

		// First batch
		await processor.runOnce();
		expect(bus.getPublished().length).toBe(2);

		// Second batch
		await processor.runOnce();
		expect(bus.getPublished().length).toBe(4);

		// Third batch
		await processor.runOnce();
		expect(bus.getPublished().length).toBe(5);

		// All messages should be processed
		const messages = store.getAll();
		expect(messages.every((msg) => msg.status === 'processed')).toBe(true);
	});

	test('handles mixed success and failure scenarios', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus);

		await store.add(new TestEvent('test_1'));
		await store.add(new TestEvent('test_2'));
		await store.add(new TestEvent('test_3'));

		// First run succeeds
		await processor.runOnce();

		const messages = store.getAll();
		expect(messages.filter((msg) => msg.status === 'processed').length).toBe(3);

		// Add more events
		await store.add(new TestEvent('test_4'));
		await store.add(new TestEvent('test_5'));

		// Make bus fail for second run
		bus.setShouldFail(true);
		await processor.runOnce();

		const updatedMessages = store.getAll();
		const failedCount = updatedMessages.filter((msg) => msg.status === 'failed').length;
		expect(failedCount).toBe(2);
	});

	test('preserves correlation and causation IDs', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus);

		await store.add(new TestEvent('test_1', 'corr_123', 'cause_456'));

		await processor.runOnce();

		const published = bus.getPublished();
		expect(published[0]?.correlationId).toBe('corr_123');
		expect(published[0]?.causationId).toBe('cause_456');
	});

	test('uses default options when not provided', async () => {
		const store = new MockOutboxStore(mockSerializer);
		const bus = new MockEventBus();
		const processor = new OutboxProcessor(store, bus);

		// Add more than 100 events to test default batch size
		for (let i = 1; i <= 150; i++) {
			await store.add(new TestEvent(`test_${i}`));
		}

		await processor.runOnce();

		// Should process 100 (default batch size)
		const published = bus.getPublished();
		expect(published.length).toBe(100);
	});
});
