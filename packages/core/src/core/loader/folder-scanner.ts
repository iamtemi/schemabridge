/**
 * Folder Scanner
 *
 * Scans a folder for TypeScript/JavaScript files and extracts all exported Zod schemas.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ZodType } from 'zod';
import { ensureTsLoader, looksLikeZodSchema } from './shared.js';

export interface SchemaExport {
  /** File path (absolute) */
  file: string;
  /** Export name */
  exportName: string;
  /** Schema instance */
  schema: ZodType;
}

export interface ScanFolderOptions {
  /** Source directory to scan */
  sourceDir: string;
  /** File extensions to include (default: ['.ts', '.tsx', '.js', '.mjs']) */
  extensions?: string[];
  /** Files/directories to ignore (default: ['node_modules', '.git', 'dist', 'build']) */
  ignore?: string[];
  /** Whether to register tsx loader for TypeScript execution */
  registerTsLoader?: boolean;
  /** Optional path to tsconfig.json */
  tsconfigPath?: string;
  /** Whether to allow unresolved imports */
  allowUnresolved?: boolean;
  /** Dynamic module loading is unsafe for untrusted inputs; callers must opt-in. */
  trustedInput?: boolean;
  /**
   * Optional export name pattern (simple wildcard) to filter which exports are treated as schemas.
   * Example: "*Schema" → only exports whose names end with "Schema".
   */
  exportNamePattern?: string;
}

export interface ScanResult {
  schemas: SchemaExport[];
  warnings: string[];
  skippedFiles: string[];
}

/**
 * Scan a folder for all exported Zod schemas.
 * Returns all schemas found across all files.
 */
export async function scanFolderForSchemas(options: ScanFolderOptions): Promise<ScanResult> {
  const {
    sourceDir,
    extensions = ['.ts', '.tsx', '.js', '.mjs'],
    ignore = ['node_modules', '.git', 'dist', 'build', 'coverage'],
    registerTsLoader = true,
    tsconfigPath,
    allowUnresolved = false,
    trustedInput = false,
    exportNamePattern,
  } = options;

  if (!trustedInput) {
    throw new Error(
      'Refusing to dynamically import untrusted schema files. Set trustedInput: true only for trusted local files.',
    );
  }

  const resolvedDir = path.resolve(sourceDir);
  const schemas: SchemaExport[] = [];
  const warnings: string[] = [];
  const skippedFiles: string[] = [];

  if (registerTsLoader) {
    await ensureTsLoader();
  }

  const exportNameRegex =
    exportNamePattern !== undefined ? wildcardToRegExp(exportNamePattern) : undefined;

  const files = await findSchemaFiles(resolvedDir, extensions, ignore);

  for (const file of files) {
    const outcome = await processSchemaFile(file, {
      allowUnresolved,
      ...(exportNameRegex !== undefined && { exportNameRegex }),
      ...(tsconfigPath !== undefined && { tsconfigPath }),
    });

    switch (outcome.kind) {
      case 'schemas':
        schemas.push(...outcome.schemas);
        break;
      case 'skipped':
        skippedFiles.push(file);
        break;
      case 'warning':
        warnings.push(outcome.message);
        skippedFiles.push(file);
        break;
      case 'error':
        throw outcome.error;
    }
  }

  return { schemas, warnings, skippedFiles };
}

type ProcessSchemaFileOutcome =
  | { kind: 'schemas'; schemas: SchemaExport[] }
  | { kind: 'skipped' }
  | { kind: 'warning'; message: string }
  | { kind: 'error'; error: Error };

async function processSchemaFile(
  file: string,
  options: {
    exportNameRegex?: RegExp;
    tsconfigPath?: string;
    allowUnresolved: boolean;
  },
): Promise<ProcessSchemaFileOutcome> {
  try {
    const fileSchemas = await extractSchemasFromFile(file, {
      allowUnresolved: options.allowUnresolved,
      ...(options.tsconfigPath !== undefined && { tsconfigPath: options.tsconfigPath }),
    });

    const filteredSchemas =
      options.exportNameRegex !== undefined
        ? fileSchemas.filter((schema) => options.exportNameRegex?.test(schema.exportName))
        : fileSchemas;

    if (filteredSchemas.length === 0) {
      return { kind: 'skipped' };
    }

    return { kind: 'schemas', schemas: filteredSchemas };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.allowUnresolved) {
      return { kind: 'warning', message: `Failed to process ${file}: ${message}` };
    }
    return {
      kind: 'error',
      error: err instanceof Error ? err : new Error(message),
    };
  }
}

/**
 * Find all TypeScript/JavaScript files in a directory recursively.
 */
async function findSchemaFiles(
  dir: string,
  extensions: string[],
  ignore: string[],
): Promise<string[]> {
  const files: string[] = [];
  const extSet = new Set(extensions);

  async function walk(currentDir: string): Promise<void> {
    const entries = (await fs.readdir(currentDir, { withFileTypes: true })).sort((a, b) =>
      compareLexicographic(a.name, b.name),
    );

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Preserve existing substring matching behavior for ignore entries.
      if (ignore.some((pattern) => entry.name.includes(pattern))) {
        continue;
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extSet.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}

/**
 * Extract all exported Zod schemas from a single file.
 */
async function extractSchemasFromFile(
  file: string,
  _options: {
    tsconfigPath?: string;
    allowUnresolved?: boolean;
  },
): Promise<SchemaExport[]> {
  const resolvedFile = path.resolve(file);

  // First, try to load the module
  // Propagate import errors so the caller can decide how to handle them
  const mod = (await import(pathToFileURL(resolvedFile).href)) as Record<string, unknown>;

  // Check all exports for Zod schemas
  const schemas: SchemaExport[] = [];
  const exports = Object.entries(mod).sort(([a], [b]) => compareLexicographic(a, b));
  for (const [exportName, value] of exports) {
    if (exportName === 'default') continue;
    if (looksLikeZodSchema(value)) {
      schemas.push({
        file: resolvedFile,
        exportName,
        schema: value,
      });
    }
  }

  return schemas;
}

/**
 * Convert a simple wildcard pattern to a RegExp.
 * Supports "*" as a wildcard for any characters.
 */
function wildcardToRegExp(pattern: string): RegExp {
  const escapedParts = pattern.split('*').map(escapeRegExp);
  return new RegExp(`^${escapedParts.join('.*')}$`);
}

function escapeRegExp(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function compareLexicographic(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
