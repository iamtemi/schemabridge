# Getting Started

Keep it simple: install, run one command, see a file.

## Prerequisite

- Node.js 18+ (needed for both Node and Python wrappers)

## Install

:::code-group

```bash [npm]
npm install schemabridge
```

```bash [pnpm]
pnpm add schemabridge
```

```bash [yarn]
yarn add schemabridge
```

```bash [bun]
bun add schemabridge
```

:::

Python users: `pip install schemabridge` also works, but it still needs Node 18+ on your machine.

## First conversion (one schema)

1. Create a Zod schema (`schema.ts`):

```ts
import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date(),
});
```

2. Convert to Pydantic:

```bash
npx schemabridge convert zod schema.ts --export userSchema --to pydantic --out user.py
```

You’ll get `user.py` with a `UserSchema` class.

## Convert a whole folder

```bash
schemabridge convert folder ./src/schemas --out ./generated --to pydantic --init
```

- Mirrors your folder structure by default.
- Adds `__init__.py` so you can `from generated.user import UserSchema`.
- Use `--flat` to dump everything in one folder.

## Tips

- Use Zod v4 helpers directly: `z.date()`, `z.string().uuid()`, `z.string().email()`. Avoid `z.string().datetime()` (deprecated).
- For TypeScript path aliases, run from the project root so `tsconfig.json` is picked up.
- If a TS file won’t load, ensure `tsx` is installed during dev, or compile TS to JS first.\*\*\*
