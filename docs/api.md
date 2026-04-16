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

**Note:** Only exported schemas are scanned. Non-exported schemas (e.g., `const schema = z.object(...)`) are ignored.

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
- `generateInitFiles` - For Pydantic targets (`target: 'pydantic'` or `'all'`), create and populate `__init__.py` files with imports for every generated model (default: `false`; ignored for TypeScript‑only runs)
- `allowUnresolved` - Continue if imports fail (default: `false`)
- `exportNamePattern` - Filter exports by glob (e.g. `*Schema`)
- `tsconfigPath` - Custom tsconfig for path resolution (tsx still reads from CWD)
- `registerTsLoader` - Use `tsx` to load TS directly (default: true)
- `enumStyle` - `'enum'` (default) generates Python Enum classes, `'literal'` generates Literal types
- `enumBaseType` - `'str'` (default) or `'int'` for enum class base type

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

## Root Schema Types

SchemaBridge supports converting any Zod schema type as a root schema:

- **Objects** (`z.object()`) → Pydantic models / TypeScript interfaces
- **Enums** (`z.enum()`) → Enum classes / union types
- **Unions** (`z.union()`) → Type aliases
- **Primitives** (`z.string()`, `z.number()`, `z.ipv4()`, etc.) → Type aliases
- **Arrays** (`z.array()`) → Type aliases

### Enum Support

Standalone enum exports and enum fields are fully supported:

```typescript
export const statusEnum = z.enum(['active', 'inactive', 'suspended']);
```

**Pydantic (default):** Generates Python Enum classes:

```python
class StatusEnum(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
```

**Pydantic (with `enumStyle: 'literal'`):** Generates Literal types:

```python
status: Literal["active", "inactive", "suspended"]
```

**TypeScript:** Generates union types:

```typescript
export type StatusEnum = 'active' | 'inactive' | 'suspended';
```

### Type Alias Examples

Non-object schemas generate type aliases:

```typescript
// Union
export const dateTypes = z.union([z.date(), z.iso.date()]);
// Pydantic: type DateTypes = Union[date, date]
// TypeScript: export type DateTypes = Date | string

// Primitive
export const ipv4 = z.ipv4();
// Pydantic: type Ipv4 = IPv4Address
// TypeScript: export type Ipv4 = string
```

## Zod v4

- Prefer `z.date()`, `z.coerce.date()`, `z.string().uuid()`, `z.string().email()`.
- Avoid deprecated `z.string().datetime()` unless you truly want string output.

::: warning Transform and Refine
Zod methods like `.transform()` and `.refine()` are runtime-only. SchemaBridge generates types based on the input shape, not the transformed output.
:::
