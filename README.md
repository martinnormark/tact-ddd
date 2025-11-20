# tact-ddd

> A collection of lightweight, composable TypeScript packages for implementing Domain-Driven Design tactical patterns

## Overview

`tact-ddd` is a monorepo containing focused, framework-agnostic packages that provide the building blocks for Domain-Driven Design applications in TypeScript. Each package is designed to be minimal, type-safe, and runtime-light with zero or minimal dependencies.

## Packages

### [`@tact-ddd/core`](./packages/core)

Foundational tactical DDD primitives:

- **Entity** - Identity-based domain objects
- **Value Object** - Immutable objects with structural equality
- **Aggregate Root** - Consistency boundaries with domain event buffering
- **Guard** - Domain invariant enforcement
- **Result** - Type-safe error handling without exceptions

### [`@tact-ddd/ids`](./packages/ids)

Type-safe, prefixed identifiers:

- Branded types to prevent ID confusion (e.g., `UserId` vs `OrderId`)
- Friendly alphabet (no confusing characters like `0/O` or `1/l`)
- Short prefixes for readability (e.g., `usr_`, `ord_`, `ws_`)
- Built on nanoid for collision resistance

### [`@tact-ddd/events`](./packages/events)

Event abstractions for DDD:

- **Domain Events** - In-process communication within bounded contexts
- **Integration Events** - Cross-service communication
- Type-safe event definitions with correlation/causation tracking
- In-memory dispatchers for testing and simple applications
- Structural compatibility with `@tact-ddd/core` aggregates

### [`@tact-ddd/outbox`](./packages/outbox)

Transactional outbox pattern implementation:

- ORM-agnostic persistence abstractions
- Reliable integration event publishing
- Processor for async message dispatch
- Pluggable serialization and retry strategies

## Quick Start

```bash
# Install dependencies
bun install

# Run type checks across all packages
bun run check-types

# Build all packages
bun run build
```

## Design Principles

- **Minimal & Focused** - Each package does one thing well
- **Type-First** - Leverage TypeScript's type system for correctness
- **Framework-Agnostic** - No coupling to specific ORMs, frameworks, or message brokers
- **Zero Dependencies** - Core packages have no runtime dependencies
- **Composable** - Packages work together but can be used independently

## Philosophy

This is not a framework. It's a collection of carefully designed primitives that:

✅ **Provide:**

- Type-safe domain modeling constructs
- Event-driven architecture patterns
- Reliable messaging patterns

❌ **Don't dictate:**

- Database/ORM choices
- API framework
- Deployment architecture
- Message broker implementation

## Usage Example

```typescript
import { AggregateRoot } from '@tact-ddd/core';
import { defineIdType } from '@tact-ddd/ids';
import { DomainEventBase } from '@tact-ddd/events';

// Define ID types
const OrderIdFactory = defineIdType({ prefix: 'ord' });
type OrderId = ReturnType<typeof OrderIdFactory.parse>;

// Define domain events
class OrderPlaced extends DomainEventBase<OrderId> {
	constructor(orderId: OrderId, public readonly customerId: string) {
		super('OrderPlaced', orderId);
	}
}

// Create aggregate
class Order extends AggregateRoot<OrderId, OrderPlaced> {
	private status: 'pending' | 'confirmed';

	static place(orderId: OrderId, customerId: string): Order {
		const order = new Order(orderId, 'OrderPlaced');
		order.status = 'pending';
		order.raise(new OrderPlaced(orderId, customerId));
		return order;
	}

	confirm(): void {
		if (this.status !== 'pending') {
			throw new Error('Order must be pending to confirm');
		}
		this.status = 'confirmed';
	}
}
```

## Requirements

- **Bun** 1.3.2 or later (or Node.js 18+ with appropriate package manager)
- **TypeScript** 5.x

## Contributing

This monorepo uses Bun workspaces. Each package has its own `README.md` with detailed documentation.

## License

MIT
