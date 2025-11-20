export interface BaseEvent {
	/**
	 * Logical name for the event, used for logging, analytics, routing, etc.
	 * e.g. "WorkspaceCreated"
	 */
	readonly name: string;

	/**
	 * When the event occurred in the domain.
	 */
	readonly occurredAt: Date;

	/**
	 * Optional correlation ID to trace a request across boundaries.
	 */
	readonly correlationId?: string;

	/**
	 * Optional causation ID (what event/command caused this event).
	 */
	readonly causationId?: string;
}
