import { describe, expect, test } from 'bun:test';
import { InMemoryDomainEventDispatcher, InMemoryIntegrationEventBus, type DomainEventHandler, type IntegrationEventHandler } from './dispatcher';
import { createDomainEvent, type DomainEvent } from './domain-events';
import type { IntegrationEvent } from './integration-events';

describe('InMemoryDomainEventDispatcher', () => {
	test('registers and publishes events to handlers', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		const handledEvents: DomainEvent[] = [];

		const handler: DomainEventHandler = {
			handle: async (event) => {
				handledEvents.push(event);
			},
		};

		dispatcher.register('UserCreated', handler);

		const event = createDomainEvent('UserCreated', 'user_123', {
			email: 'test@example.com',
		});

		await dispatcher.publish(event);

		expect(handledEvents).toHaveLength(1);
		expect(handledEvents[0]!.name).toBe('UserCreated');
		expect(handledEvents[0]!.aggregateId).toBe('user_123');
	});

	test('publishes events to multiple handlers', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		const handler1Events: DomainEvent[] = [];
		const handler2Events: DomainEvent[] = [];

		const handler1: DomainEventHandler = {
			handle: async (event) => {
				handler1Events.push(event);
			},
		};

		const handler2: DomainEventHandler = {
			handle: async (event) => {
				handler2Events.push(event);
			},
		};

		dispatcher.register('OrderPlaced', handler1);
		dispatcher.register('OrderPlaced', handler2);

		const event = createDomainEvent('OrderPlaced', 'order_456', {
			amount: 99.99,
		});

		await dispatcher.publish(event);

		expect(handler1Events).toHaveLength(1);
		expect(handler2Events).toHaveLength(1);
		expect(handler1Events[0]!.name).toBe('OrderPlaced');
		expect(handler2Events[0]!.name).toBe('OrderPlaced');
	});

	test('does not publish to handlers for different event names', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		const handledEvents: string[] = [];

		const userHandler: DomainEventHandler = {
			handle: async (event) => {
				handledEvents.push(event.name);
			},
		};

		const orderHandler: DomainEventHandler = {
			handle: async (event) => {
				handledEvents.push(event.name);
			},
		};

		dispatcher.register('UserCreated', userHandler);
		dispatcher.register('OrderPlaced', orderHandler);

		const event = createDomainEvent('UserCreated', 'user_789', {
			email: 'user@test.com',
		});

		await dispatcher.publish(event);

		expect(handledEvents).toHaveLength(1);
		expect(handledEvents[0]).toBe('UserCreated');
	});

	test('handles events with no registered handlers gracefully', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();

		const event = createDomainEvent('UnhandledEvent', 'entity_999', {
			data: 'test',
		});

		// Should not throw
		await expect(dispatcher.publish(event)).resolves.toBeUndefined();
	});

	test('publishes all events in sequence', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		const handledEvents: DomainEvent[] = [];

		const handler: DomainEventHandler = {
			handle: async (event) => {
				handledEvents.push(event);
			},
		};

		dispatcher.register('UserCreated', handler);
		dispatcher.register('OrderPlaced', handler);

		const events = [
			createDomainEvent('UserCreated', 'user_111', { email: 'user1@test.com' }),
			createDomainEvent('OrderPlaced', 'order_222', { amount: 50.0 }),
			createDomainEvent('UserCreated', 'user_333', { email: 'user2@test.com' }),
		];

		await dispatcher.publishAll(events);

		expect(handledEvents).toHaveLength(3);
		expect(handledEvents[0]!.name).toBe('UserCreated');
		expect(handledEvents[1]!.name).toBe('OrderPlaced');
		expect(handledEvents[2]!.name).toBe('UserCreated');
	});

	test('supports synchronous handlers', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		const handledEvents: DomainEvent[] = [];

		const handler: DomainEventHandler = {
			handle: (event) => {
				handledEvents.push(event);
			},
		};

		dispatcher.register('SyncEvent', handler);

		const event = createDomainEvent('SyncEvent', 'sync_123', {
			data: 'synchronous',
		});

		await dispatcher.publish(event);

		expect(handledEvents).toHaveLength(1);
		expect(handledEvents[0]!.name).toBe('SyncEvent');
	});

	test('executes all handlers in parallel', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		const executionOrder: number[] = [];

		const handler1: DomainEventHandler = {
			handle: async () => {
				await new Promise((resolve) => setTimeout(resolve, 50));
				executionOrder.push(1);
			},
		};

		const handler2: DomainEventHandler = {
			handle: async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				executionOrder.push(2);
			},
		};

		const handler3: DomainEventHandler = {
			handle: async () => {
				executionOrder.push(3);
			},
		};

		dispatcher.register('TestEvent', handler1);
		dispatcher.register('TestEvent', handler2);
		dispatcher.register('TestEvent', handler3);

		const event = createDomainEvent('TestEvent', 'test_456', {});

		await dispatcher.publish(event);

		// If executed in parallel, faster handlers should complete first
		expect(executionOrder).toHaveLength(3);
		expect(executionOrder[0]).toBe(3); // Synchronous completes first
		expect(executionOrder[1]).toBe(2); // 10ms delay completes second
		expect(executionOrder[2]).toBe(1); // 50ms delay completes last
	});

	test('can register multiple handlers for same event', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		let count = 0;

		const createCountHandler = (): DomainEventHandler => ({
			handle: async () => {
				count++;
			},
		});

		dispatcher.register('CountEvent', createCountHandler());
		dispatcher.register('CountEvent', createCountHandler());
		dispatcher.register('CountEvent', createCountHandler());

		const event = createDomainEvent('CountEvent', 'count_789', {});

		await dispatcher.publish(event);

		expect(count).toBe(3);
	});

	test('handles events with complex payloads', async () => {
		const dispatcher = new InMemoryDomainEventDispatcher();
		let receivedPayload: unknown = null;

		const handler: DomainEventHandler = {
			handle: async (event) => {
				receivedPayload = event;
			},
		};

		dispatcher.register('ComplexEvent', handler);

		const event = createDomainEvent('ComplexEvent', 'complex_123', {
			nested: {
				data: {
					array: [1, 2, 3],
					object: { key: 'value' },
				},
			},
			timestamp: new Date('2025-01-01T00:00:00Z'),
		});

		await dispatcher.publish(event);

		expect(receivedPayload).toBeDefined();
		expect((receivedPayload as any).nested.data.array).toEqual([1, 2, 3]);
		expect((receivedPayload as any).nested.data.object.key).toBe('value');
	});
});

describe('InMemoryIntegrationEventBus', () => {
	test('publishes integration event', async () => {
		const bus = new InMemoryIntegrationEventBus();

		const event: IntegrationEvent = {
			name: 'UserCreated',
			occurredAt: new Date(),
			source: 'user-service',
		};

		await bus.publish(event);

		expect(bus.published).toHaveLength(1);
		expect(bus.published[0]!.name).toBe('UserCreated');
		expect(bus.published[0]!.source).toBe('user-service');
	});

	test('publishes multiple integration events', async () => {
		const bus = new InMemoryIntegrationEventBus();

		const event1: IntegrationEvent = {
			name: 'OrderPlaced',
			occurredAt: new Date(),
			source: 'order-service',
		};

		const event2: IntegrationEvent = {
			name: 'PaymentProcessed',
			occurredAt: new Date(),
			source: 'payment-service',
		};

		await bus.publish(event1);
		await bus.publish(event2);

		expect(bus.published).toHaveLength(2);
		expect(bus.published[0]!.name).toBe('OrderPlaced');
		expect(bus.published[1]!.name).toBe('PaymentProcessed');
	});

	test('publishes all events at once', async () => {
		const bus = new InMemoryIntegrationEventBus();

		const events: IntegrationEvent[] = [
			{
				name: 'Event1',
				occurredAt: new Date(),
				source: 'service1',
			},
			{
				name: 'Event2',
				occurredAt: new Date(),
				source: 'service2',
			},
			{
				name: 'Event3',
				occurredAt: new Date(),
				source: 'service3',
			},
		];

		await bus.publishAll(events);

		expect(bus.published).toHaveLength(3);
		expect(bus.published[0]!.name).toBe('Event1');
		expect(bus.published[1]!.name).toBe('Event2');
		expect(bus.published[2]!.name).toBe('Event3');
	});

	test('maintains order of published events', async () => {
		const bus = new InMemoryIntegrationEventBus();

		for (let i = 1; i <= 5; i++) {
			await bus.publish({
				name: `Event${i}`,
				occurredAt: new Date(),
				source: `service${i}`,
			});
		}

		expect(bus.published).toHaveLength(5);
		for (let i = 0; i < 5; i++) {
			expect(bus.published[i]!.name).toBe(`Event${i + 1}`);
		}
	});

	test('stores events with all metadata', async () => {
		const bus = new InMemoryIntegrationEventBus();

		const timestamp = new Date('2025-06-15T10:30:00Z');
		const event: IntegrationEvent = {
			name: 'ComplexEvent',
			occurredAt: timestamp,
			source: 'test-service',
			correlationId: 'corr-123',
			causationId: 'cause-456',
		};

		await bus.publish(event);

		expect(bus.published).toHaveLength(1);
		expect(bus.published[0]!.name).toBe('ComplexEvent');
		expect(bus.published[0]!.occurredAt).toEqual(timestamp);
		expect(bus.published[0]!.source).toBe('test-service');
		expect(bus.published[0]!.correlationId).toBe('corr-123');
		expect(bus.published[0]!.causationId).toBe('cause-456');
	});

	test('can be used to verify published events in tests', async () => {
		const bus = new InMemoryIntegrationEventBus();

		// Simulate some business logic that publishes events
		await bus.publish({
			name: 'UserRegistered',
			occurredAt: new Date(),
			source: 'auth-service',
		});

		await bus.publish({
			name: 'WelcomeEmailQueued',
			occurredAt: new Date(),
			source: 'notification-service',
		});

		// Verify the events were published
		expect(bus.published).toHaveLength(2);
		expect(bus.published.map((e) => e.name)).toEqual(['UserRegistered', 'WelcomeEmailQueued']);
	});

	test('allows direct access to published array', () => {
		const bus = new InMemoryIntegrationEventBus();

		expect(bus.published).toBeInstanceOf(Array);
		expect(bus.published).toHaveLength(0);
	});

	test('handles events without optional fields', async () => {
		const bus = new InMemoryIntegrationEventBus();

		const minimalEvent: IntegrationEvent = {
			name: 'MinimalEvent',
			occurredAt: new Date(),
		};

		await bus.publish(minimalEvent);

		expect(bus.published).toHaveLength(1);
		expect(bus.published[0]!.name).toBe('MinimalEvent');
		expect(bus.published[0]!.source).toBeUndefined();
		expect(bus.published[0]!.correlationId).toBeUndefined();
		expect(bus.published[0]!.causationId).toBeUndefined();
	});
});

describe('DomainEventHandler interface', () => {
	test('supports async handlers', () => {
		const handler: DomainEventHandler = {
			handle: async (event) => {
				// Async implementation
				await Promise.resolve();
			},
		};

		expect(handler).toBeDefined();
		expect(typeof handler.handle).toBe('function');
	});

	test('supports sync handlers', () => {
		const handler: DomainEventHandler = {
			handle: (event) => {
				// Sync implementation
			},
		};

		expect(handler).toBeDefined();
		expect(typeof handler.handle).toBe('function');
	});
});

describe('IntegrationEventHandler interface', () => {
	test('supports async handlers', () => {
		const handler: IntegrationEventHandler = {
			handle: async (event) => {
				// Async implementation
				await Promise.resolve();
			},
		};

		expect(handler).toBeDefined();
		expect(typeof handler.handle).toBe('function');
	});

	test('supports sync handlers', () => {
		const handler: IntegrationEventHandler = {
			handle: (event) => {
				// Sync implementation
			},
		};

		expect(handler).toBeDefined();
		expect(typeof handler.handle).toBe('function');
	});
});
