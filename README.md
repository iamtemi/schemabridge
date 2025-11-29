# SchemaBridge

**Cross-language schema converter: Zod → Pydantic & TypeScript**

[![npm version](https://img.shields.io/npm/v/schemabridge.svg)](https://www.npmjs.com/package/schemabridge)
[![npm downloads](https://img.shields.io/npm/dm/schemabridge.svg)](https://www.npmjs.com/package/schemabridge)
[![PyPI version](https://img.shields.io/pypi/v/schemabridge.svg)](https://pypi.org/project/schemabridge/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with TypeScript](https://img.shields.io/badge/Built%20with-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

SchemaBridge converts Zod schemas to Pydantic v2 models and TypeScript type definitions, so TS and Python services can share a single source of truth.

## Why

- Avoid hand-porting Pydantic models from Zod
- Skip JSON Schema detours and brittle codegen glue
- Keep one schema definition and generate everything else

## Install

```bash
# Node / TypeScript
npm install schemabridge

# Python (still needs Node 18+)
pip install schemabridge
```

**Requirements**

- Node.js >= 18.0.0
- Python >= 3.9 (only for the Python package)

## One-file example

```ts
// schema.ts
import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date(),
});
```

```bash
schemabridge convert zod schema.ts \
  --export userSchema \
  --to pydantic \
  --out user.py
```

Generates a `UserSchema` Pydantic model in `user.py`.

## Folder example

```bash
schemabridge convert folder ./src/schemas \
  --out ./generated \
  --to pydantic \
  --init
```

- Scans `./src/schemas` recursively
- Converts all exported Zod schemas
- Mirrors folder structure
- Adds `__init__.py` so you can `from generated.user import UserSchema`
- Use `--flat` to dump everything into a single directory

## Python usage

```bash
pip install schemabridge

schemabridge convert zod schema.ts \
  --export userSchema \
  --to pydantic \
  --out user.py
```

The Python CLI wraps the bundled Node CLI and supports the same commands and flags.

## Features

- ✅ **Zod → Pydantic v2** – Generate Python models with full type support
- ✅ **Zod → TypeScript** – Generate `.d.ts` type definitions
- ✅ **Folder conversion** – Convert entire directories recursively
- ✅ **Multiple schemas per file** – Automatically detects all exported schemas
- ✅ **Dependency handling** – Resolves imports; exported schemas get their own files, referenced schemas are inlined into parents
- ✅ **Python package ready** – Optional `--init` to build Python packages
- ✅ **Flexible output** – Preserve structure or flatten to a single directory

## Limitations (v1)

- `z.enum()` values are not emitted as standalone Pydantic enums
- Only **exported** schemas get their own files; referenced schemas are inlined
- Circular schema dependencies are not supported
- TypeScript path aliases require running from a directory where `tsconfig.json` can be discovered

## Contributing

Contributions are welcome! Here's how you can help:

- **Report bugs** - [Open an issue](https://github.com/iamtemi/schemabridge/issues/new) with a minimal reproduction
- **Request features** - Share your ideas in [discussions](https://github.com/iamtemi/schemabridge/discussions) or issues
- **Submit PRs** - Fix bugs, improve docs, or add features
- **Spread the word** - Star the repo, share on social media

## License

MIT (see [`LICENSE`](LICENSE))

## Links

- [GitHub](https://github.com/iamtemi/schemabridge)
- [Issues](https://github.com/iamtemi/schemabridge/issues)
- [Discussions](https://github.com/iamtemi/schemabridge/discussions)
