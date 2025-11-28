/**
 * SchemaBridge: Cross-language schema converter
 *
 * Main entry point for programmatic API usage.
 */

import type { ZodTypeAny } from 'zod';

export type Target = 'pydantic' | 'typescript';

export interface SchemaConversionOptions {
  /**
   * Name of the root model / interface to generate.
   * Example: "EnrichedTransactionSchema"
   */
  name: string;

  /**
   * Optional fully-qualified module path to use in comments or references.
   * Not required for v1 behavior to be correct.
   */
  sourceModule?: string;

  /**
   * If true, when a referenced schema cannot be resolved, generate `Any` type with a warning
   * instead of throwing an error. Default: false (strict mode).
   *
   * Note: This option is only relevant when using file loading utilities that resolve imports.
   * The pure conversion functions (`convertZodToPydantic`, `convertZodToTypescript`) receive
   * pre-loaded schema instances and don't perform import resolution themselves.
   */
  allowUnresolved?: boolean;
}

/**
 * Convert a Zod schema instance to Pydantic v2 code as a string.
 * - Pure function: no filesystem or process I/O.
 * - Does not write files or log to stdout.
 */
export function convertZodToPydantic(_schema: ZodTypeAny, _options: SchemaConversionOptions): string {
  // TODO: Implementation placeholder
  throw new Error('Not implemented yet');
}

/**
 * Convert a Zod schema instance to a TypeScript `.d.ts` definition string.
 * - Pure function: no filesystem or process I/O.
 * - Does not write files or log to stdout.
 */
export function convertZodToTypescript(
  _schema: ZodTypeAny,
  _options: SchemaConversionOptions,
): string {
  // TODO: Implementation placeholder
  throw new Error('Not implemented yet');
}

export interface GenerateFilesFromZodOptions extends SchemaConversionOptions {
  schema: ZodTypeAny;
  /**
   * Target language(s) to generate.
   * - "pydantic" → one `.py` file
   * - "typescript" → one `.d.ts` file
   * - "all" → both `.py` and `.d.ts`
   */
  target: Target | 'all';
  /**
   * Output path. Semantics are identical to the CLI `--out` flag:
   * - Single target:
   *   - If `out` has an extension → write exactly to that path.
   *   - If `out` has no extension → append default extension (`.py` or `.d.ts`).
   * - `target: "all"`:
   *   - If omitted → write `<name>.py` and `<name>.d.ts` in CWD.
   *   - If a directory → write `<out>/<name>.py` and `<out>/<name>.d.ts`.
   *   - If looks like a file path with extension → throw a clear error.
   */
  out?: string;
}

export interface GeneratedFile {
  /** Absolute or resolved path written to disk. */
  path: string;
  /** Target type for this file ("pydantic" or "typescript"). */
  target: Target;
}

/**
 * High-level helper that mirrors the CLI behavior and writes files to disk.
 * - Accepts a target and `out` path that follow the same rules as the CLI.
 * - Returns metadata about the files that were written.
 */
export async function generateFilesFromZod(
  _options: GenerateFilesFromZodOptions,
): Promise<GeneratedFile[]> {
  // TODO: Implementation placeholder
  throw new Error('Not implemented yet');
}
