# `@tact-ddd/core`

> A lightweight set of tactical DDD primitives for building domain-driven TypeScript applications.

## Overview

`@tact-ddd/core` provides the foundational building blocks for implementing Domain-Driven Design patterns in TypeScript. It's designed to be:

- **Runtime-light**: Zero external dependencies
- **Type-first**: Leverages TypeScript generics and structural typing
- **Framework-agnostic**: Works on Node.js, edge runtimes, and browsers
- **Composable**: Plays nicely with `@tact-ddd/ids` and `@tact-ddd/events` without circular dependencies

## Design Philosophy

This package deliberately focuses on **tactical DDD primitives only**:

✅ **Included:**

- Entity identity and equality
- Aggregate roots with domain event buffering
- Value objects with structural equality
- Domain errors and invariant guards
- Result type for error handling

❌ **Not included:**

- Repositories or data access
- CQRS/mediator runtime
- ORM integration
- Framework-specific adapters

## Installation

```bash
npm install @tact-ddd/core
# or
yarn add @tact-ddd/core
# or
bun add @tact-ddd/core
```

## Core Concepts

### Entity

Entities are objects with unique identity that persists over time. Two entities are equal if they have the same ID, regardless of their other properties.

```typescript
import { Entity } from '@tact-ddd/core';
import type { UserId } from '@tact-ddd/ids';

export class User extends Entity<UserId> {
	private email: string;
	private name: string;

	constructor(id: UserId, email: string, name: string) {
		super(id);
		this.email = email;
		this.name = name;
	}

	changeEmail(newEmail: string): void {
		// domain logic here
		this.email = newEmail;
	}
}

// Usage
const user1 = new User(userId, 'alice@example.com', 'Alice');
const user2 = new User(userId, 'alice@example.com', 'Alice');

user1.equals(user2); // true - same ID
```

**Key features:**

- Generic `TId` parameter for type-safe identity
- Built-in `equals()` method using identity comparison
- Constructor type checking for equality

### Aggregate Root

Aggregates are clusters of entities and value objects treated as a single unit. The aggregate root is the only entry point for modifications and maintains domain event buffers.

```typescript
import { AggregateRoot } from '@tact-ddd/core';
import type { DomainEvent } from '@tact-ddd/events';
import type { OrderId, CustomerId } from '@tact-ddd/ids';

export class OrderCreated implements DomainEvent {
	readonly name = 'OrderCreated';
	readonly occurredAt = new Date();

	constructor(public readonly aggregateId: OrderId, public readonly customerId: CustomerId) {}
}

export class Order extends AggregateRoot<OrderId, OrderCreated> {
	private customerId: CustomerId;
	private status: 'pending' | 'confirmed' | 'shipped';

	static create(id: OrderId, customerId: CustomerId): Order {
		const order = new Order(id, customerId);
		order.addDomainEvent(new OrderCreated(id, customerId));
		return order;
	}

	private constructor(id: OrderId, customerId: CustomerId) {
		super(id);
		this.customerId = customerId;
		this.status = 'pending';
	}

	confirm(): void {
		ensure(this.status === 'pending', 'Order.AlreadyConfirmed');
		this.status = 'confirmed';
		// add OrderConfirmed event...
	}
}

// Usage in application service
const order = Order.create(orderId, customerId);
await orderRepository.save(order);

// Pull events for dispatch
const events = order.pullDomainEvents();
await eventBus.publish(events);
```

**Key features:**

- Extends `Entity` with event buffering
- `addDomainEvent()` - Protected method for adding events
- `domainEvents` - Readonly getter for inspecting events
- `pullDomainEvents()` - Retrieves and clears event buffer
- `clearDomainEvents()` - Clears buffer without returning events
- Generic `TEvent` parameter for type-safe events
- Structural compatibility via `DomainEventLike` interface

**Note on dependencies:** The aggregate root uses a minimal `DomainEventLike` interface instead of importing from `@tact-ddd/events`, avoiding circular dependencies. Your domain events just need to have `name` and `occurredAt` properties.

### Value Object

Value objects are immutable objects defined by their attributes rather than identity. Two value objects are equal if all their properties are equal.

```typescript
import { ValueObject } from '@tact-ddd/core';

interface MoneyProps {
	currency: string;
	amountMinor: number; // cents
}

export class Money extends ValueObject {
	private constructor(private readonly props: MoneyProps) {
		super();
	}

	static create(currency: string, amountMinor: number): Money {
		// Enforce invariants
		ensure(Number.isInteger(amountMinor) && amountMinor >= 0, 'Money.InvalidAmount', 'Amount must be a non-negative integer');

		ensure(currency.length === 3, 'Money.InvalidCurrency', 'Currency must be a 3-letter ISO code');

		return new Money({ currency, amountMinor });
	}

	get currency(): string {
		return this.props.currency;
	}

	get amountMinor(): number {
		return this.props.amountMinor;
	}

	add(other: Money): Money {
		ensure(this.currency === other.currency, 'Money.CurrencyMismatch', 'Cannot add money with different currencies');

		return Money.create(this.currency, this.amountMinor + other.amountMinor);
	}

	protected getEqualityComponents(): readonly unknown[] {
		return [this.props.currency, this.props.amountMinor];
	}
}

// Usage
const price1 = Money.create('USD', 1000); // $10.00
const price2 = Money.create('USD', 1000);
const price3 = Money.create('USD', 2000);

price1.equals(price2); // true - same values
price1.equals(price3); // false - different amounts
```

**Key features:**

- Structural equality via `getEqualityComponents()`
- Immutable by convention (use private constructors + static factories)
- Uses `Object.is()` for deep equality checking
- Constructor type checking for equality

### Domain Errors

Structured error types for domain invariant violations and business rule failures.

```typescript
import { DomainError, InvariantViolation, NotFoundError } from '@tact-ddd/core';

// Base domain error
export class OrderError extends DomainError {
	constructor(code: string, message?: string) {
		super(`Order.${code}`, message);
	}
}

// Specialized errors
throw new InvariantViolation('Order.InvalidQuantity', 'Quantity must be positive');

throw new NotFoundError('Order', orderId);
// Error: "Order with id 'ord_abc123' was not found"

// Custom domain errors
export class InsufficientInventory extends OrderError {
	constructor(public readonly productId: string, public readonly requested: number, public readonly available: number) {
		super('InsufficientInventory', `Cannot order ${requested} units, only ${available} available`);
	}
}
```

**Available error classes:**

- `DomainError` - Base class with code and message
- `InvariantViolation` - For domain rule violations
- `NotFoundError` - For missing entities (auto-formats message)

### Invariant Guards

Helper function for enforcing domain invariants with type narrowing.

```typescript
import { ensure } from '@tact-ddd/core';

export class OrderLine extends Entity<OrderLineId> {
	constructor(id: OrderLineId, private quantity: number, private price: Money) {
		super(id);

		// Enforce invariants at construction
		ensure(quantity > 0, 'OrderLine.QuantityMustBePositive');
		ensure(price.amountMinor >= 0, 'OrderLine.PriceMustBeNonNegative');
	}

	changeQuantity(newQuantity: number): void {
		ensure(newQuantity > 0, 'OrderLine.QuantityMustBePositive', `Quantity ${newQuantity} is not valid`);

		this.quantity = newQuantity;
	}
}
```

**Features:**

- TypeScript `asserts` for type narrowing
- Throws `InvariantViolation` on failure
- Optional custom error message

### Result Type

A functional approach to error handling without throwing exceptions.

```typescript
import { Result, ok, err, isOk, isErr } from '@tact-ddd/core';
import type { DomainError } from '@tact-ddd/core';

// Command handler with Result
export class ChangeEmailHandler {
	async execute(userId: UserId, newEmail: string): Promise<Result<User>> {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			return err(new NotFoundError('User', userId));
		}

		if (!this.isValidEmail(newEmail)) {
			return err(new DomainError('User.InvalidEmail', 'Email format is invalid'));
		}

		user.changeEmail(newEmail);
		await this.userRepository.save(user);

		return ok(user);
	}

	private isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}
}

// Usage
const result = await handler.execute(userId, 'alice@example.com');

if (isOk(result)) {
	console.log('Email changed for user:', result.value.id);
} else {
	console.error('Failed:', result.error.message);
}
```

**Key features:**

- Discriminated union with `ok` property
- Type guards `isOk()` and `isErr()` for narrowing
- Generic error type (defaults to `DomainError`)
- Forces explicit error handling at call site

## Complete Example

Here's a full example combining all concepts:

```typescript
// domain/workspace/workspace.aggregate.ts
import { AggregateRoot, ValueObject, Result, ok, err, ensure, DomainError } from '@tact-ddd/core';
import type { WorkspaceId, UserId } from '@tact-ddd/ids';
import type { DomainEvent } from '@tact-ddd/events';

// Value Object
interface WorkspaceNameProps {
	value: string;
}

export class WorkspaceName extends ValueObject {
	private constructor(private readonly props: WorkspaceNameProps) {
		super();
	}

	static create(name: string): Result<WorkspaceName> {
		const trimmed = name.trim();

		if (trimmed.length === 0) {
			return err(new DomainError('WorkspaceName.Empty', 'Name cannot be empty'));
		}

		if (trimmed.length > 100) {
			return err(new DomainError('WorkspaceName.TooLong', 'Name cannot exceed 100 characters'));
		}

		return ok(new WorkspaceName({ value: trimmed }));
	}

	get value(): string {
		return this.props.value;
	}

	protected getEqualityComponents(): readonly unknown[] {
		return [this.props.value];
	}
}

// Domain Event
export class WorkspaceCreated implements DomainEvent {
	readonly name = 'WorkspaceCreated';
	readonly occurredAt = new Date();

	constructor(public readonly aggregateId: WorkspaceId, public readonly ownerId: UserId, public readonly workspaceName: string) {}
}

// Aggregate Root
export class Workspace extends AggregateRoot<WorkspaceId, WorkspaceCreated> {
	private name: WorkspaceName;
	private ownerId: UserId;
	private isArchived: boolean;

	static create(id: WorkspaceId, name: WorkspaceName, ownerId: UserId): Workspace {
		const workspace = new Workspace(id, name, ownerId);
		workspace.addDomainEvent(new WorkspaceCreated(id, ownerId, name.value));
		return workspace;
	}

	private constructor(id: WorkspaceId, name: WorkspaceName, ownerId: UserId) {
		super(id);
		this.name = name;
		this.ownerId = ownerId;
		this.isArchived = false;
	}

	rename(newName: WorkspaceName): void {
		ensure(!this.isArchived, 'Workspace.CannotRenameArchived', 'Cannot rename an archived workspace');

		this.name = newName;
		// Add WorkspaceRenamed event...
	}

	archive(): Result<void> {
		if (this.isArchived) {
			return err(new DomainError('Workspace.AlreadyArchived', 'Workspace is already archived'));
		}

		this.isArchived = true;
		// Add WorkspaceArchived event...
		return ok(undefined);
	}

	getName(): WorkspaceName {
		return this.name;
	}
}

// Application Service
export class CreateWorkspaceHandler {
	async execute(ownerId: UserId, name: string): Promise<Result<Workspace>> {
		// Validate value object
		const nameResult = WorkspaceName.create(name);
		if (!isOk(nameResult)) {
			return err(nameResult.error);
		}

		// Create aggregate
		const workspace = Workspace.create(generateWorkspaceId(), nameResult.value, ownerId);

		// Persist
		await this.workspaceRepository.save(workspace);

		// Dispatch events
		const events = workspace.pullDomainEvents();
		await this.eventBus.publish(events);

		return ok(workspace);
	}
}
```

## Integration with Other Packages

### With `@tact-ddd/ids`

Use branded ID types as the `TId` parameter:

```typescript
import { Entity } from '@tact-ddd/core';
import { createId, type BrandedId } from '@tact-ddd/ids';

type ProductId = BrandedId<'prd'>;

export class Product extends Entity<ProductId> {
	constructor(id: ProductId, private name: string) {
		super(id);
	}
}

const productId = createId<ProductId>('prd');
const product = new Product(productId, 'Widget');
```

### With `@tact-ddd/events`

Your domain events just need to match the `DomainEventLike` structure:

```typescript
import { AggregateRoot } from '@tact-ddd/core';
import { DomainEvent } from '@tact-ddd/events';

export class ProductCreated implements DomainEvent {
	readonly name = 'ProductCreated'; // ✓ required
	readonly occurredAt = new Date(); // ✓ required

	constructor(public readonly aggregateId: ProductId) {}
}

export class Product extends AggregateRoot<ProductId, ProductCreated> {
	// Works seamlessly - structural compatibility
}
```

## API Reference

### Entity<TId>

- `constructor(id: TId)` - Create entity with identity
- `equals(other: Entity<TId>): boolean` - Identity-based equality
- `id: TId` - Readonly identity property

### AggregateRoot<TId, TEvent>

Extends `Entity<TId>`

- `domainEvents: readonly TEvent[]` - View buffered events
- `pullDomainEvents(): TEvent[]` - Retrieve and clear events
- `clearDomainEvents(): void` - Clear events without returning
- `addDomainEvent(event: TEvent): void` - Protected method to buffer events

### ValueObject

- `equals(other: ValueObject): boolean` - Structural equality
- `getEqualityComponents(): readonly unknown[]` - Abstract method to implement

### DomainError

- `constructor(code: string, message?: string)`
- `code: string` - Error code for programmatic handling
- `message: string` - Human-readable error message

### Result<T, E = DomainError>

- `ok<T>(value: T): Result<T>` - Create success result
- `err<E>(error: E): Result<never, E>` - Create error result
- `isOk<T, E>(r: Result<T, E>): boolean` - Type guard for success
- `isErr<T, E>(r: Result<T, E>): boolean` - Type guard for error

### Guard

- `ensure(condition: unknown, code: string, message?: string): asserts condition`

## Best Practices

1. **Always use static factory methods** for aggregates and value objects
2. **Keep constructors private** to enforce invariants at creation
3. **Pull domain events** after persisting aggregates
4. **Use Result type** in application services and command handlers
5. **Validate at the boundary** - value objects should encapsulate validation
6. **Make value objects immutable** - return new instances for modifications
7. **Don't expose aggregate internals** - methods should preserve invariants

## License

MIT
