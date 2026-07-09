# Package Size

SchemaBridge keeps the published npm package small by shipping only runtime files.

## Current Measured Size

Measured with `npm pack --dry-run` after building `@schemabridge/core`:

- **Package tarball**: ~36.8 kB compressed
- **Unpacked size**: ~151.6 kB
- **CLI bundle**: ~42.7 kB

## What Ships

- `bin/schemabridge.js` - the minified CLI bundle
- `dist/index.*` - the public API entry point
- `dist/core/**` - runtime modules used by the public API
- `package.json` metadata

## What Does Not Ship

- Source TypeScript files
- Tests, fixtures, coverage, and development config
- Source maps
- Duplicate private build outputs such as `dist/cli` and `dist/utils`

This has no runtime feature impact. Stack traces point at compiled JavaScript instead of source TypeScript.
