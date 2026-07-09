# Use Cases

Common ways to use SchemaBridge. The examples assume your schemas are exported from TypeScript files.

## 1. One Zod Schema To Python

Input (`schema.ts`):

```ts
import { z } from 'zod';

export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  createdAt: z.date(),
});
```

Generate one Pydantic model:

```bash
npx schemabridge convert zod schema.ts \
  --export userSchema \
  --to pydantic \
  --out user.py
```

Use it from Python:

```python
from user import UserSchema

user = UserSchema(
    id="550e8400-e29b-41d4-a716-446655440000",
    email="user@example.com",
    createdAt="2024-01-01T00:00:00Z",
)
```

## 2. Folder Of Schemas To A Python Package

Use folder conversion when a TypeScript package owns several schemas:

```bash
schemabridge convert folder ./packages/schemas \
  --out ./services/api/models \
  --to pydantic \
  --init \
  --clean
```

`--init` creates package imports. `--clean` removes stale files only when they have the SchemaBridge generated-file marker.

Then import generated models normally:

```python
from services.api.models.user import UserSchema
from services.api.models.order import OrderSchema
```

If schemas live in another package, point `sourceDir` at that package or create a small wrapper file that re-exports the schemas you want.

## 3. Generate TypeScript `.d.ts` Types

For one schema:

```bash
schemabridge convert zod schema.ts \
  --export userSchema \
  --to typescript \
  --out user.d.ts
```

For a folder:

```bash
schemabridge convert folder ./src/schemas \
  --out ./src/types \
  --to typescript
```

Then import the generated type:

```ts
import type { User } from './types/user';
```

## 4. Build And CI Sync

Use the API when generation is part of your build:

```ts
import { convertFolder } from 'schemabridge';

await convertFolder({
  sourceDir: './src/schemas',
  outDir: './python/models',
  target: 'pydantic',
  preserveStructure: true,
  generateInitFiles: true,
  clean: true,
  trustedInput: true,
});
```

Wire it into `package.json`:

```json
{
  "scripts": {
    "generate:models": "tsx scripts/generate-models.ts"
  }
}
```

If generated files are committed, use `--verify` in CI to fail when they are stale:

```bash
schemabridge convert folder ./src/schemas --out ./python/models --to pydantic --init --verify
```

For all flags and API options, see the CLI Guide and API Reference.
