/**
 * SchemaBridge: Cross-language schema converter
 *
 * Main entry point for programmatic API usage.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import type { ZodType } from 'zod';
import {
  emitPydanticModel,
  emitPydanticEnum,
  emitPydanticTypeAlias,
} from './core/emitters/pydantic.js';
import {
  emitTypeScriptDefinitions,
  emitTypeScriptEnum,
  emitTypeScriptTypeAlias,
} from './core/emitters/typescript.js';
import { visitZodSchema } from './core/ast/zod-visitor.js';
export { loadZodSchema, SchemaLoadError } from './core/loader/index.js';
export {
  scanFolderForSchemas,
  type SchemaExport,
  type ScanFolderOptions,
} from './core/loader/folder-scanner.js';
export {
  convertFolder,
  type ConvertFolderOptions,
  type ConvertFolderResult,
} from './core/loader/folder-converter.js';

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

  /**
   * Map of field paths to custom export names for TypeScript interfaces.
   * Keys are dot-separated field paths (e.g., "user.profile").
   * Values are the desired interface/type names.
   * Example: { "user.profile": "UserProfile", "metadata": "CustomMetadata" }
   */
  exportNameOverrides?: Record<string, string>;

  /**
   * Style for enum generation. Default: 'enum'
   * - 'enum': Generate Python Enum classes (e.g., `class StatusEnum(str, Enum)`)
   * - 'literal': Generate Literal types (e.g., `Literal["value1", "value2"]`)
   */
  enumStyle?: 'enum' | 'literal';

  /**
   * Base type for enum classes. Default: 'str'
   * - 'str': Generate `class EnumName(str, Enum)`
   * - 'int': Generate `class EnumName(int, Enum)`
   */
  enumBaseType?: 'str' | 'int';
}

/**
 * Convert a Zod schema instance to Pydantic v2 code as a string.
 * - Pure function: no filesystem or process I/O.
 * - Does not write files or log to stdout.
 */
export function convertZodToPydantic(schema: ZodType, options: SchemaConversionOptions): string {
  const { node, warnings } = visitZodSchema(schema);

  const emitOptions: {
    name: string;
    sourceModule?: string;
    warnings?: typeof warnings;
    enumStyle?: 'enum' | 'literal';
    enumBaseType?: 'str' | 'int';
  } = {
    name: options.name,
    warnings,
  };

  if (options.sourceModule !== undefined) {
    emitOptions.sourceModule = options.sourceModule;
  }
  if (options.enumStyle !== undefined) {
    emitOptions.enumStyle = options.enumStyle;
  }
  if (options.enumBaseType !== undefined) {
    emitOptions.enumBaseType = options.enumBaseType;
  }

  if (node.type === 'enum') {
    return emitPydanticEnum(node, emitOptions);
  }

  if (node.type === 'object') {
    return emitPydanticModel(node, emitOptions);
  }

  // Support type aliases for non-object schemas (e.g., z.ipv4(), z.union(), etc.)
  return emitPydanticTypeAlias(node, emitOptions);
}

/**
 * Convert a Zod schema instance to a TypeScript `.d.ts` definition string.
 * - Pure function: no filesystem or process I/O.
 * - Does not write files or log to stdout.
 */
export function convertZodToTypescript(schema: ZodType, options: SchemaConversionOptions): string {
  const { node, warnings } = visitZodSchema(schema);

  const emitOptions: {
    name: string;
    sourceModule?: string;
    warnings?: typeof warnings;
    exportNameOverrides?: Record<string, string>;
  } = {
    name: options.name,
    warnings,
  };
  if (options.sourceModule !== undefined) {
    emitOptions.sourceModule = options.sourceModule;
  }
  if (options.exportNameOverrides !== undefined) {
    emitOptions.exportNameOverrides = options.exportNameOverrides;
  }

  if (node.type === 'enum') {
    return emitTypeScriptEnum(node, emitOptions);
  }

  if (node.type === 'object') {
    return emitTypeScriptDefinitions(node, emitOptions);
  }

  // Support type aliases for non-object schemas (e.g., z.ipv4(), z.union(), etc.)
  return emitTypeScriptTypeAlias(node, emitOptions);
}

export interface GenerateFilesFromZodOptions extends SchemaConversionOptions {
  schema: ZodType;
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
export function generateFilesFromZod(
  options: GenerateFilesFromZodOptions,
): Promise<GeneratedFile[]> {
  const { schema, target, out, ...rest } = options;
  const outputs: Array<{ target: Target; path: string }> = [];
  const baseName = rest.name;

  const resolvedOut = out ? path.resolve(out) : undefined;
  const defaultExt = (t: Target) => (t === 'pydantic' ? '.py' : '.d.ts');

  if (target === 'all') {
    if (resolvedOut && path.extname(resolvedOut)) {
      return Promise.reject(
        new Error(
          'When target is "all", --out must be a directory or omitted. Received a file path with extension.',
        ),
      );
    }
    const outDir = resolvedOut ?? process.cwd();
    outputs.push(
      { target: 'pydantic', path: path.join(outDir, `${baseName}${defaultExt('pydantic')}`) },
      { target: 'typescript', path: path.join(outDir, `${baseName}${defaultExt('typescript')}`) },
    );
  } else {
    if (!resolvedOut) {
      outputs.push({ target, path: path.join(process.cwd(), `${baseName}${defaultExt(target)}`) });
    } else if (path.extname(resolvedOut)) {
      outputs.push({ target, path: resolvedOut });
    } else {
      outputs.push({ target, path: `${resolvedOut}${defaultExt(target)}` });
    }
  }

  const writes = outputs.map(async (outSpec) => {
    const content =
      outSpec.target === 'pydantic'
        ? convertZodToPydantic(schema, rest)
        : convertZodToTypescript(schema, rest);

    await fs.mkdir(path.dirname(outSpec.path), { recursive: true });
    await fs.writeFile(outSpec.path, content, 'utf8');
    return { path: outSpec.path, target: outSpec.target };
  });

  return Promise.all(writes);
}
