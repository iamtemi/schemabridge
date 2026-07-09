/**
 * SchemaBridge: Cross-language schema converter
 *
 * Main entry point for programmatic API usage.
 */

import path from 'node:path';
import type { ZodType } from 'zod';
import {
  convertZodToPydantic,
  convertZodToTypescript,
  type SchemaConversionOptions,
  type Target,
} from './core/loader/convert.js';
import { writeGeneratedFileIfChanged, type GeneratedWriteAction } from './core/generated-files.js';

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

export {
  convertZodToPydantic,
  convertZodToTypescript,
  type SchemaConversionOptions,
  type Target,
} from './core/loader/convert.js';

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
  /** Absolute or resolved output path. */
  path: string;
  /** Target type for this file ("pydantic" or "typescript"). */
  target: Target;
  /** Whether this run wrote the file or found it already current. */
  action?: GeneratedWriteAction;
}

/**
 * High-level helper that mirrors the CLI behavior and writes files to disk.
 * - Accepts a target and `out` path that follow the same rules as the CLI.
 * - Returns metadata about the files that were written or already current.
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
  } else if (!resolvedOut) {
    outputs.push({ target, path: path.join(process.cwd(), `${baseName}${defaultExt(target)}`) });
  } else if (path.extname(resolvedOut)) {
    outputs.push({ target, path: resolvedOut });
  } else {
    outputs.push({ target, path: `${resolvedOut}${defaultExt(target)}` });
  }

  const writes = outputs.map(async (outSpec) => {
    const content =
      outSpec.target === 'pydantic'
        ? convertZodToPydantic(schema, rest)
        : convertZodToTypescript(schema, rest);

    const action = await writeGeneratedFileIfChanged(outSpec.path, content, outSpec.target);
    return { path: outSpec.path, target: outSpec.target, action };
  });

  return Promise.all(writes);
}
