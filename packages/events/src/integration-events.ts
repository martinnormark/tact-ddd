import type { BaseEvent } from './event-types';

export interface IntegrationEvent extends BaseEvent {
	/**
	 * Name of the bounded context or service emitting this event.
	 * Optional but nice for observability.
	 */
	readonly source?: string;
}

export abstract class IntegrationEventBase implements IntegrationEvent {
	readonly occurredAt: Date;

	protected constructor(public readonly name: string, public readonly source?: string, public readonly correlationId?: string, public readonly causationId?: string) {
		this.occurredAt = new Date();
	}
}
