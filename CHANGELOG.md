# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) once it reaches `1.0.0`.

## [Unreleased]

- Documentation site (VitePress) drafts
- Potential `export-name` filter flag for folder conversion
- More examples and recipes

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
