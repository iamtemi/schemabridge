# Known Limitations

This document outlines current limitations in SchemaBridge and workarounds where available.

## Schema Type Limitations

### Enums

**Limitation:** `z.enum()` schemas cannot be converted to Pydantic models because they're not object schemas.

**Example:**

```typescript
export const status = z.enum(['active', 'inactive']);
// ❌ Cannot convert - not an object schema
```

**Workaround:** Use object schemas with literal unions:

```typescript
export const status = z.union([z.literal('active'), z.literal('inactive')]);
// ✅ Can convert
```

### Transform, Refine, and Effects

**Limitation:** Zod methods like `.transform()`, `.refine()`, `.superRefine()`, `.check()`, and `.preprocess()` are not supported.

**Behavior:** SchemaBridge ignores these methods and generates types based on the underlying schema structure. A warning is emitted.

**Example:**

```typescript
const schema = z.number().transform((n) => n * 2);
// ⚠️ Warning: transform ignored, generates `float` type
```

**Workaround:** These are runtime-only operations. The generated types represent the input shape, which is typically what you want for static types.

## Import and Dependency Limitations

### Cross-File Schema References

**Limitation:** When a schema references another schema from a different file, the referenced schema is not automatically included in the generated output.

**Example:**

```typescript
// file1.ts
export const baseSchema = z.object({ id: z.string() });

// file2.ts
import { baseSchema } from './file1.js';
export const extendedSchema = z.object({
  base: baseSchema, // ✅ Works at runtime
  extra: z.number(),
});
```

When converting `extendedSchema`:

- ✅ The nested `Base` class is generated inline
- ❌ `BaseSchema` is not generated as a separate top-level class

**Workaround:** Convert both schemas separately:

```bash
schemabridge convert zod file1.ts --export baseSchema --to pydantic --out base.py
schemabridge convert zod file2.ts --export extendedSchema --to pydantic --out extended.py
```

Or use folder conversion, which converts all schemas:

```bash
schemabridge convert folder ./src --out ./generated --to pydantic
```

### Circular Dependencies

**Limitation:** Circular schema dependencies may cause issues.

**Status:** Will be handled gracefully in future versions.

**Workaround:** Restructure schemas to avoid circular dependencies, or convert schemas individually.

## TypeScript File Loading

### TypeScript Execution

**Requirement:** TypeScript files require a TypeScript loader to execute.

**Default Behavior:** SchemaBridge automatically registers `tsx/esm` loader when `registerTsLoader: true` (default).

**If `tsx` is not available:**

1. Install `tsx`: `npm install tsx`
2. Or precompile TypeScript to JavaScript

### tsconfig.json Path Mappings

**Support:** SchemaBridge supports TypeScript path mappings via `--tsconfig` flag.

**Example:**

```bash
schemabridge convert zod schema.ts --export MySchema --to pydantic --tsconfig ./tsconfig.json
```

**Limitation:** Only `paths` and `baseUrl` are supported. Other TypeScript compiler options are ignored.

## Output Limitations

### Nested Class Names

**Behavior:** Nested objects generate nested classes with auto-generated names.

**Example:**

```typescript
z.object({
  user: z.object({ name: z.string() }),
});
```

Generates:

```python
class MySchema(BaseModel):
    class User(BaseModel):  # Auto-generated name
        name: str
    user: User
```

**Note:** The nested class name is derived from the field name, not the schema name.

### Default Values

**Behavior:** Mutable defaults (arrays, objects) use `Field(default_factory=...)` to avoid shared mutable state.

**Example:**

```typescript
z.object({
  tags: z.array(z.string()).default([]),
});
```

Generates:

```python
tags: List[str] = Field(default_factory=list)
```

This is correct Pydantic behavior, but may differ from Zod's runtime behavior in some edge cases.

## Performance

### Large Schemas

**Status:** SchemaBridge handles large schemas well, but very deep nesting (>10 levels) may be slow.

**Optimization:** Consider flattening deeply nested structures if performance is an issue.

### Large Folder Scans

**Status:** Folder scanning is efficient, but scanning thousands of files may take time.

**Optimization:** Use `ignore` option to skip unnecessary directories:

```typescript
await convertFolder({
  sourceDir: './src',
  outDir: './generated',
  ignore: ['node_modules', 'dist', 'tests'],
});
```

## Future Improvements

These limitations are planned for future versions:

- ✅ Automatic schema inclusion from other files
- ✅ Circular dependency detection and handling
- ✅ Enhanced error messages with source locations
- ✅ Support for more Zod types (tuples, maps, etc.)
- ✅ Performance optimizations for large schemas

## Reporting Issues

If you encounter a limitation that's not documented here, please [open an issue](https://github.com/iamtemi/schemabridge/issues) with:

- A minimal example showing the limitation
- Expected vs. actual behavior
- Your use case
