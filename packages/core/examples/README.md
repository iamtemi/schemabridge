# SchemaBridge Folder Conversion (Synthetic Example)

This example shows how to convert an entire folder of Zod schemas into Pydantic models (and optionally `.d.ts`) using the folder conversion command.

## Layout

```
examples/
  source/            # Synthetic Zod schemas
    common/enums.ts
    users/user.ts
    inventory/product.ts
    orders/order.ts
    index.ts
  pydantic/          # Output directory (not committed)
```

## Quickstart

Convert everything under `examples/source` and mirror the folder structure into `examples/pydantic`:

```bash
schemabridge convert folder ./examples/source \
  --out ./examples/pydantic \
  --to pydantic \
  --init
```

Flat output (all files in one directory):

```bash
schemabridge convert folder ./examples/source \
  --out ./examples/pydantic \
  --to pydantic \
  --flat
```

Generate both Python and TypeScript definitions:

```bash
schemabridge convert folder ./examples/source \
  --out ./examples/pydantic \
  --to all
```

## Notes

- Schemas import each other to exercise path resolution and nested references.
- Outputs are not committed; re-run the commands above to regenerate.\*\*\*
