import type { IntegrationEvent } from '@tact-ddd/events';
import type { OutboxMessage } from './outbox-message';

export interface OutboxSerializedEvent {
	eventName: string;
	eventType: string;
	payload: unknown;
	occurredAt: Date;
	correlationId?: string;
	causationId?: string;
}

/**
 * Responsible for turning IntegrationEvents into storable payloads and back.
 *
 * Implementation lives in app code, because only the app knows how to map
 * eventType -> constructor, etc.
 */
export interface OutboxSerializer {
	serialize(event: IntegrationEvent): OutboxSerializedEvent;

	/**
	 * Rehydrate an IntegrationEvent from an OutboxMessage.
	 * Usually involves a registry mapping eventType -> constructor.
	 */
	deserialize(message: OutboxMessage): IntegrationEvent;
}
