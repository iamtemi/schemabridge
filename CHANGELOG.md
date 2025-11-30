# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches `1.0.0`.

## [Unreleased]

- Documentation site (VitePress) drafts
- Potential `export-name` filter flag for folder conversion
- More examples and recipes

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
