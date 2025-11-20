import type { BaseEvent } from './event-types';

export interface DomainEvent<TId = string> extends BaseEvent {
	/**
	 * Aggregate root identifier, usually a branded ID type.
	 */
	readonly aggregateId: TId;
}

/**
 * Small base class you can subclass if you like OO.
 */
export abstract class DomainEventBase<TId = string> implements DomainEvent<TId> {
	readonly occurredAt: Date;

	protected constructor(public readonly name: string, public readonly aggregateId: TId, public readonly correlationId?: string, public readonly causationId?: string) {
		this.occurredAt = new Date();
	}
}

export function createDomainEvent<TName extends string, TId, TPayload extends object>(
	name: TName,
	aggregateId: TId,
	payload: TPayload & object,
	meta?: {
		occurredAt?: Date;
		correlationId?: string;
		causationId?: string;
	}
): DomainEvent<TId> & TPayload {
	const { occurredAt = new Date(), correlationId, causationId } = meta ?? {};
	return {
		name,
		aggregateId,
		occurredAt,
		correlationId,
		causationId,
		...payload,
	};
}
