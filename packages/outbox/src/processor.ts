import type { OutboxStore } from './store';
import type { OutboxMessage } from './outbox-message';
import type { IntegrationEventBus } from '@ddd-ts/events';

export interface OutboxProcessorOptions {
	/**
	 * Max messages per run.
	 * Defaults to 100.
	 */
	readonly batchSize?: number;

	/**
	 * Max retries before we stop trying (implementation-dependent).
	 * The store may or may not enforce this; we keep it as a hint.
	 */
	readonly maxRetries?: number;
}

/**
 * Simple outbox processor.
 *
 * You drive it from a cron, background worker, etc. by calling `runOnce()`.
 */
export class OutboxProcessor {
	private readonly batchSize: number;
	private readonly maxRetries: number;

	constructor(private readonly store: OutboxStore, private readonly bus: IntegrationEventBus, options: OutboxProcessorOptions = {}) {
		this.batchSize = options.batchSize ?? 100;
		this.maxRetries = options.maxRetries ?? 10;
	}

	/**
	 * Process at most `batchSize` pending messages.
	 */
	async runOnce(): Promise<void> {
		const messages = await this.store.getPending(this.batchSize);

		if (messages.length === 0) return;

		await Promise.all(messages.map((msg) => this.processMessage(msg)));
	}

	private async processMessage(msg: OutboxMessage): Promise<void> {
		try {
			const event = this.store.serializer.deserialize(msg);
			await this.bus.publish(event);
			await this.store.markProcessed(msg.id);
		} catch (err) {
			// Very simple failure handling; store can decide how to use retryCount.
			await this.store.markFailed(msg.id, String(err instanceof Error ? err.message : err));
		}
	}
}
