import { describe, expect, test } from 'bun:test';
import type { BaseEvent } from './event-types';

describe('BaseEvent', () => {
	test('validates BaseEvent structure with required fields', () => {
		const event: BaseEvent = {
			name: 'TestEvent',
			occurredAt: new Date(),
		};

		expect(event.name).toBe('TestEvent');
		expect(event.occurredAt).toBeInstanceOf(Date);
		expect(event.correlationId).toBeUndefined();
		expect(event.causationId).toBeUndefined();
	});

	test('validates BaseEvent structure with optional fields', () => {
		const event: BaseEvent = {
			name: 'TestEventWithMetadata',
			occurredAt: new Date('2025-01-01T00:00:00Z'),
			correlationId: 'corr-123',
			causationId: 'cause-456',
		};

		expect(event.name).toBe('TestEventWithMetadata');
		expect(event.occurredAt).toEqual(new Date('2025-01-01T00:00:00Z'));
		expect(event.correlationId).toBe('corr-123');
		expect(event.causationId).toBe('cause-456');
	});

	test('supports readonly properties', () => {
		const event: BaseEvent = {
			name: 'ImmutableEvent',
			occurredAt: new Date(),
		};

		// TypeScript enforces readonly at compile time
		// This test ensures the interface can be used as expected
		expect(event.name).toBe('ImmutableEvent');
	});

	test('allows any string for event name', () => {
		const events: BaseEvent[] = [
			{ name: 'UserCreated', occurredAt: new Date() },
			{ name: 'OrderPlaced', occurredAt: new Date() },
			{ name: 'Payment.Processed', occurredAt: new Date() },
			{ name: 'workspace:deleted', occurredAt: new Date() },
		];

		expect(events).toHaveLength(4);
		events.forEach((event) => {
			expect(typeof event.name).toBe('string');
			expect(event.occurredAt).toBeInstanceOf(Date);
		});
	});
});
