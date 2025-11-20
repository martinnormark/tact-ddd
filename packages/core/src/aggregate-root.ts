import { Entity } from './entity';

export interface DomainEventLike {
	readonly name: string;
	readonly occurredAt: Date;
}

export abstract class AggregateRoot<TId, TEvent extends DomainEventLike = DomainEventLike> extends Entity<TId> {
	private _domainEvents: TEvent[] = [];

	protected addDomainEvent(event: TEvent): void {
		this._domainEvents.push(event);
	}

	public get domainEvents(): readonly TEvent[] {
		return this._domainEvents;
	}

	/**
	 * Pull events (for dispatch) and clear the internal buffer.
	 */
	public pullDomainEvents(): TEvent[] {
		const events = this._domainEvents;
		this._domainEvents = [];
		return events;
	}

	/**
	 * Clear without returning the events.
	 */
	public clearDomainEvents(): void {
		this._domainEvents = [];
	}
}
