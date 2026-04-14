# AGENTS.md

## Project Overview

TypeScript DDD monorepo (`tact-ddd`) providing lightweight, composable tactical DDD building blocks. Uses Bun as runtime, package manager, test runner, and build orchestrator. Monorepo managed via Bun workspaces.

### Packages

| Package            | Path              | Purpose                                                   |
| ------------------ | ----------------- | --------------------------------------------------------- |
| `@tact-ddd/core`   | `packages/core`   | Entity, AggregateRoot, ValueObject, Result, Guard, Errors |
| `@tact-ddd/events` | `packages/events` | Domain events, integration events, dispatchers            |
| `@tact-ddd/ids`    | `packages/ids`    | Branded ID types with prefix + nanoid generation          |
| `@tact-ddd/outbox` | `packages/outbox` | Transactional outbox pattern (ports & adapters)           |
| `@tact-ddd/docs`   | `apps/docs`       | Fumadocs/Next.js documentation site                       |

## Build / Lint / Test Commands

### Build

```sh
bun run build                  # Build all packages (from root)
bun run build                  # Build a single package (from its directory)
```

Packages use `tsdown` as bundler. Output goes to `dist/` (ESM `.mjs` + `.d.ts`).

### Type Checking

```sh
bun run check-types            # Type-check all packages (from root)
bun run check-types            # Type-check single package (from its directory)
```

Runs `tsc --noEmit` in each package. The docs app additionally runs `fumadocs-mdx` first.

### Testing

```sh
bun test                       # Run ALL tests across the entire monorepo
bun test packages/core         # Run all tests in a single package
bun test packages/core/src/entity.test.ts   # Run a single test file
bun test --test-name-pattern "returns true"  # Filter by test name
```

Test runner is Bun's built-in `bun:test`. No Jest or Vitest.

### Linting

No root-level ESLint/Biome/Prettier config. The docs app has ESLint (`bun run lint` from `apps/docs`). Library packages rely on TypeScript strict mode and convention.

### CI

GitHub Actions runs on push/PR to `main`: `bun install && bun run build && bun test`.

## Code Style Guidelines

### Formatting

- **Indentation**: Tabs (not spaces)
- **Semicolons**: Always required
- **Quotes**: Single quotes for all strings
- **Trailing commas**: Yes, in multi-line objects and parameter lists
- **Braces**: K&R style (opening brace on same line)
- **Arrow functions**: Always parenthesize parameters: `(x) => ...` not `x => ...`
- **Line length**: No hard limit; don't artificially break lines

### Imports

- **Named imports only** -- never use default imports or default exports
- **`import type`** for type-only imports (enforced by `verbatimModuleSyntax: true`):
  ```ts
  import type { DomainError } from './errors';
  ```
- **Inline `type` keyword** for mixed value + type imports:
  ```ts
  import { AggregateRoot, type DomainEventLike } from './aggregate-root';
  ```
- **Relative paths** with `./` prefix, no file extensions, no path aliases (`@/` etc.)
- **External packages** use bare specifiers: `'nanoid'`, `'bun:test'`, `'@tact-ddd/events'`

### Exports

- **Named inline exports** at declaration site -- never a separate `export { }` block
- **No default exports** anywhere
- **Barrel files**: Each package has `src/index.ts` using `export * from './module'`
- Test files export nothing

### Naming Conventions

| Element         | Convention                           | Examples                                      |
| --------------- | ------------------------------------ | --------------------------------------------- |
| Files           | `kebab-case.ts`                      | `aggregate-root.ts`, `value-object.ts`        |
| Test files      | `<module>.test.ts` (co-located)      | `entity.test.ts`                              |
| Classes         | `PascalCase`                         | `AggregateRoot`, `OutboxProcessor`            |
| Abstract bases  | `PascalCase` + `Base` suffix         | `DomainEventBase`, `IntegrationEventBase`     |
| Interfaces      | `PascalCase`, no `I` prefix          | `OutboxStore`, `DomainEventHandler`           |
| Type aliases    | `PascalCase`                         | `Result`, `OutboxMessageStatus`, `Brand`      |
| Functions       | `camelCase`                          | `createDomainEvent`, `defineIdType`, `ensure` |
| Constants       | `UPPER_SNAKE_CASE`                   | `DEFAULT_ID_LENGTH`, `FRIENDLY_ALPHABET`      |
| Properties/vars | `camelCase`                          | `aggregateId`, `correlationId`, `batchSize`   |
| Type parameters | `T`-prefixed PascalCase              | `TId`, `TEvent`, `TPayload`, `TName`          |
| Private fields  | Underscore prefix for backing fields | `_domainEvents`                               |
| Error codes     | `UPPER_SNAKE_CASE` or dot-separated  | `'INVALID_STATE'`, `'User.NotFound'`          |
| Options types   | `<Class>Options`                     | `OutboxProcessorOptions`                      |

### TypeScript Patterns

- **Strict mode**: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`
- **`readonly` everywhere**: All interface properties, class fields, return types for arrays
- **`unknown` over `any`**: Use `unknown` for generic payloads; `as any` only in tests
- **Branded types** for nominal typing:
  ```ts
  type Brand<TBase, TBrand extends string> = TBase & { readonly __brand: TBrand };
  ```
- **Discriminated unions** with `as const` for literal types:
  ```ts
  type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
  return { ok: true as const, value };
  ```
- **Type guard functions** with `is` return type:
  ```ts
  function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T };
  ```
- **Assertion functions** with `asserts` return type:
  ```ts
  function ensure(condition: unknown, code: string, message?: string): asserts condition;
  ```
- **Generics with defaults**: `DomainEvent<TId = string>`, `Result<T, E = DomainError>`
- **Constructor parameter promotion**: `constructor(public readonly id: TId) {}`
- **Protected constructors** on abstract base classes
- **Nullish coalescing** for defaults: `config.length ?? DEFAULT_ID_LENGTH`
- **Template literal types**: `` type BrandName = `${P}_id` ``
- **No enums, no decorators, no mapped types** -- keep it minimal

### Error Handling

Two complementary strategies:

1. **`Result<T, E>` type** for expected domain failures (validation, business rules):

   ```ts
   function divide(a: number, b: number): Result<number> {
   	if (b === 0) return err(new DomainError('DIVISION_BY_ZERO'));
   	return ok(a / b);
   }
   ```

2. **Thrown exceptions** for invariant violations (programming errors, impossible states):
   ```ts
   ensure(amount > 0, 'INVALID_AMOUNT', 'Amount must be positive');
   // throws InvariantViolation if condition is false
   ```

Error class hierarchy: `Error -> DomainError -> InvariantViolation | NotFoundError`. All errors have a `readonly code: string` property. Uses `Object.setPrototypeOf(this, new.target.prototype)` fix.

### Testing Conventions

- **Runner**: `bun:test` -- import `{ describe, expect, test }` from `'bun:test'`
- **Use `test()`**, not `it()`
- **Test names**: Lowercase descriptive sentences: `test('returns true for entities with same id', ...)`
- **Co-located** test files next to source: `entity.ts` + `entity.test.ts`
- **Concrete subclasses inline**: Create test implementations of abstract classes at the top of the test file
- **No mocking frameworks**: Use inline mock classes implementing interfaces; Bun's `mock()` for simple spies
- **No `beforeEach`/`afterEach`**: Each test sets up its own state
- **Type narrowing over casts**: Use `if (result.ok)` blocks, not `as` casts
- **Non-null assertion** for array access in tests: `events[0]!.name` (required by `noUncheckedIndexedAccess`)
- **`expect.unreachable()`** for "should have thrown" paths
- **`as any`** only for mutating `readonly` properties in mock implementations

### Documentation

- **JSDoc** (`/** ... */`) on public interfaces, classes, and their properties
- Short descriptions only -- no `@param` / `@returns` tags
- No separate markdown documentation files for individual modules (docs live in package READMEs)

### Architecture Notes

- **Ports & adapters**: The outbox package defines interfaces (`OutboxStore`, `OutboxSerializer`) as contracts; consumers provide implementations
- **Domain events are plain objects** conforming to `DomainEventLike` / `DomainEvent` interfaces -- not class instances
- **Integration events** add a `source` field for cross-service identification
- **Aggregate roots** collect domain events internally via `addDomainEvent()` (protected) and expose them via `pullDomainEvents()` (retrieves and clears the buffer)
- **Value objects** use structural equality via the `getEqualityComponents()` pattern
- **IDs** are branded strings with a prefix (e.g., `usr_abc123`) -- use `defineIdType()` factory
