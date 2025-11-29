# API Reference

Use SchemaBridge in your build scripts and tools.

Use the CLI for quick conversions. Use the API to automate conversions in builds.

## All Functions

### `convertZodToPydantic` / `convertZodToTypescript`

Convert a Zod schema instance to code strings.

```typescript
import { z } from 'zod';
import { convertZodToPydantic, convertZodToTypescript } from 'schemabridge';

const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

const py = convertZodToPydantic(userSchema, { name: 'UserSchema' });
const dts = convertZodToTypescript(userSchema, { name: 'User' });
```

### `generateFilesFromZod`

Write generated files to disk (same rules as CLI `--to/--out`).

```typescript
await generateFilesFromZod({
  schema: userSchema,
  name: 'UserSchema',
  target: 'all', // 'pydantic' | 'typescript' | 'all'
  out: './generated', // file or directory depending on target
});
```

### `convertFolder`

Convert all schemas in a directory. Mirrors folder structure by default; one file per export (snake_case).

```typescript
import { convertFolder } from 'schemabridge';

const result = await convertFolder({
  sourceDir: './src/schemas',
  outDir: './generated',
  target: 'pydantic',
  preserveStructure: true,
  generateInitFiles: true,
});
```

**Options:**

- `sourceDir` - Where your Zod schemas are
- `outDir` - Where to write converted files
- `target` - `'pydantic'`, `'typescript'`, or `'all'`
- `preserveStructure` - Keep folder structure (default: `true`)
- `generateInitFiles` - Create `__init__.py` files (default: `false`)
- `allowUnresolved` - Continue if imports fail (default: `false`)
- `exportNamePattern` - Filter exports by glob (e.g. `*Schema`)
- `tsconfigPath` - Custom tsconfig for path resolution (tsx still reads from CWD)
- `registerTsLoader` - Use `tsx` to load TS directly (default: true)

### `loadZodSchema`

Load a schema from a file without converting it.

```typescript
import { loadZodSchema } from 'schemabridge';

const { schema, warnings } = await loadZodSchema({
  file: './schema.ts',
  exportName: 'userSchema',
  registerTsLoader: true,
  tsconfigPath: './tsconfig.json', // optional, tsx still reads CWD tsconfig
});

// Now you have the actual Zod schema object
```

### `scanFolderForSchemas`

Find all schemas in a directory without converting.

```typescript
import { scanFolderForSchemas } from 'schemabridge';

const { schemas } = await scanFolderForSchemas({
  sourceDir: './src/schemas',
});

schemas.forEach((s) => {
  console.log(`Found: ${s.exportName} in ${s.file}`);
});
```

## Zod v4 and enums

- Prefer `z.date()`, `z.coerce.date()`, `z.string().uuid()`, `z.string().email()`.
- Avoid deprecated `z.string().datetime()` unless you truly want string output.
- Enums: `z.enum([...])` → Pydantic `Literal[...]`, TypeScript union.

::: warning Transform and Refine
Zod methods like `.transform()` and `.refine()` are runtime-only. SchemaBridge generates types based on the input shape, not the transformed output.
:::
