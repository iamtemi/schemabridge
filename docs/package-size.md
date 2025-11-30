# Package Size Optimization

SchemaBridge is optimized for minimal package size while maintaining full functionality.

## Current Size

- **Package tarball**: ~37 kB (compressed)
- **Unpacked size**: ~147 kB

## What's Excluded

To keep the package small, we exclude:

- **Source maps** (`.map` files) - Not needed for runtime, only for debugging library internals
- **Test files** - Not needed for production use
- **Development configs** - TypeScript configs, ESLint, etc.
- **Source TypeScript files** - Only compiled JavaScript and type definitions are included

## Impact on Users

**No functional impact** - All features work exactly the same. The only difference is:

- **Stack traces** in errors will point to compiled JavaScript instead of original TypeScript
- **Debugging** the library's internal code is slightly harder (but most users don't need this)

## Development vs Production

- **Development** (`tsconfig.json`): Source maps enabled for contributors
- **Production build** (`tsconfig.build.json`): Source maps disabled for smaller package size

This follows industry best practices (similar to AWS SDK, many other npm packages).

## If You Need Source Maps

If you're contributing to SchemaBridge and need source maps for debugging:

1. Clone the repository
2. Run `pnpm install && pnpm build`
3. Source maps will be generated in `dist/` for local development
