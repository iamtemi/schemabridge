import type { APIRoute } from 'astro';
import { convertZodToPydantic, convertZodToTypescript, loadZodSchema } from '@schemabridge/core';
import ts from 'typescript';
import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const MAX_CODE_SIZE = 100 * 1024; // 100KB
const MAX_SCHEMAS = 10;
const CONVERSION_TIMEOUT_MS = 8_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const PRODUCTION_GUARD_ENV = 'SCHEMABRIDGE_ENABLE_DOCS_CONVERSION';
const rateLimitStore = new Map<string, { count: number; expiresAt: number }>();

export const prerender = false;

function sanitizeErrorMessage(message: string | undefined): string {
  if (!message) return 'Unknown error';
  return message
    .replace(/\/var\/folders\/[^\s]+/g, '[temp]')
    .replace(/\/private\/var\/folders\/[^\s]+/g, '[temp]')
    .replace(/\/tmp\/[^\s]+/g, '[temp]')
    .replace(/\/Users\/[^\s]+/g, '[path]')
    .replace(/[A-Za-z]:\\[^\s]+/g, '[path]')
    .replace(/file:\/\/[^\s]+/g, '[file]');
}

function findNonExportedSchemas(code: string, exported: Set<string>): string[] {
  const matches = Array.from(code.matchAll(/const\s+(\w+)\s*=\s*z\./g));
  return matches.map((match) => match[1]).filter((name) => !exported.has(name));
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();

  // Evict expired entries to prevent unbounded growth
  if (rateLimitStore.size > 1000) {
    for (const [key, entry] of rateLimitStore) {
      if (now >= entry.expiresAt) rateLimitStore.delete(key);
    }
  }

  const existing = rateLimitStore.get(ip);
  if (!existing || now >= existing.expiresAt) {
    rateLimitStore.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  existing.count += 1;
  rateLimitStore.set(ip, existing);
  return existing.count > RATE_LIMIT_MAX_REQUESTS;
}

function isConversionEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env[PRODUCTION_GUARD_ENV] === 'true';
}

function isAllowedSafeExpression(node: ts.Node): boolean {
  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  ) {
    return true;
  }

  if (ts.isIdentifier(node)) {
    return node.text === 'z';
  }

  if (ts.isPrefixUnaryExpression(node)) {
    return (
      (node.operator === ts.SyntaxKind.MinusToken || node.operator === ts.SyntaxKind.PlusToken) &&
      ts.isNumericLiteral(node.operand)
    );
  }

  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.every((el) => isAllowedSafeExpression(el));
  }

  if (ts.isObjectLiteralExpression(node)) {
    return node.properties.every((prop) => {
      if (!ts.isPropertyAssignment(prop)) return false;
      if (
        !ts.isIdentifier(prop.name) &&
        !ts.isStringLiteral(prop.name) &&
        !ts.isNumericLiteral(prop.name)
      ) {
        return false;
      }
      return isAllowedSafeExpression(prop.initializer);
    });
  }

  if (ts.isPropertyAccessExpression(node)) {
    return isAllowedSafeExpression(node.expression);
  }

  if (ts.isCallExpression(node)) {
    if (!isAllowedSafeExpression(node.expression)) return false;
    return node.arguments.every((arg) => isAllowedSafeExpression(arg));
  }

  return false;
}

function extractSafeExportedSchemas(code: string): {
  names: string[];
  duplicates: string[];
  safeModuleBody: string;
} {
  const source = ts.createSourceFile('schema.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const names: string[] = [];
  const duplicateSet = new Set<string>();
  const seen = new Set<string>();
  const lines: string[] = [];

  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const hasExport = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!hasExport) continue;
    if ((statement.declarationList.flags & ts.NodeFlags.Const) === 0) continue;

    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const name = declaration.name.text;
      if (seen.has(name)) {
        duplicateSet.add(name);
        continue;
      }
      if (!isAllowedSafeExpression(declaration.initializer)) {
        throw new Error(
          `Unsupported schema expression for export "${name}". Only direct zod builder expressions are allowed in playground mode.`,
        );
      }
      seen.add(name);
      names.push(name);
      lines.push(`export const ${name} = ${declaration.initializer.getText(source)};`);
    }
  }

  return { names, duplicates: Array.from(duplicateSet), safeModuleBody: lines.join('\n') };
}

function extractImportsAndBody(
  output: string,
  isPython: boolean,
): { imports: string[]; body: string } {
  const lines = output.split('\n');
  const imports: string[] = [];
  const bodyLines: string[] = [];
  let inImports = true;

  for (const line of lines) {
    const trimmed = line.trim();
    const isImport = isPython
      ? trimmed.startsWith('from ') || trimmed.startsWith('import ')
      : trimmed.startsWith('import ');

    if (inImports && isImport) {
      imports.push(line);
    } else {
      inImports = false;
      bodyLines.push(line);
    }
  }

  const body = bodyLines.join('\n').replace(/\n+$/, '');
  return { imports, body };
}

function extractEnums(
  body: string,
  isPython: boolean,
): { enums: string[]; bodyWithoutEnums: string } {
  const lines = body.split('\n');
  const enums: string[] = [];
  const remaining: string[] = [];
  let currentEnum: string[] | null = null;
  let enumIndent = 0;

  const enumStartPattern = isPython ? /^class\s+\w+Enum\(str,\s*Enum\):/ : /^enum\s+\w+\s*\{/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const indent = line.length - line.trimStart().length;

    if (trimmed.match(enumStartPattern)) {
      if (currentEnum) {
        enums.push(currentEnum.join('\n'));
      }
      currentEnum = [line];
      enumIndent = indent;
      continue;
    }

    if (currentEnum) {
      if (isPython) {
        const enumEnded = trimmed && indent <= enumIndent && !trimmed.match(/^\w+\s*=\s*["'`]/);
        if (enumEnded) {
          enums.push(currentEnum.join('\n'));
          currentEnum = null;
          i--; // reprocess this line in the outer loop
          continue;
        }
        currentEnum.push(line);
        continue;
      } else {
        currentEnum.push(line);
        if (trimmed === '}') {
          enums.push(currentEnum.join('\n'));
          currentEnum = null;
        }
        continue;
      }
    }

    remaining.push(line);
  }

  if (currentEnum) {
    enums.push(currentEnum.join('\n'));
  }

  return { enums, bodyWithoutEnums: remaining.join('\n') };
}

function deduplicateImports(importGroups: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const imports of importGroups) {
    for (const line of imports) {
      const trimmed = line.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        merged.push(line);
      }
    }
  }
  return merged;
}

function findNodeModules(): string {
  let currentDir = dirname(fileURLToPath(import.meta.url));
  while (true) {
    const candidate = join(currentDir, 'node_modules');
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(currentDir);
    if (parent === currentDir) {
      break;
    }
    currentDir = parent;
  }
  throw new Error('Could not find node_modules directory');
}

export const POST: APIRoute = async ({ request }) => {
  if (!isConversionEnabled()) {
    return new Response(
      JSON.stringify({
        error:
          'Schema conversion API is disabled in production. Set SCHEMABRIDGE_ENABLE_DOCS_CONVERSION=true to enable.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const ip = getClientIp(request);
  if (isRateLimited(ip)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again shortly.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const contentLength = request.headers.get('content-length');
  if (!contentLength) {
    return new Response(JSON.stringify({ error: 'Content-Length header is required.' }), {
      status: 411,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const contentLengthValue = Number(contentLength);
  if (!Number.isFinite(contentLengthValue) || contentLengthValue <= 0) {
    return new Response(JSON.stringify({ error: 'Invalid Content-Length header.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (contentLengthValue > MAX_CODE_SIZE * 2) {
    return new Response(
      JSON.stringify({
        error: `Request body too large. Maximum ${MAX_CODE_SIZE * 2} bytes allowed.`,
      }),
      {
        status: 413,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  const tempDir = join(
    tmpdir(),
    `schemabridge-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const tempFile = join(tempDir, 'safe-schema.ts');

  try {
    let body: any;
    try {
      body = await request.json();
    } catch (error: any) {
      return new Response(
        JSON.stringify({
          error: `Invalid JSON body: ${sanitizeErrorMessage(error?.message)}`,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    const { schemaCode, targetLanguage, zodVersion } = body ?? {};

    if (typeof schemaCode !== 'string' || schemaCode.trim().length === 0) {
      return new Response(
        JSON.stringify({
          error: 'schemaCode must be a non-empty string.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (typeof schemaCode !== 'string' || Buffer.byteLength(schemaCode, 'utf-8') > MAX_CODE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `Schema code too large. Maximum ${MAX_CODE_SIZE} bytes allowed.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!['pydantic', 'typescript'].includes(targetLanguage)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid targetLanguage. Supported values: "pydantic", "typescript".',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!['3', '4'].includes(zodVersion)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid zodVersion. Supported values: "3", "4".',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const {
      names: exportNames,
      duplicates,
      safeModuleBody,
    } = extractSafeExportedSchemas(schemaCode);
    if (exportNames.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            'No exported Zod schemas found. Export schemas with: export const mySchema = z.object(...).',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (exportNames.length > MAX_SCHEMAS) {
      return new Response(
        JSON.stringify({
          error: `Too many schema exports. Maximum ${MAX_SCHEMAS} allowed, found ${exportNames.length}.`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (duplicates.length > 0) {
      return new Response(
        JSON.stringify({
          error: `Duplicate schema export names detected: ${duplicates.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const nonExported = findNonExportedSchemas(schemaCode, new Set(exportNames));
    const isPython = targetLanguage === 'pydantic';

    await mkdir(tempDir, { recursive: true });
    const tempNodeModules = join(tempDir, 'node_modules');
    await mkdir(tempNodeModules, { recursive: true });

    const nodeModulesRoot = findNodeModules();
    const zodPackageName = `zod-v${zodVersion}`;
    const zodSourcePath = join(nodeModulesRoot, zodPackageName);
    const zodLinkPath = join(tempNodeModules, zodPackageName);

    if (!existsSync(zodSourcePath)) {
      return new Response(
        JSON.stringify({
          error: `Zod v${zodVersion} is not available on the server.`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (!existsSync(zodLinkPath)) {
      await symlink(zodSourcePath, zodLinkPath, 'dir');
    }

    const codeWithVersion = [`import { z } from '${zodPackageName}';`, safeModuleBody].join('\n');

    await writeFile(tempFile, codeWithVersion, 'utf-8');

    const allImports: string[][] = [];
    const allEnums: string[] = [];
    const bodyOutputs: string[] = [];
    const processedSchemas = new Set<string>();
    const seenErrors = new Set<string>();

    const abortController = new AbortController();
    const { signal } = abortController;

    const conversionWork = async () => {
      for (const exportName of exportNames) {
        if (signal.aborted) break;
        if (processedSchemas.has(exportName)) continue;
        processedSchemas.add(exportName);
        try {
          const { schema } = await loadZodSchema({
            file: tempFile,
            exportName,
            registerTsLoader: true,
            allowUnresolved: false,
            trustedInput: true,
          });

          if (signal.aborted) break;

          const output = isPython
            ? convertZodToPydantic(schema, {
                name: exportName,
                enumStyle: 'enum',
                enumBaseType: 'str',
              })
            : convertZodToTypescript(schema, { name: exportName });

          const { imports, body } = extractImportsAndBody(output, isPython);
          allImports.push(imports);

          const { enums, bodyWithoutEnums } = extractEnums(body, isPython);
          allEnums.push(...enums.filter((block) => block.trim().length > 0));

          const cleanedBody = bodyWithoutEnums
            .replace(/^\s*\n+/g, '') // remove leading blank lines between enums and body
            .replace(/\n+$/, '')
            .trimEnd();
          if (cleanedBody) {
            bodyOutputs.push(cleanedBody);
          }
        } catch (error: any) {
          if (signal.aborted) break;
          const sanitized = sanitizeErrorMessage(error?.message);
          const prefix = isPython ? '#' : '//';
          const concise =
            sanitized
              .split('\n')
              .map((line) => line.trim())
              .find((line) => line.length > 0) ?? sanitized;
          const key = `${exportName}:${concise}`;
          if (!seenErrors.has(key)) {
            seenErrors.add(key);
            bodyOutputs.push(`${prefix} Error converting '${exportName}': ${concise}`);
          }
          allImports.push([]);
        }
      }
    };
    const timeoutId = setTimeout(() => abortController.abort(), CONVERSION_TIMEOUT_MS);
    await Promise.race([
      conversionWork(),
      new Promise((_, reject) =>
        signal.addEventListener('abort', () =>
          reject(new Error(`Conversion timed out after ${CONVERSION_TIMEOUT_MS}ms`)),
        ),
      ),
    ]);
    clearTimeout(timeoutId);

    const mergedImports = deduplicateImports(allImports);
    const mergedEnums = Array.from(
      new Map(
        allEnums.filter((block) => block.trim().length > 0).map((block) => [block.trim(), block]),
      ).values(),
    );

    const seenBodies = new Set<string>();
    const uniqueBodyOutputs = bodyOutputs.filter((body) => {
      const normalized = body.trim();
      if (!normalized || seenBodies.has(normalized)) {
        return false;
      }
      seenBodies.add(normalized);
      return true;
    });

    const resultSections: string[] = [];
    if (mergedImports.length > 0) {
      resultSections.push(mergedImports.join('\n'));
    }
    if (mergedEnums.length > 0) {
      resultSections.push(mergedEnums.join('\n\n'));
    }
    if (uniqueBodyOutputs.length > 0) {
      resultSections.push(uniqueBodyOutputs.join('\n\n'));
    }

    if (nonExported.length > 0) {
      const prefix = isPython ? '#' : '//';
      resultSections.push(
        `${prefix} Note: Detected but not converted (not exported): ${nonExported.join(', ')}`,
      );
    }

    return new Response(JSON.stringify({ output: resultSections.join('\n\n') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const sanitized = sanitizeErrorMessage(error?.message);
    return new Response(JSON.stringify({ error: sanitized }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
};
