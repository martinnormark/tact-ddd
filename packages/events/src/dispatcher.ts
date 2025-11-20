import type { DomainEvent } from './domain-events';
import type { IntegrationEvent } from './integration-events';

/**
 * Domain events (inside one service / bounded context)
 */
export interface DomainEventHandler<TEvent extends DomainEvent = DomainEvent> {
	handle(event: TEvent): Promise<void> | void;
}

/**
 * Abstraction for something that can publish domain events
 * to registered handlers.
 */
export interface DomainEventDispatcher {
	publish(event: DomainEvent): Promise<void>;
	publishAll(events: DomainEvent[]): Promise<void>;
}

/**
 * Integration event handler (usually in other services)
 */
export interface IntegrationEventHandler<TEvent extends IntegrationEvent = IntegrationEvent> {
	handle(event: TEvent): Promise<void> | void;
}

/**
 * Integration event bus abstraction.
 * Outbox + transport-specific implementations will use this.
 */
export interface IntegrationEventBus {
	publish(event: IntegrationEvent): Promise<void>;
	publishAll(events: IntegrationEvent[]): Promise<void>;
}

/**
 * Simple in-memory domain event dispatcher.
 * Good for tests and small apps.
 */
export class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
	private readonly handlers: Map<string, DomainEventHandler[]> = new Map();

	register<TEvent extends DomainEvent>(eventName: string, handler: DomainEventHandler<TEvent>): void {
		const existing = this.handlers.get(eventName) ?? [];
		this.handlers.set(eventName, [...existing, handler]);
	}

	async publish(event: DomainEvent): Promise<void> {
		const handlers = this.handlers.get(event.name) ?? [];
		await Promise.all(handlers.map((h) => h.handle(event)));
	}

	async publishAll(events: DomainEvent[]): Promise<void> {
		for (const e of events) {
			await this.publish(e);
		}
	}
}

export class InMemoryIntegrationEventBus implements IntegrationEventBus {
	public readonly published: IntegrationEvent[] = [];

	async publish(event: IntegrationEvent): Promise<void> {
		this.published.push(event);
	}

	async publishAll(events: IntegrationEvent[]): Promise<void> {
		this.published.push(...events);
	}
}
