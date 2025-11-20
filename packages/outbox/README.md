# @tact-ddd/outbox

> **Transactional outbox pattern for reliable event publishing in Domain-Driven Design applications**

A lightweight, ORM-agnostic implementation of the [Transactional Outbox pattern](https://microservices.io/patterns/data/transactional-outbox.html) that integrates seamlessly with `@tact-ddd/events` to ensure reliable delivery of integration events.

## 📦 What's in the box?

This package provides the core abstractions and processing logic for the outbox pattern:

- **Domain types** - `OutboxMessage` representation with status tracking
- **Serialization contract** - Pluggable serialization for events
- **Store interface** - ORM-agnostic persistence abstraction
- **Processor** - Worker loop for publishing pending messages

## 🎯 Design Philosophy

`@tact-ddd/outbox` is intentionally minimal and stays focused on:

✅ **What it does:**

- Defines the shape of outbox messages in your domain
- Provides abstractions for enqueuing events transactionally
- Implements a processor for dequeuing and dispatching events

❌ **What it doesn't do:**

- Know about ORMs (Prisma/Drizzle/TypeORM implementations live in _your_ code)
- Know about message brokers (Kafka/RabbitMQ/SQS/etc.)
- Enforce specific retry or backoff strategies
- Include scheduling or cron logic

## 📥 Installation

```bash
npm install @tact-ddd/outbox @tact-ddd/events
# or
pnpm add @tact-ddd/outbox @tact-ddd/events
# or
yarn add @tact-ddd/outbox @tact-ddd/events
# or
bun add @tact-ddd/outbox @tact-ddd/events
```

## 🏗️ Architecture Overview

The outbox pattern ensures **atomic persistence** of domain changes and integration events:

1. **Write phase** (in transaction):

   - Save aggregate changes to DB
   - Save integration events to outbox table
   - Commit transaction atomically

2. **Publish phase** (async worker):
   - Fetch pending outbox messages
   - Deserialize to `IntegrationEvent` instances
   - Publish via `IntegrationEventBus`
   - Mark as processed or failed

```
┌─────────────────┐
│  Application    │
│    Service      │
└────────┬────────┘
         │
         ▼
    ┌────────────────────┐
    │  DB Transaction    │
    │                    │
    │  1. Save Aggregate │
    │  2. Add to Outbox  │◄──── OutboxStore.add()
    │                    │
    │  3. Commit         │
    └────────────────────┘
              │
              │ (async)
              ▼
    ┌─────────────────────┐
    │  OutboxProcessor    │
    │                     │
    │  1. Get Pending     │◄──── OutboxStore.getPending()
    │  2. Deserialize     │◄──── OutboxSerializer.deserialize()
    │  3. Publish         │◄──── IntegrationEventBus.publish()
    │  4. Mark Processed  │◄──── OutboxStore.markProcessed()
    └─────────────────────┘
```

## 🔑 Core Concepts

### OutboxMessage

Domain representation of an outbox record with these key fields:

```typescript
interface OutboxMessage {
	id: string; // Primary key
	eventName: string; // e.g., "WorkspaceCreated"
	eventType: string; // Fully-qualified type for deserialization
	payload: unknown; // Serialized event data
	occurredAt: Date; // When the domain event occurred
	createdAt: Date; // When inserted into outbox
	status: OutboxMessageStatus; // "pending" | "processing" | "failed" | "processed"
	retryCount: number; // Retry attempts
	lastError?: string; // Last failure reason
	correlationId?: string; // For distributed tracing
	causationId?: string; // For event causality tracking
}
```

### OutboxSerializer

Contract for converting between `IntegrationEvent` and storable payloads:

```typescript
interface OutboxSerializer {
	// IntegrationEvent → storage format
	serialize(event: IntegrationEvent): OutboxSerializedEvent;

	// OutboxMessage → IntegrationEvent
	deserialize(message: OutboxMessage): IntegrationEvent;
}
```

### OutboxStore

ORM-agnostic persistence interface:

```typescript
interface OutboxStore {
	serializer: OutboxSerializer;

	// Add event within transaction
	add(event: IntegrationEvent): Promise<void>;

	// Fetch pending messages for processing
	getPending(batchSize: number): Promise<OutboxMessage[]>;

	// Mark message as successfully published
	markProcessed(id: string): Promise<void>;

	// Mark message as failed with error details
	markFailed(id: string, error: string): Promise<void>;
}
```

### OutboxProcessor

Worker that processes pending messages:

```typescript
class OutboxProcessor {
	constructor(store: OutboxStore, bus: IntegrationEventBus, options?: OutboxProcessorOptions);

	// Process one batch of messages
	runOnce(): Promise<void>;
}
```

## 🚀 Usage Guide

### Step 1: Database Schema

Create an outbox table in your database. Example for PostgreSQL/Prisma:

```prisma
model OutboxMessage {
  id            String   @id @default(uuid())
  eventName     String
  eventType     String
  payload       String   // JSON string
  occurredAt    DateTime
  createdAt     DateTime @default(now())
  status        String   @default("pending")
  retryCount    Int      @default(0)
  lastError     String?
  correlationId String?
  causationId   String?

  @@index([status, createdAt])
  @@map("outbox_messages")
}
```

### Step 2: Implement OutboxSerializer

Create a serializer that knows your event types:

```typescript
// app/infrastructure/outbox/json-serializer.ts
import type { IntegrationEvent } from '@tact-ddd/events';
import type { OutboxSerializer, OutboxSerializedEvent, OutboxMessage } from '@tact-ddd/outbox';
import { WorkspaceCreatedIntegrationEvent } from '../events/workspace-created';
import { UserRegisteredIntegrationEvent } from '../events/user-registered';

// Registry mapping eventType → constructor
const EVENT_REGISTRY: Record<string, new (...args: any[]) => IntegrationEvent> = {
	'workspace.WorkspaceCreatedIntegrationEvent': WorkspaceCreatedIntegrationEvent,
	'user.UserRegisteredIntegrationEvent': UserRegisteredIntegrationEvent,
};

export class JsonOutboxSerializer implements OutboxSerializer {
	serialize(event: IntegrationEvent): OutboxSerializedEvent {
		// Use a static property or convention for type name
		const eventType = event.constructor.name;

		return {
			eventName: event.name,
			eventType,
			payload: JSON.stringify(event),
			occurredAt: event.occurredAt,
			correlationId: event.correlationId,
			causationId: event.causationId,
		};
	}

	deserialize(message: OutboxMessage): IntegrationEvent {
		const EventConstructor = EVENT_REGISTRY[message.eventType];

		if (!EventConstructor) {
			throw new Error(`No IntegrationEvent registered for type '${message.eventType}'`);
		}

		const payload = typeof message.payload === 'string' ? JSON.parse(message.payload) : message.payload;

		// Reconstruct event instance
		return Object.assign(new EventConstructor(), payload);
	}
}
```

### Step 3: Implement OutboxStore

Create an ORM-specific implementation. Example with Prisma:

```typescript
// app/infrastructure/outbox/prisma-outbox-store.ts
import type { PrismaClient } from '@prisma/client';
import type { IntegrationEvent } from '@tact-ddd/events';
import type { OutboxStore, OutboxSerializer, OutboxMessage } from '@tact-ddd/outbox';

export class PrismaOutboxStore implements OutboxStore {
	constructor(private readonly prisma: PrismaClient, public readonly serializer: OutboxSerializer) {}

	async add(event: IntegrationEvent): Promise<void> {
		const serialized = this.serializer.serialize(event);

		await this.prisma.outboxMessage.create({
			data: {
				eventName: serialized.eventName,
				eventType: serialized.eventType,
				payload: JSON.stringify(serialized.payload),
				occurredAt: serialized.occurredAt,
				status: 'pending',
				retryCount: 0,
				correlationId: serialized.correlationId,
				causationId: serialized.causationId,
			},
		});
	}

	async getPending(batchSize: number): Promise<OutboxMessage[]> {
		const rows = await this.prisma.outboxMessage.findMany({
			where: { status: 'pending' },
			orderBy: { createdAt: 'asc' },
			take: batchSize,
		});

		return rows.map((row) => ({
			id: row.id,
			eventName: row.eventName,
			eventType: row.eventType,
			payload: row.payload,
			occurredAt: row.occurredAt,
			createdAt: row.createdAt,
			status: row.status as OutboxMessage['status'],
			retryCount: row.retryCount,
			lastError: row.lastError ?? undefined,
			correlationId: row.correlationId ?? undefined,
			causationId: row.causationId ?? undefined,
		}));
	}

	async markProcessed(id: string): Promise<void> {
		await this.prisma.outboxMessage.update({
			where: { id },
			data: { status: 'processed' },
		});
	}

	async markFailed(id: string, error: string): Promise<void> {
		await this.prisma.outboxMessage.update({
			where: { id },
			data: {
				status: 'failed',
				retryCount: { increment: 1 },
				lastError: error,
			},
		});
	}
}
```

### Step 4: Use in Application Service

Add events to outbox within the same transaction as your aggregate changes:

```typescript
// app/application/workspace/create-workspace.service.ts
import { PrismaClient } from '@prisma/client';
import { PrismaOutboxStore } from '../../infrastructure/outbox/prisma-outbox-store';
import { JsonOutboxSerializer } from '../../infrastructure/outbox/json-serializer';

export class CreateWorkspaceService {
	constructor(private readonly prisma: PrismaClient, private readonly serializer: JsonOutboxSerializer) {}

	async execute(command: CreateWorkspaceCommand): Promise<void> {
		// Use transaction to ensure atomicity
		await this.prisma.$transaction(async (tx) => {
			// 1. Create aggregate
			const workspace = await tx.workspace.create({
				data: {
					id: command.workspaceId,
					name: command.name,
					ownerId: command.ownerId,
				},
			});

			// 2. Create transaction-scoped outbox store
			const outboxStore = new PrismaOutboxStore(tx, this.serializer);

			// 3. Add integration event to outbox
			const event = new WorkspaceCreatedIntegrationEvent({
				workspaceId: workspace.id,
				name: workspace.name,
				ownerId: workspace.ownerId,
			});

			await outboxStore.add(event);

			// 4. Commit happens automatically when transaction callback completes
		});
	}
}
```

### Step 5: Create Worker Process

Set up a background worker to process the outbox:

```typescript
// app/infrastructure/workers/outbox-worker.ts
import { PrismaClient } from '@prisma/client';
import { OutboxProcessor } from '@tact-ddd/outbox';
import { PrismaOutboxStore } from '../outbox/prisma-outbox-store';
import { JsonOutboxSerializer } from '../outbox/json-serializer';
import { KafkaIntegrationEventBus } from '../event-bus/kafka-event-bus';

export class OutboxWorker {
	private readonly processor: OutboxProcessor;

	constructor() {
		const prisma = new PrismaClient();
		const serializer = new JsonOutboxSerializer();
		const store = new PrismaOutboxStore(prisma, serializer);
		const bus = new KafkaIntegrationEventBus();

		this.processor = new OutboxProcessor(store, bus, {
			batchSize: 100,
			maxRetries: 10,
		});
	}

	async start(): Promise<void> {
		console.log('Starting outbox worker...');

		// Process every 5 seconds
		setInterval(async () => {
			try {
				await this.processor.runOnce();
			} catch (error) {
				console.error('Outbox processing error:', error);
			}
		}, 5000);
	}
}

// Bootstrap
const worker = new OutboxWorker();
worker.start();
```

Or use with a proper job scheduler:

```typescript
// app/infrastructure/workers/outbox-cron.ts
import cron from 'node-cron';

// Run every minute
cron.schedule('* * * * *', async () => {
	await processor.runOnce();
});
```

## 🔧 Advanced Patterns

### Transaction-Scoped Store Factory

For cleaner dependency injection:

```typescript
// app/infrastructure/outbox/outbox-store-factory.ts
export class OutboxStoreFactory {
	constructor(private readonly serializer: OutboxSerializer) {}

	createForTransaction(tx: PrismaTransaction): OutboxStore {
		return new PrismaOutboxStore(tx, this.serializer);
	}
}

// In your service
class CreateWorkspaceService {
	constructor(private readonly prisma: PrismaClient, private readonly outboxFactory: OutboxStoreFactory) {}

	async execute(command: CreateWorkspaceCommand): Promise<void> {
		await this.prisma.$transaction(async (tx) => {
			const outbox = this.outboxFactory.createForTransaction(tx);

			// ... your logic
			await outbox.add(event);
		});
	}
}
```

### Custom Retry Logic

Extend the store to implement your own retry strategy:

```typescript
class RetryAwareOutboxStore extends PrismaOutboxStore {
	async getPending(batchSize: number): Promise<OutboxMessage[]> {
		const rows = await this.prisma.outboxMessage.findMany({
			where: {
				status: 'pending',
				retryCount: { lt: 10 }, // Skip after 10 retries
			},
			orderBy: { createdAt: 'asc' },
			take: batchSize,
		});

		// Map to OutboxMessage...
	}

	async markFailed(id: string, error: string): Promise<void> {
		const message = await this.prisma.outboxMessage.findUnique({
			where: { id },
		});

		if (!message) return;

		const newRetryCount = message.retryCount + 1;
		const shouldGiveUp = newRetryCount >= 10;

		await this.prisma.outboxMessage.update({
			where: { id },
			data: {
				status: shouldGiveUp ? 'failed' : 'pending',
				retryCount: newRetryCount,
				lastError: error,
			},
		});
	}
}
```

### Dead Letter Queue

Move permanently failed messages to a separate table:

```typescript
class DLQOutboxStore extends PrismaOutboxStore {
	async markFailed(id: string, error: string): Promise<void> {
		const message = await this.prisma.outboxMessage.findUnique({
			where: { id },
		});

		if (!message) return;

		const newRetryCount = message.retryCount + 1;

		if (newRetryCount >= 10) {
			// Move to dead letter queue
			await this.prisma.$transaction([
				this.prisma.deadLetterQueue.create({
					data: {
						originalId: message.id,
						eventName: message.eventName,
						eventType: message.eventType,
						payload: message.payload,
						failureReason: error,
						failedAt: new Date(),
					},
				}),
				this.prisma.outboxMessage.delete({
					where: { id },
				}),
			]);
		} else {
			// Regular failure handling
			await super.markFailed(id, error);
		}
	}
}
```

## 🧪 Testing

### Unit Test Your Serializer

```typescript
import { describe, it, expect } from 'vitest';
import { JsonOutboxSerializer } from './json-serializer';
import { WorkspaceCreatedIntegrationEvent } from './events';

describe('JsonOutboxSerializer', () => {
	const serializer = new JsonOutboxSerializer();

	it('should serialize integration event', () => {
		const event = new WorkspaceCreatedIntegrationEvent({
			workspaceId: '123',
			name: 'Test Workspace',
			ownerId: 'user-1',
		});

		const result = serializer.serialize(event);

		expect(result.eventName).toBe('WorkspaceCreated');
		expect(result.eventType).toBe('workspace.WorkspaceCreatedIntegrationEvent');
		expect(typeof result.payload).toBe('string');
	});

	it('should deserialize outbox message', () => {
		const message: OutboxMessage = {
			id: '1',
			eventName: 'WorkspaceCreated',
			eventType: 'workspace.WorkspaceCreatedIntegrationEvent',
			payload: JSON.stringify({
				workspaceId: '123',
				name: 'Test',
				ownerId: 'user-1',
			}),
			occurredAt: new Date(),
			createdAt: new Date(),
			status: 'pending',
			retryCount: 0,
		};

		const event = serializer.deserialize(message);

		expect(event).toBeInstanceOf(WorkspaceCreatedIntegrationEvent);
		expect(event.name).toBe('WorkspaceCreated');
	});
});
```

### Integration Test with In-Memory Store

```typescript
class InMemoryOutboxStore implements OutboxStore {
	private messages: OutboxMessage[] = [];

	constructor(public readonly serializer: OutboxSerializer) {}

	async add(event: IntegrationEvent): Promise<void> {
		const serialized = this.serializer.serialize(event);
		this.messages.push({
			id: Math.random().toString(),
			...serialized,
			createdAt: new Date(),
			status: 'pending',
			retryCount: 0,
		});
	}

	async getPending(batchSize: number): Promise<OutboxMessage[]> {
		return this.messages.filter((m) => m.status === 'pending').slice(0, batchSize);
	}

	async markProcessed(id: string): Promise<void> {
		const msg = this.messages.find((m) => m.id === id);
		if (msg) (msg as any).status = 'processed';
	}

	async markFailed(id: string, error: string): Promise<void> {
		const msg = this.messages.find((m) => m.id === id);
		if (msg) {
			(msg as any).status = 'failed';
			(msg as any).lastError = error;
			(msg as any).retryCount++;
		}
	}
}
```

## 📚 API Reference

### Types

#### `OutboxMessageStatus`

```typescript
type OutboxMessageStatus = 'pending' | 'processing' | 'failed' | 'processed';
```

#### `OutboxMessage`

Core domain representation of an outbox record.

#### `OutboxSerializedEvent`

Intermediate format between `IntegrationEvent` and storage.

#### `OutboxProcessorOptions`

```typescript
interface OutboxProcessorOptions {
	batchSize?: number; // Default: 100
	maxRetries?: number; // Default: 10
}
```

### Interfaces

#### `OutboxSerializer`

Contract for event serialization/deserialization.

#### `OutboxStore`

ORM-agnostic persistence abstraction.

### Classes

#### `OutboxProcessor`

Worker for processing pending outbox messages.

**Methods:**

- `runOnce(): Promise<void>` - Process one batch of pending messages

## 🤝 Integration with @tact-ddd/events

This package is designed to work seamlessly with `@tact-ddd/events`:

```typescript
import { IntegrationEvent, IntegrationEventBus } from '@tact-ddd/events';
import { OutboxStore, OutboxProcessor } from '@tact-ddd/outbox';

// Your integration event
class WorkspaceCreatedIntegrationEvent extends IntegrationEvent {
	constructor(public readonly data: { workspaceId: string; name: string }) {
		super('WorkspaceCreated');
	}
}

// In application service
await outboxStore.add(event); // Store with domain changes

// In worker
const processor = new OutboxProcessor(store, bus);
await processor.runOnce(); // Publishes via IntegrationEventBus
```

## 🎭 Alternative ORM Examples

### Drizzle

```typescript
import { drizzle } from 'drizzle-orm/node-postgres';
import type { OutboxStore } from '@tact-ddd/outbox';

export class DrizzleOutboxStore implements OutboxStore {
	constructor(private readonly db: ReturnType<typeof drizzle>, public readonly serializer: OutboxSerializer) {}

	async add(event: IntegrationEvent): Promise<void> {
		const serialized = this.serializer.serialize(event);

		await this.db.insert(outboxMessages).values({
			eventName: serialized.eventName,
			eventType: serialized.eventType,
			payload: serialized.payload,
			occurredAt: serialized.occurredAt,
			status: 'pending',
		});
	}

	// ... implement other methods
}
```

### TypeORM

```typescript
import { Repository } from 'typeorm';
import { OutboxMessageEntity } from './entities/outbox-message.entity';

export class TypeORMOutboxStore implements OutboxStore {
	constructor(private readonly repository: Repository<OutboxMessageEntity>, public readonly serializer: OutboxSerializer) {}

	async add(event: IntegrationEvent): Promise<void> {
		const serialized = this.serializer.serialize(event);

		const entity = this.repository.create({
			eventName: serialized.eventName,
			eventType: serialized.eventType,
			payload: serialized.payload,
			occurredAt: serialized.occurredAt,
			status: 'pending',
		});

		await this.repository.save(entity);
	}

	// ... implement other methods
}
```

## 🏆 Best Practices

1. **Always use transactions** - Ensure `outboxStore.add()` is called within the same transaction as your aggregate changes
2. **Implement idempotent consumers** - Your event handlers should handle duplicate messages gracefully
3. **Monitor failed messages** - Set up alerts for messages stuck in `failed` status
4. **Clean up old messages** - Periodically archive or delete processed messages to prevent table bloat
5. **Use correlation IDs** - Track event chains through your distributed system
6. **Test serialization** - Ensure events can round-trip through serialize/deserialize
7. **Handle poison messages** - Implement dead letter queues for permanently failed messages

## 📖 Further Reading

- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Domain-Driven Design](https://www.domainlanguage.com/ddd/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)

## 📄 License

MIT

## 🤝 Contributing

Contributions welcome! This package aims to stay minimal and focused on the core outbox pattern abstractions.
