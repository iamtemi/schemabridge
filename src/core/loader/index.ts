import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { ZodType } from 'zod';

export interface LoadZodSchemaOptions {
  /** Absolute or relative path to the TypeScript/JavaScript module containing the schema. */
  file: string;
  /** Named export to load from the module. */
  exportName: string;
  /** Attempt to register tsx loader to support TS/ESM imports (tsconfig paths, etc.). */
  registerTsLoader?: boolean;
}

export class SchemaLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaLoadError';
  }
}

/**
 * Dynamically load a Zod schema from a TS/JS module.
 * - Uses Node's native module resolution (via dynamic import) with the current process CWD.
 * - Validates that the exported value looks like a Zod schema.
 */
export async function loadZodSchema(options: LoadZodSchemaOptions): Promise<ZodType> {
  const resolvedPath = path.resolve(options.file);

  if (options.registerTsLoader) {
    await ensureTsLoader();
  }

  let mod: Record<string, unknown>;

  try {
    mod = (await import(pathToFileURL(resolvedPath).href)) as Record<string, unknown>;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SchemaLoadError(`Failed to import schema module "${resolvedPath}": ${message}`);
  }

  if (!(options.exportName in mod)) {
    const available = Object.keys(mod).filter((k) => k !== 'default');
    throw new SchemaLoadError(
      `Export "${options.exportName}" not found in "${resolvedPath}". Available exports: ${available.join(', ') || '(none)'}`,
    );
  }

  const schema: unknown = mod[options.exportName];

  if (!looksLikeZodSchema(schema)) {
    throw new SchemaLoadError(
      `Export "${options.exportName}" in "${resolvedPath}" is not a Zod schema.`,
    );
  }

  return schema as unknown as ZodType;
}

let tsLoaderPromise: Promise<unknown> | null = null;
async function ensureTsLoader(): Promise<void> {
  if (tsLoaderPromise) {
    await tsLoaderPromise;
    return;
  }
  tsLoaderPromise = import('tsx/esm').catch(() => {
    tsLoaderPromise = null;
    // Swallow error; loader might not be available in production builds.
  });
  await tsLoaderPromise;
}

function looksLikeZodSchema(value: unknown): value is ZodType {
  if (!value || typeof value !== 'object') return false;
  return (
    '_def' in (value as Record<string, unknown>) || '_zod' in (value as Record<string, unknown>)
  );
}
