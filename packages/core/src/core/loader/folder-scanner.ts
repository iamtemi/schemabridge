/**
 * Folder Scanner
 *
 * Scans a folder for TypeScript/JavaScript files and extracts all exported Zod schemas.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ZodType } from 'zod';

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
    exportNamePattern,
  } = options;

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
  const visited = new Set<string>();

  for (const file of files) {
    if (visited.has(file)) continue;
    visited.add(file);

    try {
      const extractOptions: {
        registerTsLoader?: boolean;
        tsconfigPath?: string;
        allowUnresolved?: boolean;
      } = {
        registerTsLoader: false, // Already registered
        allowUnresolved,
      };
      if (tsconfigPath !== undefined) {
        extractOptions.tsconfigPath = tsconfigPath;
      }
      const fileSchemas = await extractSchemasFromFile(file, extractOptions);

      const filteredSchemas =
        exportNameRegex !== undefined
          ? fileSchemas.filter((schema) => exportNameRegex.test(schema.exportName))
          : fileSchemas;

      if (filteredSchemas.length === 0) {
        skippedFiles.push(file);
        continue;
      }

      schemas.push(...filteredSchemas);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (allowUnresolved) {
        // Lenient mode: warn and continue
        warnings.push(`Failed to process ${file}: ${message}`);
        skippedFiles.push(file);
        continue;
      }
      // Strict mode: surface the error to the caller
      throw err instanceof Error ? err : new Error(message);
    }
  }

  return { schemas, warnings, skippedFiles };
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
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip ignored directories/files
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
    registerTsLoader?: boolean;
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
  for (const [exportName, value] of Object.entries(mod)) {
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

function looksLikeZodSchema(value: unknown): value is ZodType {
  if (!value || typeof value !== 'object') return false;
  return (
    '_def' in (value as Record<string, unknown>) || '_zod' in (value as Record<string, unknown>)
  );
}

let tsLoaderPromise: Promise<unknown> | null = null;
async function ensureTsLoader(): Promise<void> {
  if (tsLoaderPromise) {
    await tsLoaderPromise;
    return;
  }
  tsLoaderPromise = import('tsx/esm').catch((err) => {
    tsLoaderPromise = null;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to register TypeScript loader (tsx). Install "tsx" as a dependency. ${message}`,
    );
  });
  await tsLoaderPromise;
}

/**
 * Convert a simple wildcard pattern to a RegExp.
 * Supports "*" as a wildcard for any characters.
 */
function wildcardToRegExp(pattern: string): RegExp {
  // Escape regex special characters, then replace '*' with '.*'
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`);
}
