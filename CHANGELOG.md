# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches `1.0.0`.

## [Unreleased]

- More examples and recipes

## [0.3.2] – 2026-04-16

### Fixed

- **Top-level union alias generation (Pydantic):** root `z.union(...)` and `z.discriminatedUnion(...)` schemas now emit concrete model classes for object variants before generating the type alias, fixing `NameError` in generated Python when `OptionN` classes were referenced but never defined.
- **Python string literal escaping:** `pythonString()` now escapes `\r`, `\n`, `\t`, `\b`, `\f` control characters. Previously, schemas containing these characters generated syntactically invalid Python.
- **Python raw string edge cases:** `pythonRawString()` now falls back to escaped strings when the value ends with `\` or contains newlines (both invalid in Python raw strings).
- **Docs playground security vulnerabilities:** patched `astro` (>=5.18.1) and `@astrojs/node` to resolve high-severity advisories (devalue DoS, h3 SSE injection, svgo billion laughs, rollup path traversal).

### Changed

- **`trustedInput` required for schema loading (breaking for programmatic API users):** `loadZodSchema()` and `scanFolderForSchemas()` now require `trustedInput: true` to proceed, since both use dynamic `import()` which executes module code. The CLI passes this automatically. Library consumers must add `trustedInput: true` to their calls.
- **Function default factories are no longer executed:** the Zod visitor no longer invokes `defaultValue()` functions. For Zod 3 schemas with factory defaults, `defaultValue` will be `undefined` with a warning. Zod 4 pre-evaluates factories, so behavior is unchanged there. This eliminates an arbitrary code execution vector during schema conversion.
- **Removed `zod` from production `dependencies`:** `zod` is now only a `peerDependency`. Previously it was in both, which forced Zod 4 installation even for Zod 3 consumers.
- **Removed `vitepress-plugin-group-icons` from production `dependencies`:** this docs-only VitePress plugin was incorrectly listed as a core dependency, pulling in `vite`, `rollup`, and other heavy build tooling for all npm consumers. Core package now has zero security audit vulnerabilities.
- **Removed `pkill -f vitest` from test script:** the previous test script killed all system-wide vitest processes before running, which could interfere with other projects.

### Security

- **Docs playground (`/api/convert`) hardened:**
  - Added AST-based safe expression validation — user code is now parsed with TypeScript's compiler API and only whitelisted Zod builder expressions are allowed (replaces naive regex-based schema detection)
  - User code is no longer executed directly; the endpoint reconstructs a clean module from validated AST nodes
  - Added in-process rate limiting (30 requests/min per IP) with automatic eviction of expired entries
  - Added production guard (`SCHEMABRIDGE_ENABLE_DOCS_CONVERSION=true` required in production)
  - Added conversion timeout (8s) with `AbortController` cancellation to stop wasted CPU on timed-out requests
  - Added `Content-Length` validation and request body size limits before JSON parsing
  - Added error message sanitization to prevent path disclosure
- **Added `trustedInput` guard on all dynamic import paths** in both `loadZodSchema()` and `scanFolderForSchemas()`.
- **Added security documentation:** `SECURITY.md` now includes operational security notes and a release checklist. `README.md` documents that CLI schema loading executes module code.

### Technical

- Deduplicated `looksLikeZodSchema()` and `ensureTsLoader()` (previously copy-pasted across `loader/index.ts` and `folder-scanner.ts`) into shared `loader/shared.ts` module.
- Removed empty `converters/` directory.
- Updated publish workflow path handling for npm publish steps.

## [0.3.1] – 2025-12-01

### Added

- Better Python package support when using folder conversion with `--init` / `generateInitFiles` (Pydantic targets only):
  - `__init__.py` files created by earlier versions are now populated with imports for every generated model.
  - Parent packages re-export models from child folders so imports feel natural.
  - `__all__` is set for each package so `from generated import ...` and wildcard imports behave as expected.

## [0.3.0] – 2024-11-30

### Added

- **Universal Root Schema Support**: Any Zod schema type can now be converted as a root schema
  - Objects (`z.object()`) → Pydantic models / TypeScript interfaces
  - Enums (`z.enum()`) → Enum classes / union types
  - Unions (`z.union()`) → Type aliases (`type Name = Union[...]`)
  - Primitives (`z.string()`, `z.number()`, `z.ipv4()`, etc.) → Type aliases
  - Arrays (`z.array()`) → Type aliases
  - Previously only objects and enums were supported as root schemas
- **Type Alias Generation**: Non-object schemas now generate type aliases instead of failing
  - Pydantic: Uses Python 3.12+ `type` syntax (e.g., `type Ipv4 = IPv4Address`)
  - TypeScript: Uses `export type` syntax (e.g., `export type Ipv4 = string`)
- **Zod v4 Compatibility Improvements**:
  - Fixed `z.uuid()` detection (now correctly generates `UUID` type in Python)
  - Fixed `z.int()` detection (now correctly generates `int` type)
  - Fixed `z.iso.date()` handling (now generates `date` in Python, `string` in TypeScript)
  - Added support for `z.ipv4()`, `z.ipv6()`, `z.iso.time()`, `z.iso.duration()`
- **Documentation**: Added explicit note that only exported schemas are scanned

### Fixed

- **Zod v4 String Formats**: `z.uuid()`, `z.iso.date()`, `z.iso.datetime()` now correctly detected in Zod v4
- **Zod v4 Number Formats**: `z.int()` now correctly detected in Zod v4
- **Type Generation**: Fixed incorrect type generation for ISO date/datetime formats
  - `z.iso.date()` now correctly maps to Python `date` (Pydantic parses ISO strings) and TypeScript `string`
  - `z.date()` vs `z.iso.date()` are now properly distinguished

### Changed

- **Root Schema Validation**: Removed restriction that only objects and enums could be root schemas
- **Error Messages**: Improved error handling for non-object schemas (now generates type aliases instead of errors)
- **Documentation**: Updated CLI docs with examples of all supported root schema types

### Technical

- Added `emitPydanticTypeAlias()` and `emitTypeScriptTypeAlias()` functions
- Updated AST visitor to handle Zod v4 direct `check` property (not just `checks` array)
- Added new `isodate` AST node type to distinguish `z.iso.date()` from `z.date()`
- Added comprehensive tests for type alias generation (9 new test cases)
- Updated test snapshots to reflect bug fixes and new features

## [0.2.0] – 2024-11-30

### Added

- **Python Enum Class Support**: Standalone enum exports and enum fields now generate Python Enum classes by default
  - `class StatusEnum(str, Enum):` with enum members
  - Enum value deduplication: same enum values reuse the same enum class
  - CLI flags: `--enum-style` (enum/literal) and `--enum-base-type` (str/int)
  - Programmatic API: `enumStyle` and `enumBaseType` options
  - Backward compatible: use `enumStyle: 'literal'` for old Literal type behavior
- **TypeScript Enum Support**: Standalone enum exports generate union types (`export type EnumName = "val1" | "val2" | ...`)
- **Bundled CLI Tests**: New test suite ensures the bundled CLI works correctly
- **Package Size Documentation**: Added `docs/package-size.md` explaining optimization decisions

### Changed

- **Package Size**: Reduced from 3.78 MB to 147 KB (96% reduction)
  - Disabled source maps in production build (`tsconfig.build.json`)
  - Added `.npmignore` to exclude unnecessary files
  - No functional impact on users
- **Enum Field Handling**: Enum fields in objects now generate enum classes instead of Literal types (default behavior)
- **Documentation**: Updated API and CLI docs with enum options and examples
- **Limitations**: Removed outdated enum limitation (enums are now fully supported)

### Fixed

- **Standalone Enum Conversion**: Previously failed with "Root schema must be a Zod object" error, now works correctly
- **Bundled CLI**: Fixed TypeScript bundling issue that caused "Dynamic require of 'fs'" errors

### Technical

- Added enum class generation logic in `pydantic.ts` emitter
- Added enum tracking and deduplication in emit context
- Updated conversion functions to handle enum root nodes
- Added comprehensive enum tests (14 new test cases)
- Updated test snapshots to reflect enum class output

## [0.1.0] – Initial Preview

### Added

- Zod → Pydantic v2 conversion:
  - Nested classes
  - Constrained types (`constr`, `confloat`, `conint`)
  - Defaults (`Field(default=...)`, `Field(default_factory=...)`)
  - Optional / nullable / union / discriminated union support
- Zod → TypeScript `.d.ts` emitter with nested interfaces and export name overrides
- Zod AST visitor with Zod 3/4 compatibility and warning system for unsupported effects
- File loader:
  - Dynamic import of TS/JS modules
  - Recursive import resolution with `tsconfig.json` path mapping support
  - `--allow-unresolved` flag for lenient handling of unresolved imports
- CLI:
  - `convert zod` for single schemas
  - `convert folder` for batch conversion
  - `--to`, `--out`, `--flat`, `--init`, `--allow-unresolved`, `--tsconfig` flags
- Folder conversion:
  - Multiple schemas per file
  - Re‑export handling (`index.ts`)
  - Per‑directory collision handling for file names
  - Optional `__init__.py` generation for Python packages
- Python wrapper:
  - `schemabridge` CLI that calls the bundled Node.js CLI
