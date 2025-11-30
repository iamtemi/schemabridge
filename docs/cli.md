# CLI Guide

Two commands cover everything:

- `convert zod` — one file/export
- `convert folder` — entire tree

## One file

```bash
schemabridge convert zod schema.ts --export userSchema --to pydantic --out user.py
```

- `--to typescript` for `.d.ts`
- `--to all` for both

## Whole folder

```bash
schemabridge convert folder ./src/schemas --out ./generated --to pydantic --init
```

- Preserves structure; use `--flat` for a single directory.
- `--init` drops `__init__.py` files so Python imports work.

## Enum handling

```ts
export const role = z.enum(['admin', 'viewer']);
```

**Default behavior:**

- Pydantic: Generates `class RoleEnum(str, Enum): ...`
- TypeScript: `export type RoleEnum = "admin" | "viewer"`

**Options:**

- `--enum-style literal` - Use Literal types instead of Enum classes (Pydantic)
- `--enum-base-type int` - Use `int, Enum` instead of `str, Enum` (Pydantic)

## Flags cheat sheet

- `--to pydantic|typescript|all`
- `--out <file|dir>`
- `--flat` (folder mode)
- `--init` (folder mode, Python packages)
- `--allow-unresolved` (warn/continue on import issues)
- `--tsconfig <path>` (folder/file mode; uses tsx discovery if not set)
- `--enum-style enum|literal` (enum generation style, default: `enum`)
- `--enum-base-type str|int` (enum base type, default: `str`)

## Notes on Zod v4

- Prefer direct helpers: `z.date()`, `z.coerce.date()`, `z.string().uuid()`, `z.string().email()`.
- Avoid deprecated `z.string().datetime()`; if you need ISO datetime, use `z.string().datetime()` in v4 or `z.coerce.date()` if you want Date objects.

## Example (monorepo)

```bash
schemabridge convert folder ./packages/schemas \
  --out ./services/api/models \
  --to pydantic \
  --init
```

Then in Python: `from services.api.models.user import UserSchema`

Hook it into CI/build to keep models current.\*\*\*
