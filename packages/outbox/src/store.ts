import type { IntegrationEvent } from '@ddd-ts/events';
import type { OutboxMessage } from './outbox-message';
import type { OutboxSerializer } from './serializer';

/**
 * High-level contract for persisting integration events to the outbox.
 *
 * Implementations are expected to use the provided serializer internally
 * and participate in the same transaction as domain changes.
 */
export interface OutboxStore {
	/**
	 * Serializer used to turn events into payloads.
	 */
	readonly serializer: OutboxSerializer;

	/**
	 * Called within the same unit of work/transaction as your aggregate changes.
	 * Implementation should:
	 *  - serialize the event
	 *  - insert an outbox row with status "pending"
	 */
	add(event: IntegrationEvent): Promise<void>;

	/**
	 * Fetch a batch of messages ready to be processed.
	 * Implementation can:
	 *  - filter by status = "pending"
	 *  - optionally do optimistic locking / status = "processing"
	 */
	getPending(batchSize: number): Promise<OutboxMessage[]>;

	/**
	 * Mark a message as successfully processed.
	 */
	markProcessed(id: string): Promise<void>;

	/**
	 * Mark a message as failed, store error, increment retryCount, etc.
	 */
	markFailed(id: string, error: string): Promise<void>;
}
