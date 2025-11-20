export type OutboxMessageStatus = 'pending' | 'processing' | 'failed' | 'processed';

/**
 * Domain representation of an outbox record.
 *
 * Your ORM mapping will read/write a table with roughly these columns.
 */
export interface OutboxMessage {
	/**
	 * Database primary key (UUID / bigint / whatever).
	 * Keep it as string here to stay generic.
	 */
	readonly id: string;

	/**
	 * Logical integration event name, e.g. "WorkspaceCreated".
	 */
	readonly eventName: string;

	/**
	 * Fully-qualified type identifier, e.g. "workspace.WorkspaceCreatedIntegrationEvent".
	 * Used to rehydrate the event.
	 */
	readonly eventType: string;

	/**
	 * Serialized payload.
	 * Usually JSON string, but we keep it as `unknown` so you can use JSONB, etc.
	 */
	readonly payload: unknown;

	/**
	 * When the original domain event occurred (from IntegrationEvent).
	 */
	readonly occurredAt: Date;

	/**
	 * When this record was inserted into the outbox.
	 */
	readonly createdAt: Date;

	/**
	 * Status for processing.
	 */
	readonly status: OutboxMessageStatus;

	/**
	 * How many times we’ve tried to send this.
	 */
	readonly retryCount: number;

	/**
	 * Last error message if status === "failed".
	 */
	readonly lastError?: string;

	/**
	 * Optional correlation/causation IDs for tracing.
	 */
	readonly correlationId?: string;
	readonly causationId?: string;
}
