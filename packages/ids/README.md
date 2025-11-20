# `@ddd-ts/ids`

## Usage example

```typescript
import { defineIdType } from '@ddd-ts/ids';

export const UserIdFactory = defineIdType({ prefix: 'usr' });
export type UserId = ReturnType<(typeof UserIdFactory)['parse']>;

const userId = UserIdFactory.create();

function findUser(id: UserId) {}

const workspaceId = WorkspaceIdFactory.create();
findUser(workspaceId); // ❌ TS error, different brand
```

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.2. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
