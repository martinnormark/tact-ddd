# @tact-ddd/events

Simple, type-safe event abstractions for Domain-Driven Design in TypeScript. This package provides a clean separation between **domain events** (within a bounded context) and **integration events** (across services), with minimal in-memory implementations for testing and simple applications.

## Features

- **Type-safe event definitions** with full TypeScript support
- **Domain events** for in-process communication within a bounded context
- **Integration events** for cross-service communication
- **Structural compatibility** with `@tact-ddd/core` aggregate roots
- **In-memory dispatchers** for testing and simple applications
- **Correlation & causation tracking** for distributed tracing
- **Zero dependencies** on frameworks or ORMs
- **Functional and OOP styles** supported

## Installation

```bash
npm install @tact-ddd/events
# or
yarn add @tact-ddd/events
# or
pnpm add @tact-ddd/events
# or
bun add @tact-ddd/events
```

## Core Concepts

### Event Types

All events in this package extend from `BaseEvent`, which provides:

- `name`: Logical name for the event (e.g., "WorkspaceCreated")
- `occurredAt`: When the event occurred
- `correlationId`: Optional ID to trace requests across boundaries
- `causationId`: Optional ID indicating what caused this event

### Domain Events

Domain events represent something that happened within your bounded context. They are tied to an aggregate root and are used for in-process communication.

**Key characteristics:**

- Contain an `aggregateId` to identify which aggregate emitted the event
- Structurally compatible with `DomainEventLike` from `@tact-ddd/core`
- Should be handled within the same service/bounded context
- Can trigger side effects, update read models, or spawn other aggregates

### Integration Events

Integration events are meant to cross service boundaries. They communicate that something significant happened in your bounded context that other services care about.

**Key characteristics:**

- May or may not reference a specific aggregate
- Include optional `source` field for observability
- Should be published via an outbox pattern for reliability
- Represent the public contract of your bounded context

## Usage

### Defining Domain Events

#### Using the Base Class (OOP Style)

```typescript
import { DomainEventBase } from '@tact-ddd/events';
import type { WorkspaceId } from '@your-app/ids';

export class WorkspaceCreated extends DomainEventBase<WorkspaceId> {
	constructor(workspaceId: WorkspaceId, public readonly ownerId: string, public readonly plan: string) {
		super('WorkspaceCreated', workspaceId);
	}
}

// Usage
const event = new WorkspaceCreated(workspaceId, 'user-123', 'pro');
```

#### Using the Factory Function (Functional Style)

```typescript
import { createDomainEvent } from '@tact-ddd/events';
import type { WorkspaceId } from '@your-app/ids';

const event = createDomainEvent(
	'WorkspaceCreated',
	workspaceId,
	{
		ownerId: 'user-123',
		plan: 'pro',
	},
	{
		correlationId: requestId,
	}
);

// Type is: DomainEvent<WorkspaceId> & { ownerId: string, plan: string }
```

### Defining Integration Events

#### Using the Base Class

```typescript
import { IntegrationEventBase } from '@tact-ddd/events';
import type { WorkspaceId } from '@your-app/ids';

export class WorkspaceCreatedIntegrationEvent extends IntegrationEventBase {
	constructor(public readonly workspaceId: WorkspaceId, public readonly ownerId: string, public readonly plan: string) {
		super('WorkspaceCreated', 'workspace-service');
	}
}

// Usage
const integrationEvent = new WorkspaceCreatedIntegrationEvent(workspaceId, 'user-123', 'pro');
```

### Handling Domain Events

#### Create a Handler

```typescript
import { DomainEventHandler } from '@tact-ddd/events';
import { WorkspaceCreated } from './events';

class SendWelcomeEmailHandler implements DomainEventHandler<WorkspaceCreated> {
	async handle(event: WorkspaceCreated): Promise<void> {
		await emailService.sendWelcomeEmail(event.ownerId, event.aggregateId);
		console.log(`Welcome email sent for workspace ${event.aggregateId}`);
	}
}

class CreateDefaultProjectHandler implements DomainEventHandler<WorkspaceCreated> {
	async handle(event: WorkspaceCreated): Promise<void> {
		await projectService.createDefaultProject(event.aggregateId);
		console.log(`Default project created for workspace ${event.aggregateId}`);
	}
}
```

#### Register Handlers and Dispatch Events

```typescript
import { InMemoryDomainEventDispatcher } from '@tact-ddd/events';

// Create dispatcher
const dispatcher = new InMemoryDomainEventDispatcher();

// Register handlers
dispatcher.register('WorkspaceCreated', new SendWelcomeEmailHandler());
dispatcher.register('WorkspaceCreated', new CreateDefaultProjectHandler());

// Dispatch a single event
await dispatcher.publish(event);

// Dispatch multiple events
await dispatcher.publishAll([event1, event2, event3]);
```

### Working with Aggregates

Domain events integrate seamlessly with `@tact-ddd/core` aggregate roots:

```typescript
import { AggregateRoot } from '@tact-ddd/core';
import { WorkspaceCreated, WorkspaceRenamed } from './events';
import type { WorkspaceId } from '@your-app/ids';

class Workspace extends AggregateRoot<WorkspaceId, WorkspaceCreated | WorkspaceRenamed> {
	private constructor(id: WorkspaceId, private name: string, private ownerId: string, private plan: string) {
		super(id);
	}

	static create(id: WorkspaceId, name: string, ownerId: string, plan: string): Workspace {
		const workspace = new Workspace(id, name, ownerId, plan);

		// Add domain event
		workspace.addDomainEvent(new WorkspaceCreated(id, ownerId, plan));

		return workspace;
	}

	rename(newName: string): void {
		if (this.name === newName) return;

		this.name = newName;
		this.addDomainEvent(new WorkspaceRenamed(this.id, this.name, newName));
	}
}

// In your application service
const workspace = Workspace.create(workspaceId, 'My Workspace', 'user-123', 'pro');

// Get domain events from aggregate
const domainEvents = workspace.getDomainEvents();

// Dispatch them
await dispatcher.publishAll(domainEvents);

// Clear events after successful dispatch
workspace.clearDomainEvents();
```

### Integration Event Bus

For integration events, use the `IntegrationEventBus` abstraction:

```typescript
import { InMemoryIntegrationEventBus } from '@tact-ddd/events';

// In-memory bus (useful for tests)
const bus = new InMemoryIntegrationEventBus();

await bus.publish(integrationEvent);

// Check what was published (useful in tests)
console.log(bus.published); // Array of published events
```

For production, you'd implement `IntegrationEventBus` with your actual transport (Kafka, RabbitMQ, SQS) or use `@tact-ddd/outbox` for reliable publishing:

```typescript
import type { IntegrationEventBus, IntegrationEvent } from '@tact-ddd/events';

class KafkaIntegrationEventBus implements IntegrationEventBus {
	constructor(private kafka: KafkaClient) {}

	async publish(event: IntegrationEvent): Promise<void> {
		await this.kafka.send({
			topic: event.name,
			messages: [{ value: JSON.stringify(event) }],
		});
	}

	async publishAll(events: IntegrationEvent[]): Promise<void> {
		await Promise.all(events.map((e) => this.publish(e)));
	}
}
```

### Complete Application Flow

Here's how everything fits together in an application service:

```typescript
import { InMemoryDomainEventDispatcher } from '@tact-ddd/events';
import { Workspace } from './domain/workspace';
import { WorkspaceRepository } from './infrastructure/repository';
import { WorkspaceCreatedIntegrationEvent } from './integration-events';

class CreateWorkspaceService {
	constructor(private repository: WorkspaceRepository, private domainDispatcher: InMemoryDomainEventDispatcher, private integrationBus: IntegrationEventBus) {}

	async execute(command: CreateWorkspaceCommand): Promise<void> {
		// 1. Create aggregate (collects domain events internally)
		const workspace = Workspace.create(command.workspaceId, command.name, command.ownerId, command.plan);

		// 2. Persist aggregate
		await this.repository.save(workspace);

		// 3. Get domain events
		const domainEvents = workspace.getDomainEvents();

		// 4. Dispatch domain events (in-process side effects)
		await this.domainDispatcher.publishAll(domainEvents);

		// 5. Map to integration events (cross-service communication)
		const integrationEvents = domainEvents.filter((e) => e.name === 'WorkspaceCreated').map((e) => new WorkspaceCreatedIntegrationEvent(e.aggregateId, e.ownerId, e.plan));

		// 6. Publish integration events (via outbox pattern)
		await this.integrationBus.publishAll(integrationEvents);

		// 7. Clear domain events
		workspace.clearDomainEvents();
	}
}
```

## Testing

The in-memory implementations make testing straightforward:

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { InMemoryDomainEventDispatcher, InMemoryIntegrationEventBus } from '@tact-ddd/events';

describe('Workspace creation', () => {
	let domainDispatcher: InMemoryDomainEventDispatcher;
	let integrationBus: InMemoryIntegrationEventBus;

	beforeEach(() => {
		domainDispatcher = new InMemoryDomainEventDispatcher();
		integrationBus = new InMemoryIntegrationEventBus();
	});

	it('should dispatch domain events and publish integration events', async () => {
		// Register a test handler
		const handledEvents: any[] = [];
		domainDispatcher.register('WorkspaceCreated', {
			handle: async (event) => {
				handledEvents.push(event);
			},
		});

		// Execute your service
		await createWorkspaceService.execute(command);

		// Assert domain events were handled
		expect(handledEvents).toHaveLength(1);
		expect(handledEvents[0].name).toBe('WorkspaceCreated');

		// Assert integration events were published
		expect(integrationBus.published).toHaveLength(1);
		expect(integrationBus.published[0].name).toBe('WorkspaceCreated');
	});
});
```

## API Reference

### Types

#### `BaseEvent`

```typescript
interface BaseEvent {
	readonly name: string;
	readonly occurredAt: Date;
	readonly correlationId?: string;
	readonly causationId?: string;
}
```

#### `DomainEvent<TId>`

```typescript
interface DomainEvent<TId = string> extends BaseEvent {
	readonly aggregateId: TId;
}
```

#### `IntegrationEvent`

```typescript
interface IntegrationEvent extends BaseEvent {
	readonly source?: string;
}
```

### Classes

#### `DomainEventBase<TId>`

Abstract base class for domain events.

```typescript
abstract class DomainEventBase<TId = string> implements DomainEvent<TId> {
	protected constructor(name: string, aggregateId: TId, correlationId?: string, causationId?: string);
}
```

#### `IntegrationEventBase`

Abstract base class for integration events.

```typescript
abstract class IntegrationEventBase implements IntegrationEvent {
	protected constructor(name: string, source?: string, correlationId?: string, causationId?: string);
}
```

#### `InMemoryDomainEventDispatcher`

Simple in-memory dispatcher for domain events.

```typescript
class InMemoryDomainEventDispatcher implements DomainEventDispatcher {
	register<TEvent extends DomainEvent>(eventName: string, handler: DomainEventHandler<TEvent>): void;

	publish(event: DomainEvent): Promise<void>;
	publishAll(events: DomainEvent[]): Promise<void>;
}
```

#### `InMemoryIntegrationEventBus`

Simple in-memory bus for integration events (mainly for testing).

```typescript
class InMemoryIntegrationEventBus implements IntegrationEventBus {
	readonly published: IntegrationEvent[];

	publish(event: IntegrationEvent): Promise<void>;
	publishAll(events: IntegrationEvent[]): Promise<void>;
}
```

### Functions

#### `createDomainEvent`

Factory function for creating domain events functionally.

```typescript
function createDomainEvent<TName extends string, TId, TPayload extends object>(
	name: TName,
	aggregateId: TId,
	payload: TPayload,
	meta?: {
		occurredAt?: Date;
		correlationId?: string;
		causationId?: string;
	}
): DomainEvent<TId> & TPayload;
```

### Interfaces

#### `DomainEventHandler<TEvent>`

```typescript
interface DomainEventHandler<TEvent extends DomainEvent = DomainEvent> {
	handle(event: TEvent): Promise<void> | void;
}
```

#### `DomainEventDispatcher`

```typescript
interface DomainEventDispatcher {
	publish(event: DomainEvent): Promise<void>;
	publishAll(events: DomainEvent[]): Promise<void>;
}
```

#### `IntegrationEventHandler<TEvent>`

```typescript
interface IntegrationEventHandler<TEvent extends IntegrationEvent = IntegrationEvent> {
	handle(event: TEvent): Promise<void> | void;
}
```

#### `IntegrationEventBus`

```typescript
interface IntegrationEventBus {
	publish(event: IntegrationEvent): Promise<void>;
	publishAll(events: IntegrationEvent[]): Promise<void>;
}
```

## Integration with Other @tact-ddd Packages

### With `@tact-ddd/core`

The `DomainEvent` interface is structurally compatible with the `DomainEventLike` constraint in `AggregateRoot`:

```typescript
import { AggregateRoot } from '@tact-ddd/core';
import { DomainEvent } from '@tact-ddd/events';

// Works seamlessly - DomainEvent satisfies the AggregateRoot constraint
class MyAggregate extends AggregateRoot<MyId, DomainEvent<MyId>> {
	// ...
}
```

### With `@tact-ddd/outbox`

Use `@tact-ddd/outbox` to reliably publish integration events with transactional guarantees:

```typescript
import { OutboxRepository } from '@tact-ddd/outbox';
import { IntegrationEvent } from '@tact-ddd/events';

// In your application service, after persisting the aggregate:
const integrationEvents: IntegrationEvent[] = mapDomainEventsToIntegrationEvents(domainEvents);

// Store in outbox (same transaction as aggregate persistence)
await outboxRepository.save(integrationEvents);

// Separate process polls the outbox and publishes to your actual bus
```

### With `@tact-ddd/ids`

Use branded ID types for type-safe aggregate identifiers:

```typescript
import { createId } from '@tact-ddd/ids';
import { DomainEventBase } from '@tact-ddd/events';

type WorkspaceId = string & { readonly brand: 'WorkspaceId' };

const workspaceId = createId<WorkspaceId>();

class WorkspaceCreated extends DomainEventBase<WorkspaceId> {
	constructor(workspaceId: WorkspaceId) {
		super('WorkspaceCreated', workspaceId);
	}
}
```

## Design Principles

1. **Structural typing over nominal typing**: Events are compatible based on their shape, not inheritance
2. **No framework lock-in**: Pure TypeScript with minimal abstractions
3. **Clear bounded context boundaries**: Domain events stay in-process, integration events cross boundaries
4. **Testability first**: In-memory implementations make testing easy
5. **Type safety**: Full TypeScript support with generics for aggregate IDs
6. **Observability**: Built-in correlation and causation tracking

## Best Practices

### Domain Events

- **Name events in past tense**: `WorkspaceCreated`, not `CreateWorkspace`
- **Make them immutable**: Use `readonly` properties
- **Keep them simple**: Events are facts, not commands
- **One aggregate = one stream**: Events should reference a single aggregate
- **Handle side effects in handlers**: Don't perform I/O in aggregate methods

### Integration Events

- **Stable public contracts**: These are your bounded context's API
- **Include context**: Add enough data so consumers don't need to call back
- **Version carefully**: Consider versioning strategy from the start
- **Use outbox pattern**: Never publish directly from your domain
- **Document your events**: They're your public API

### Event Handlers

- **Idempotent when possible**: Handlers may be called multiple times
- **Handle failures gracefully**: Consider retry and dead-letter policies
- **Keep them focused**: One handler, one responsibility
- **Async by default**: Even in-process handlers should be async-capable

## License

MIT

## Contributing

Contributions are welcome! This package is part of the `@tact-ddd` monorepo.

## Related Packages

- [`@tact-ddd/core`](../core) - Core DDD building blocks (Entity, ValueObject, AggregateRoot)
- [`@tact-ddd/ids`](../ids) - Type-safe ID generation with branded types
- [`@tact-ddd/outbox`](../outbox) - Transactional outbox pattern implementation
