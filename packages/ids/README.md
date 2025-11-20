# `@ddd-ts/ids`

**Type-safe, prefixed, and globally unique identifiers for Domain-Driven Design**

You can think of this as: **"one global friendly alphabet + a tiny factory that makes branded, prefixed ID types."**

This package provides:

- **nanoid** with a **custom alphabet** (no confusing chars like `0/O` or `1/l`)
- **short prefixes** (e.g. `ws_`, `usr_`, `ord_`, etc.)
- **branded string types** so TypeScript won't let you mix `WorkspaceId` and `UserId`
- **validation** and **type guards** for runtime safety

Inspired by [Unkey's ID implementation](https://unkey.com).

---

## Installation

```bash
npm install @ddd-ts/ids
# or
bun add @ddd-ts/ids
# or
pnpm add @ddd-ts/ids
```

---

## Quick Start

```typescript
import { defineIdType } from '@ddd-ts/ids';

// Define a User ID type
export const UserIdFactory = defineIdType({ prefix: 'usr' });
export type UserId = ReturnType<(typeof UserIdFactory)['parse']>;

// Create a new ID
const userId = UserIdFactory.create();
// => "usr_A3fK8mN9pQrS2tUv"

// Use it in your domain
function findUser(id: UserId) {
	// ...
}

findUser(userId); // ✅ OK
```

---

## Core Concepts

### 1. Brand Helper

The package uses TypeScript's **nominal typing** pattern to create distinct types at compile-time while keeping them as strings at runtime:

```typescript
export type Brand<TBase, TBrand extends string> = TBase & {
	readonly __brand: TBrand;
};
```

This ensures that `UserId` and `WorkspaceId` are treated as different types by TypeScript, even though they're both strings under the hood.

### 2. Friendly Alphabet

The package uses a **Base58-like alphabet without ambiguous characters**:

```typescript
const FRIENDLY_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
```

This excludes:

- `0` (zero) and `O` (capital o)
- `1` (one), `l` (lowercase L), and `I` (capital i)

### 3. Type-Safe Factory

The `defineIdType` function creates a factory for each ID type with:

- A **branded type** (e.g., `WorkspaceId`)
- A `create()` function that generates `prefix_xxx` strings
- A `parse()` function that validates and brands existing strings
- An `is()` type guard for runtime checks

---

## API Reference

### `defineIdType<P>(config: IdConfig<P>)`

Creates a type-safe ID factory with the specified configuration.

#### Parameters

```typescript
interface IdConfig<P extends string> {
	prefix: P; // The prefix for this ID type (e.g., "usr", "ws")
	length?: number; // Optional: override default length (default: 16)
	strict?: boolean; // Optional: enforce alphabet validation (default: false)
}
```

#### Returns

An object with the following methods and properties:

```typescript
{
  prefix: string;           // The prefix used
  length: number;           // The core ID length (excluding prefix)
  create: () => Id;         // Generate a new ID
  parse: (raw: string) => Id;  // Validate and brand an existing string
  is: (raw: string) => raw is Id;  // Type guard for runtime checks
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { defineIdType } from '@ddd-ts/ids';

// Define your ID types
export const WorkspaceIdFactory = defineIdType({ prefix: 'ws' });
export type WorkspaceId = ReturnType<(typeof WorkspaceIdFactory)['parse']>;

export const UserIdFactory = defineIdType({ prefix: 'usr' });
export type UserId = ReturnType<(typeof UserIdFactory)['parse']>;

// Create new IDs
const workspaceId = WorkspaceIdFactory.create();
// => "ws_A3fK8mN9pQrS2tUv"

const userId = UserIdFactory.create();
// => "usr_X7yZ4bC6dE9fG2hJ"
```

### Type Safety

TypeScript prevents you from mixing different ID types:

```typescript
function loadWorkspace(id: WorkspaceId) {
	// ...
}

function findUser(id: UserId) {
	// ...
}

const workspaceId = WorkspaceIdFactory.create();
const userId = UserIdFactory.create();

loadWorkspace(workspaceId); // ✅ OK
findUser(userId); // ✅ OK

// These cause compile-time errors:
loadWorkspace(userId); // ❌ Type error!
findUser(workspaceId); // ❌ Type error!

// Plain strings don't work either:
const plainString = 'ws_abc123';
loadWorkspace(plainString); // ❌ Type error!
```

### Parsing Existing IDs

Use `parse()` to validate and brand IDs from external sources (e.g., databases, APIs):

```typescript
const OrderIdFactory = defineIdType({ prefix: 'ord' });
export type OrderId = ReturnType<(typeof OrderIdFactory)['parse']>;

// From a database or API
const rawId = 'ord_K8mN9pQrS2tU';

try {
	const orderId = OrderIdFactory.parse(rawId);
	// orderId is now branded as OrderId
	processOrder(orderId);
} catch (error) {
	console.error('Invalid order ID:', error.message);
}

// Invalid examples that throw errors:
OrderIdFactory.parse('usr_abc123'); // ❌ Wrong prefix
OrderIdFactory.parse('ord_123'); // ❌ Wrong length
OrderIdFactory.parse('ord_'); // ❌ Empty core
```

### Custom Length

Different ID types can have different lengths:

```typescript
// Short IDs for frequently used entities
const SessionIdFactory = defineIdType({
	prefix: 'sess',
	length: 12,
});
// => "sess_A3fK8mN9pQr"

// Longer IDs for permanent entities
const DocumentIdFactory = defineIdType({
	prefix: 'doc',
	length: 24,
});
// => "doc_A3fK8mN9pQrS2tUvW4xY7zA2"
```

### Strict Mode

Enable strict mode to validate that IDs only contain characters from the friendly alphabet:

```typescript
const ProductIdFactory = defineIdType({
	prefix: 'prod',
	length: 16,
	strict: true,
});

// Valid - uses only friendly alphabet characters
ProductIdFactory.parse('prod_A3fK8mN9pQrS2tUv'); // ✅ OK

// Invalid - contains disallowed characters
ProductIdFactory.parse('prod_0O1lI_invalid!!'); // ❌ Throws error
```

Without strict mode (default), `parse()` only checks prefix and length.

### Runtime Type Guards

Use the `is()` method for runtime type checks:

```typescript
const WorkspaceIdFactory = defineIdType({ prefix: 'ws' });

function handleId(raw: string) {
	if (WorkspaceIdFactory.is(raw)) {
		// TypeScript knows 'raw' is WorkspaceId here
		loadWorkspace(raw);
	} else {
		console.log('Not a valid workspace ID');
	}
}
```

---

## Advanced Patterns

### Central Prefix Registry

Create a single source of truth for all your ID prefixes:

```typescript
// id-registry.ts
import { defineIdType } from '@ddd-ts/ids';

export const prefixes = {
	workspace: 'ws',
	user: 'usr',
	team: 'team',
	project: 'proj',
	task: 'task',
	comment: 'cmt',
	api_key: 'key',
} as const;

export type IdKind = keyof typeof prefixes;

// Define all ID factories
export const WorkspaceIdFactory = defineIdType({ prefix: prefixes.workspace });
export type WorkspaceId = ReturnType<(typeof WorkspaceIdFactory)['parse']>;

export const UserIdFactory = defineIdType({ prefix: prefixes.user });
export type UserId = ReturnType<(typeof UserIdFactory)['parse']>;

export const TeamIdFactory = defineIdType({ prefix: prefixes.team });
export type TeamId = ReturnType<(typeof TeamIdFactory)['parse']>;

// ... export other factories

// Optional: Generic ID creator
export function createId(kind: IdKind) {
	switch (kind) {
		case 'workspace':
			return WorkspaceIdFactory.create();
		case 'user':
			return UserIdFactory.create();
		case 'team':
			return TeamIdFactory.create();
		case 'project':
			return ProjectIdFactory.create();
		case 'task':
			return TaskIdFactory.create();
		case 'comment':
			return CommentIdFactory.create();
		case 'api_key':
			return ApiKeyIdFactory.create();
	}
}
```

### Domain Entity Integration

Use branded IDs in your domain entities:

```typescript
import { WorkspaceId, UserId } from './id-registry';

interface Workspace {
	id: WorkspaceId;
	name: string;
	ownerId: UserId;
	createdAt: Date;
}

interface User {
	id: UserId;
	email: string;
	workspaceIds: WorkspaceId[];
}

// Repository with type-safe IDs
class WorkspaceRepository {
	async findById(id: WorkspaceId): Promise<Workspace | null> {
		// Implementation
	}

	async save(workspace: Workspace): Promise<void> {
		// Implementation
	}
}
```

### Database Integration

When working with databases, parse IDs on the way in and out:

```typescript
import { WorkspaceIdFactory, WorkspaceId } from './id-registry';

// Reading from database
async function getWorkspaceFromDb(rawId: string): Promise<Workspace> {
	const id = WorkspaceIdFactory.parse(rawId); // Validate and brand

	const row = await db.query('SELECT * FROM workspaces WHERE id = $1', [id]);

	return {
		id,
		name: row.name,
		// ...
	};
}

// Writing to database
async function saveWorkspace(workspace: Workspace): Promise<void> {
	await db.query(
		'INSERT INTO workspaces (id, name) VALUES ($1, $2)',
		[workspace.id, workspace.name] // ID is already a string at runtime
	);
}
```

### API Route Handlers

Validate IDs from request parameters:

```typescript
import { WorkspaceIdFactory } from './id-registry';

app.get('/workspaces/:id', async (req, res) => {
	try {
		const workspaceId = WorkspaceIdFactory.parse(req.params.id);
		const workspace = await workspaceRepo.findById(workspaceId);

		if (!workspace) {
			return res.status(404).json({ error: 'Workspace not found' });
		}

		res.json(workspace);
	} catch (error) {
		res.status(400).json({ error: 'Invalid workspace ID' });
	}
});
```

---

## Testing

The package includes comprehensive tests. Run them with:

```bash
bun test
```

Example test patterns:

```typescript
import { describe, expect, test } from 'bun:test';
import { defineIdType } from '@ddd-ts/ids';

describe('ID Generation', () => {
	test('creates valid IDs with correct format', () => {
		const UserId = defineIdType({ prefix: 'user', length: 10 });
		const id = UserId.create();

		expect(typeof id).toBe('string');
		expect(id.startsWith('user_')).toBe(true);
		expect(id.length).toBe('user_'.length + 10);
	});

	test('parses valid IDs and rejects invalid ones', () => {
		const OrderId = defineIdType({ prefix: 'order', length: 12 });
		const validId = OrderId.create();

		expect(OrderId.parse(validId)).toBe(validId);
		expect(() => OrderId.parse('invalid_123')).toThrow();
		expect(() => OrderId.parse('order_123')).toThrow(); // Too short
	});
});
```

---

## Best Practices

1. **Export both the factory and the type:**

   ```typescript
   export const UserIdFactory = defineIdType({ prefix: 'usr' });
   export type UserId = ReturnType<(typeof UserIdFactory)['parse']>;
   ```

2. **Use descriptive prefixes:** Keep them short (2-4 chars) but meaningful

   - ✅ `usr`, `ws`, `proj`, `ord`
   - ❌ `u`, `w`, `p`, `o` (too cryptic)
   - ❌ `user`, `workspace` (too long)

3. **Parse IDs at boundaries:** Always parse IDs from external sources (APIs, databases) before using them in your domain logic

4. **Use strict mode for user-facing IDs:** Enable `strict: true` when parsing IDs that users might manually enter

5. **Document your prefix registry:** Keep all your prefixes in one place with documentation

---

## Why Use This Package?

### Type Safety

- **Compile-time checks** prevent mixing different ID types
- **Auto-completion** in your IDE for ID-related operations
- **Refactoring confidence** - TypeScript will catch breaking changes

### Runtime Safety

- **Prefix validation** ensures IDs are used in the correct context
- **Length validation** catches truncated or malformed IDs
- **Alphabet validation** (strict mode) ensures data integrity

### Developer Experience

- **Clear error messages** when validation fails
- **Consistent API** across all ID types
- **Easy testing** with predictable behavior

### Production Ready

- **No ambiguous characters** reduces user errors
- **Globally unique** with nanoid's collision resistance
- **Compact** - shorter than UUIDs while remaining unique
- **Fast** - nanoid is highly optimized

---

## License

MIT

---

## Credits

- Inspired by [Unkey's ID implementation](https://unkey.com)
- Built on [nanoid](https://github.com/ai/nanoid) by Andrey Sitnik
