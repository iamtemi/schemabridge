import { pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import ts from 'typescript';
import type { ZodType } from 'zod';

export interface LoadZodSchemaOptions {
  /** Absolute or relative path to the TypeScript/JavaScript module containing the schema. */
  file: string;
  /** Named export to load from the module. */
  exportName: string;
  /** Attempt to register tsx loader to support TS/ESM imports (tsconfig paths, etc.). */
  registerTsLoader?: boolean;
  /** Optional path to tsconfig.json to inform path resolution. */
  tsconfigPath?: string;
  /** If true, unresolved imports are tolerated and produce warnings. */
  allowUnresolved?: boolean;
}

export class SchemaLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchemaLoadError';
  }
}

export interface LoadedSchema {
  schema: ZodType;
  warnings: string[];
  dependencies: string[];
}

/**
 * Dynamically load a Zod schema from a TS/JS module.
 * - Uses Node's native module resolution (via dynamic import) with the current process CWD.
 * - Validates that the exported value looks like a Zod schema.
 * - Optionally walks imports to validate dependencies and collect warnings.
 */
export async function loadZodSchema(options: LoadZodSchemaOptions): Promise<LoadedSchema> {
  const resolvedPath = path.resolve(options.file);

  if (options.registerTsLoader) {
    await ensureTsLoader();
  }

  const { warnings, dependencies } = await buildDependencyGraph(resolvedPath, {
    ...(options.tsconfigPath !== undefined && { tsconfigPath: options.tsconfigPath }),
    ...(options.allowUnresolved !== undefined && { allowUnresolved: options.allowUnresolved }),
  });

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

  return { schema, warnings, dependencies };
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
    throw new SchemaLoadError(
      `Failed to register TypeScript loader (tsx). Install "tsx" as a dependency or precompile schemas. ${message}`,
    );
  });
  await tsLoaderPromise;
}

function looksLikeZodSchema(value: unknown): value is ZodType {
  if (!value || typeof value !== 'object') return false;
  return (
    '_def' in (value as Record<string, unknown>) || '_zod' in (value as Record<string, unknown>)
  );
}

interface GraphOptions {
  tsconfigPath?: string;
  allowUnresolved?: boolean;
}

export async function buildDependencyGraph(
  entry: string,
  options: GraphOptions,
): Promise<{ warnings: string[]; dependencies: string[] }> {
  const visited = new Set<string>();
  const warnings: string[] = [];
  const queue = [path.resolve(entry)];

  const tsconfig = options.tsconfigPath ? await readTsconfig(options.tsconfigPath) : undefined;

  while (queue.length) {
    const file = queue.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);

    let source: string;
    try {
      source = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    const dir = path.dirname(file);
    const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const imports = sf.statements.filter(ts.isImportDeclaration);
    for (const imp of imports) {
      if (!imp.moduleSpecifier || !ts.isStringLiteral(imp.moduleSpecifier)) continue;
      const spec = imp.moduleSpecifier.text;

      const resolved = await resolveModuleSpecifier(spec, dir, tsconfig);
      if (resolved === null) {
        // External or built-in; skip
        continue;
      }
      if (!resolved) {
        if (options.allowUnresolved) {
          warnings.push(`Unresolved import "${spec}" from ${file}`);
          continue;
        }
        throw new SchemaLoadError(`Failed to resolve import "${spec}" from ${file}`);
      }
      queue.push(resolved);
    }
  }

  return { warnings, dependencies: Array.from(visited) };
}

async function readTsconfig(tsconfigPath: string): Promise<ts.ParsedCommandLine | undefined> {
  try {
    const configText = await fs.readFile(tsconfigPath, 'utf8');
    const result = ts.parseConfigFileTextToJson(tsconfigPath, configText);
    if (result.error) return undefined;
    return ts.parseJsonConfigFileContent(result.config, ts.sys, path.dirname(tsconfigPath));
  } catch {
    return undefined;
  }
}

async function resolveModuleSpecifier(
  spec: string,
  containingDir: string,
  tsconfig?: ts.ParsedCommandLine,
): Promise<string | null | undefined> {
  // Relative import
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const candidate = await resolveWithExtensions(path.resolve(containingDir, spec));
    return candidate;
  }

  // Try tsconfig paths
  if (tsconfig?.options.paths && tsconfig.options.baseUrl) {
    const mapped = resolveWithPaths(spec, tsconfig.options.baseUrl, tsconfig.options.paths);
    if (mapped) {
      const candidate = await resolveWithExtensions(mapped);
      if (candidate) return candidate;
    }
  }

  // External module: return null to indicate skip
  return null;
}

function resolveWithPaths(
  spec: string,
  baseUrl: string,
  paths: Record<string, readonly string[]>,
): string | null {
  for (const [pattern, replacements] of Object.entries(paths)) {
    const starIndex = pattern.indexOf('*');
    if (starIndex === -1) {
      if (pattern === spec && replacements.length > 0) {
        const replacement = replacements[0];
        if (replacement) {
          return path.resolve(baseUrl, replacement);
        }
      }
      continue;
    }
    const prefix = pattern.slice(0, starIndex);
    const suffix = pattern.slice(starIndex + 1);
    if (spec.startsWith(prefix) && spec.endsWith(suffix) && replacements.length > 0) {
      const replacement = replacements[0];
      if (replacement) {
        const matched = spec.slice(prefix.length, spec.length - suffix.length);
        const replaced = replacement.replace('*', matched);
        return path.resolve(baseUrl, replaced);
      }
    }
  }
  return null;
}

async function resolveWithExtensions(basePath: string): Promise<string | null> {
  const exts = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs'];
  const tryPaths = new Set<string>();

  for (const ext of exts) {
    tryPaths.add(basePath.endsWith(ext) ? basePath : basePath + ext);
  }

  const parsed = path.parse(basePath);
  if (['.js', '.mjs', '.cjs'].includes(parsed.ext)) {
    const withoutExt = path.join(parsed.dir, parsed.name);
    for (const ext of exts) {
      tryPaths.add(withoutExt + ext);
    }
  }

  for (const candidate of tryPaths) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}
