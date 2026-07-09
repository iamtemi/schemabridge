/**
 * Folder Converter
 *
 * Converts all Zod schemas in a folder to Pydantic/TypeScript outputs.
 */

import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { convertZodToPydantic, convertZodToTypescript, type Target } from './convert.js';
import {
  hasGeneratedMarker,
  normalizeGeneratedContent,
  prepareGeneratedContent,
  readTextFileIfExists,
} from '../generated-files.js';
import type { SchemaExport, ScanFolderOptions } from './folder-scanner.js';
import { scanFolderForSchemas } from './folder-scanner.js';

export interface ConvertFolderOptions extends ScanFolderOptions {
  /** Output directory */
  outDir: string;
  /** Target language(s) to generate */
  target: Target | 'all';
  /** Whether to delete stale SchemaBridge-generated files (default: false) */
  clean?: boolean;
  /** Whether to verify outputs without writing or deleting files (default: false) */
  verify?: boolean;
  /** Whether to preserve source folder structure (default: true) */
  preserveStructure?: boolean;
  /** Whether to skip files that don't contain schemas (default: true) */
  skipEmptyFiles?: boolean;
  /** Whether to generate __init__.py files for Python packages (default: false) */
  generateInitFiles?: boolean;
  /** Style for enum generation. Default: 'enum' */
  enumStyle?: 'enum' | 'literal';
  /** Base type for enum classes. Default: 'str' */
  enumBaseType?: 'str' | 'int';
}

export interface ConvertedFile {
  /** Output file path */
  path: string;
  /** Source schema file */
  sourceFile: string;
  /** Schema export name */
  exportName: string;
  /** Target type */
  target: Target;
  /** Sync action for this file */
  action?: 'written' | 'unchanged' | 'outOfDate';
}

export interface ConvertFolderResult {
  /** Planned schema output files from this run */
  files: ConvertedFile[];
  /** Warnings encountered during conversion */
  warnings: string[];
  /** Files that were skipped */
  skippedFiles: string[];
  /** Conversion errors encountered during conversion */
  errors: string[];
  /** Files written during this run */
  written: number;
  /** Planned files already correct on disk */
  unchanged: number;
  /** Stale generated files deleted during this run */
  deleted: number;
  /** Files needing changes while running in verify mode */
  outOfDate: number;
}

interface PlannedGeneratedFile {
  path: string;
  content: string;
  target: Target;
}

interface SyncGeneratedFilesResult {
  written: number;
  unchanged: number;
  deleted: number;
  outOfDate: number;
  actionByPath: Map<string, ConvertedFile['action']>;
}

/**
 * Convert all Zod schemas in a folder to Pydantic/TypeScript outputs.
 */
export async function convertFolder(options: ConvertFolderOptions): Promise<ConvertFolderResult> {
  const {
    outDir,
    target,
    clean = false,
    verify = false,
    preserveStructure = true,
    skipEmptyFiles: _skipEmptyFiles = true,
    generateInitFiles = false,
    ...scanOptions
  } = options;

  const resolvedOutDir = path.resolve(outDir);
  if (!verify) {
    await fs.mkdir(resolvedOutDir, { recursive: true });
  }

  const scanResult = await scanFolderForSchemas(scanOptions);
  const schemaMap = deduplicateSchemaExports(scanResult.schemas);
  const schemasByFile = groupSchemasByFile(schemaMap);
  const pythonModuleMap =
    generateInitFiles && (target === 'pydantic' || target === 'all') ? new Map() : null;

  const plan = planSchemaOutputs({
    schemasByFile,
    sourceDir: scanOptions.sourceDir,
    resolvedOutDir,
    target,
    preserveStructure,
    pythonModuleMap,
    ...(options.enumStyle !== undefined && { enumStyle: options.enumStyle }),
    ...(options.enumBaseType !== undefined && { enumBaseType: options.enumBaseType }),
  });

  if (plan.errors.length > 0) {
    return buildFailedConversionResult(scanResult, plan);
  }

  const syncResult = await syncGeneratedFiles(plan.plannedFiles, {
    outDir: resolvedOutDir,
    target,
    clean,
    verify,
  });

  applySyncActions(plan.convertedFiles, syncResult);

  return {
    files: plan.convertedFiles,
    warnings: scanResult.warnings,
    skippedFiles: scanResult.skippedFiles,
    errors: plan.errors,
    written: syncResult.written,
    unchanged: syncResult.unchanged,
    deleted: syncResult.deleted,
    outOfDate: syncResult.outOfDate,
  };
}

function buildFailedConversionResult(
  scanResult: { warnings: string[]; skippedFiles: string[] },
  plan: { convertedFiles: ConvertedFile[]; errors: string[] },
): ConvertFolderResult {
  return {
    files: plan.convertedFiles,
    warnings: scanResult.warnings,
    skippedFiles: scanResult.skippedFiles,
    errors: plan.errors,
    written: 0,
    unchanged: 0,
    deleted: 0,
    outOfDate: 0,
  };
}

function deduplicateSchemaExports(schemas: SchemaExport[]): Map<string, SchemaExport> {
  const schemaMap = new Map<string, SchemaExport>();
  const schemaFiles = new Map<string, string>();

  for (const schema of schemas) {
    const key = schema.exportName;
    if (!schemaMap.has(key)) {
      schemaMap.set(key, schema);
      schemaFiles.set(key, schema.file);
      continue;
    }

    const originalFile = schemaFiles.get(key);
    if (!originalFile) {
      schemaMap.set(key, schema);
      schemaFiles.set(key, schema.file);
      continue;
    }

    if (isIndexFile(schema.file)) {
      continue;
    }

    if (isIndexFile(originalFile)) {
      schemaMap.set(key, schema);
      schemaFiles.set(key, schema.file);
    }
  }

  return schemaMap;
}

function isIndexFile(filePath: string): boolean {
  const baseName = path.basename(filePath);
  return baseName === 'index.ts' || baseName === 'index.js';
}

function groupSchemasByFile(schemaMap: Map<string, SchemaExport>): Map<string, SchemaExport[]> {
  const schemasByFile = new Map<string, SchemaExport[]>();
  for (const schema of schemaMap.values()) {
    const existing = schemasByFile.get(schema.file) ?? [];
    existing.push(schema);
    schemasByFile.set(schema.file, existing);
  }
  return schemasByFile;
}

interface PlanSchemaOutputsOptions {
  schemasByFile: Map<string, SchemaExport[]>;
  sourceDir: string;
  resolvedOutDir: string;
  target: Target | 'all';
  preserveStructure: boolean;
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
  pythonModuleMap: Map<string, PythonModuleEntry[]> | null;
}

interface PlanSchemaOutputsResult {
  plannedFiles: PlannedGeneratedFile[];
  convertedFiles: ConvertedFile[];
  errors: string[];
}

function planSchemaOutputs(options: PlanSchemaOutputsOptions): PlanSchemaOutputsResult {
  const plannedFiles: PlannedGeneratedFile[] = [];
  const convertedFiles: ConvertedFile[] = [];
  const errors: string[] = [];
  const usedNames = new Map<string, number>();

  for (const [sourceFile, schemas] of options.schemasByFile.entries()) {
    planOutputsForSourceFile(
      sourceFile,
      schemas,
      options,
      usedNames,
      plannedFiles,
      convertedFiles,
      errors,
    );
  }

  appendInitFiles(options.resolvedOutDir, options.pythonModuleMap, plannedFiles);

  return { plannedFiles, convertedFiles, errors };
}

function planOutputsForSourceFile(
  sourceFile: string,
  schemas: SchemaExport[],
  options: PlanSchemaOutputsOptions,
  usedNames: Map<string, number>,
  plannedFiles: PlannedGeneratedFile[],
  convertedFiles: ConvertedFile[],
  errors: string[],
): void {
  if (schemas.length === 0) return;

  const relativePath = path.relative(options.sourceDir, sourceFile);
  const outputBasePath = resolveOutputBasePath({
    preserveStructure: options.preserveStructure,
    relativePath,
    sourceFile,
    resolvedOutDir: options.resolvedOutDir,
  });

  for (const schemaExport of schemas) {
    const targets: Target[] =
      options.target === 'all' ? ['pydantic', 'typescript'] : [options.target];
    for (const t of targets) {
      planSingleSchemaOutput({
        schemaExport,
        target: t,
        sourceFile,
        outputBasePath,
        preserveStructure: options.preserveStructure,
        resolvedOutDir: options.resolvedOutDir,
        usedNames,
        pythonModuleMap: options.pythonModuleMap,
        plannedFiles,
        convertedFiles,
        errors,
        ...(options.enumStyle !== undefined && { enumStyle: options.enumStyle }),
        ...(options.enumBaseType !== undefined && { enumBaseType: options.enumBaseType }),
      });
    }
  }
}

function appendInitFiles(
  resolvedOutDir: string,
  pythonModuleMap: Map<string, PythonModuleEntry[]> | null,
  plannedFiles: PlannedGeneratedFile[],
): void {
  if (!pythonModuleMap) return;

  const initFiles = buildInitFiles(resolvedOutDir, pythonModuleMap);
  for (const initFile of initFiles) {
    plannedFiles.push({
      path: initFile.path,
      content: initFile.content,
      target: 'pydantic',
    });
  }
}

function resolveOutputBasePath(options: {
  preserveStructure: boolean;
  relativePath: string;
  sourceFile: string;
  resolvedOutDir: string;
}): string {
  if (options.preserveStructure) {
    const relativeDir = path.dirname(options.relativePath);
    const baseName = path.basename(options.sourceFile, path.extname(options.sourceFile));
    return path.join(options.resolvedOutDir, relativeDir, baseName);
  }
  return options.resolvedOutDir;
}

function planSingleSchemaOutput(options: {
  schemaExport: SchemaExport;
  target: Target;
  sourceFile: string;
  outputBasePath: string;
  preserveStructure: boolean;
  resolvedOutDir: string;
  usedNames: Map<string, number>;
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
  pythonModuleMap: Map<string, PythonModuleEntry[]> | null;
  plannedFiles: PlannedGeneratedFile[];
  convertedFiles: ConvertedFile[];
  errors: string[];
}): void {
  try {
    const convertOptions: Parameters<typeof convertSchema>[2] = {
      preserveStructure: options.preserveStructure,
      outputBasePath: options.outputBasePath,
      sourceFile: options.sourceFile,
      outDir: options.resolvedOutDir,
      usedNames: options.usedNames,
      ...(options.enumStyle !== undefined && { enumStyle: options.enumStyle }),
      ...(options.enumBaseType !== undefined && { enumBaseType: options.enumBaseType }),
    };
    const output = convertSchema(options.schemaExport, options.target, convertOptions);

    options.plannedFiles.push({
      path: output.path,
      content: output.content,
      target: options.target,
    });

    if (options.pythonModuleMap && options.target === 'pydantic') {
      recordPythonModule(options.pythonModuleMap, output.path, output.symbolName);
    }

    options.convertedFiles.push({
      path: output.path,
      sourceFile: options.sourceFile,
      exportName: options.schemaExport.exportName,
      target: options.target,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    options.errors.push(
      `Failed to convert ${options.schemaExport.exportName} from ${options.sourceFile}: ${message}`,
    );
  }
}

function applySyncActions(
  convertedFiles: ConvertedFile[],
  syncResult: SyncGeneratedFilesResult,
): void {
  for (const file of convertedFiles) {
    const action = syncResult.actionByPath.get(path.resolve(file.path));
    if (action !== undefined) {
      file.action = action;
    }
  }
}

function convertSchema(
  schemaExport: SchemaExport,
  target: Target,
  options: {
    preserveStructure: boolean;
    outputBasePath: string;
    sourceFile: string;
    outDir: string;
    usedNames: Map<string, number>;
    enumStyle?: 'enum' | 'literal';
    enumBaseType?: 'str' | 'int';
  },
): { path: string; content: string; symbolName: string } {
  const { schema, exportName } = schemaExport;
  const { preserveStructure, outputBasePath, outDir, usedNames, enumStyle, enumBaseType } = options;

  // Generate class/interface name from export name
  const className = toPascalCase(exportName);

  // Determine output file path - use just the export name in snake_case
  const baseFileName = toSnakeCase(exportName);
  const ext = target === 'pydantic' ? '.py' : '.d.ts';

  // Handle collisions by appending numbers
  const targetDir = preserveStructure ? path.dirname(outputBasePath) : outDir;
  let fileName = `${baseFileName}${ext}`;
  let fileKey = path.join(targetDir, fileName);
  let counter = usedNames.get(fileKey) ?? 0;

  if (counter > 0) {
    fileName = `${baseFileName}_${counter}${ext}`;
    fileKey = path.join(targetDir, fileName);
  }
  usedNames.set(fileKey, counter + 1);

  let outputPath: string;
  if (preserveStructure) {
    // Place in the same directory structure
    outputPath = path.join(path.dirname(outputBasePath), fileName);
  } else {
    // Flat structure: just use the file name
    outputPath = path.join(outDir, fileName);
  }

  // Convert schema
  const conversionOptions: Parameters<typeof convertZodToPydantic>[1] = {
    name: className,
    sourceModule: schemaExport.file,
    ...(enumStyle !== undefined && { enumStyle }),
    ...(enumBaseType !== undefined && { enumBaseType }),
  };

  const content =
    target === 'pydantic'
      ? convertZodToPydantic(schema, conversionOptions)
      : convertZodToTypescript(schema, conversionOptions);

  return { path: outputPath, content, symbolName: className };
}

async function syncGeneratedFiles(
  plannedFiles: PlannedGeneratedFile[],
  options: {
    outDir: string;
    target: Target | 'all';
    clean: boolean;
    verify: boolean;
  },
): Promise<SyncGeneratedFilesResult> {
  let written = 0;
  let unchanged = 0;
  let deleted = 0;
  let outOfDate = 0;
  const actionByPath = new Map<string, ConvertedFile['action']>();
  const plannedPaths = new Set(plannedFiles.map((file) => path.resolve(file.path)));

  for (const file of plannedFiles) {
    const resolvedPath = path.resolve(file.path);
    const normalizedContent = prepareGeneratedContent(file.content, file.target);
    const existingContent = await readTextFileIfExists(resolvedPath);

    if (
      existingContent !== undefined &&
      normalizeGeneratedContent(existingContent) === normalizedContent
    ) {
      unchanged++;
      actionByPath.set(resolvedPath, 'unchanged');
      continue;
    }

    if (options.verify) {
      outOfDate++;
      actionByPath.set(resolvedPath, 'outOfDate');
      continue;
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, normalizedContent, 'utf8');
    written++;
    actionByPath.set(resolvedPath, 'written');
  }

  if (options.clean) {
    const staleFiles = await findStaleGeneratedFiles(options.outDir, plannedPaths, options.target);
    if (options.verify) {
      outOfDate += staleFiles.length;
    } else {
      for (const staleFile of staleFiles) {
        await fs.unlink(staleFile);
        deleted++;
      }
    }
  }

  return { written, unchanged, deleted, outOfDate, actionByPath };
}

async function findStaleGeneratedFiles(
  outDir: string,
  plannedPaths: Set<string>,
  target: Target | 'all',
): Promise<string[]> {
  const staleFiles: string[] = [];

  async function walk(currentDir: string): Promise<void> {
    const entries = await readDirectoryEntries(currentDir);
    for (const entry of entries) {
      await collectStaleFileIfNeeded(entry, currentDir, plannedPaths, target, staleFiles, walk);
    }
  }

  await walk(outDir);
  return staleFiles;
}

async function readDirectoryEntries(currentDir: string): Promise<Dirent[]> {
  try {
    return (await fs.readdir(currentDir, { withFileTypes: true })).sort((a, b) =>
      compareLexicographic(a.name, b.name),
    );
  } catch (err) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function collectStaleFileIfNeeded(
  entry: Dirent,
  currentDir: string,
  plannedPaths: Set<string>,
  target: Target | 'all',
  staleFiles: string[],
  walk: (dir: string) => Promise<void>,
): Promise<void> {
  const entryPath = path.join(currentDir, entry.name);
  if (entry.isDirectory()) {
    await walk(entryPath);
    return;
  }
  if (!entry.isFile()) {
    return;
  }

  const resolvedPath = path.resolve(entryPath);
  if (plannedPaths.has(resolvedPath) || !isCleanCandidatePath(resolvedPath, target)) {
    return;
  }

  const content = await readTextFileIfExists(resolvedPath);
  if (content !== undefined && hasGeneratedMarker(resolvedPath, content)) {
    staleFiles.push(resolvedPath);
  }
}

function isCleanCandidatePath(filePath: string, target: Target | 'all'): boolean {
  const targets: Target[] = target === 'all' ? ['pydantic', 'typescript'] : [target];
  return (
    (targets.includes('pydantic') && filePath.endsWith('.py')) ||
    (targets.includes('typescript') && filePath.endsWith('.d.ts'))
  );
}

function compareLexicographic(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isNodeError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && 'code' in error;
}

interface PythonModuleEntry {
  moduleName: string;
  symbolNames: string[];
}

interface PackageNode {
  path: string;
  modules: PythonModuleEntry[];
  children: Set<PackageNode>;
}

function recordPythonModule(
  modulesByDir: Map<string, PythonModuleEntry[]>,
  filePath: string,
  symbolName: string,
): void {
  const dirPath = path.dirname(filePath);
  const moduleName = path.basename(filePath, path.extname(filePath));
  const entries = modulesByDir.get(dirPath) ?? [];
  entries.push({ moduleName, symbolNames: [symbolName] });
  modulesByDir.set(dirPath, entries);
}

function buildInitFiles(
  rootDir: string,
  modulesByDir: Map<string, PythonModuleEntry[]>,
): Array<{ path: string; content: string }> {
  const dirPaths = buildDirSet(rootDir, modulesByDir);
  if (!dirPaths.has(rootDir)) {
    dirPaths.add(rootDir);
  }

  const nodes = createPackageNodes(rootDir, dirPaths, modulesByDir);
  const rootNode = nodes.get(rootDir);
  if (!rootNode) return [];

  const fileContents = new Map<string, string>();

  const traverse = (node: PackageNode): string[] => {
    const lines: string[] = [];
    const exportedSymbols: string[] = [];

    const moduleEntries = [...node.modules].sort((a, b) =>
      compareLexicographic(a.moduleName, b.moduleName),
    );
    for (const entry of moduleEntries) {
      const joinedSymbols = entry.symbolNames.join(', ');
      lines.push(`from .${entry.moduleName} import ${joinedSymbols}`);
      exportedSymbols.push(...entry.symbolNames);
    }

    const childEntries = [...node.children].sort((a, b) =>
      compareLexicographic(path.basename(a.path), path.basename(b.path)),
    );
    for (const child of childEntries) {
      const childExports = traverse(child);
      if (childExports.length === 0) {
        continue;
      }
      const childName = path.basename(child.path);
      lines.push(`from .${childName} import ${childExports.join(', ')}`);
      exportedSymbols.push(...childExports);
    }

    const orderedExports: string[] = [];
    const seen = new Set<string>();
    for (const symbol of exportedSymbols) {
      if (seen.has(symbol)) continue;
      seen.add(symbol);
      orderedExports.push(symbol);
    }

    let content = '';
    if (lines.length > 0) {
      content += `${lines.join('\n')}\n\n`;
    }
    if (orderedExports.length > 0) {
      const quoted = orderedExports.map((symbol) => `"${symbol}"`).join(', ');
      content += `__all__ = [${quoted}]\n`;
    }

    fileContents.set(node.path, content);
    return orderedExports;
  };

  traverse(rootNode);

  return [...fileContents.entries()].map(([dirPath, content]) => ({
    path: path.join(dirPath, '__init__.py'),
    content,
  }));
}

function buildDirSet(rootDir: string, modulesByDir: Map<string, PythonModuleEntry[]>): Set<string> {
  const dirPaths = new Set<string>();
  for (const dirPath of modulesByDir.keys()) {
    dirPaths.add(dirPath);
    let current = dirPath;
    while (true) {
      const parent = getParentWithinRoot(current, rootDir);
      if (!parent) break;
      if (dirPaths.has(parent)) {
        current = parent;
        continue;
      }
      dirPaths.add(parent);
      current = parent;
    }
  }
  return dirPaths;
}

function createPackageNodes(
  rootDir: string,
  dirPaths: Set<string>,
  modulesByDir: Map<string, PythonModuleEntry[]>,
): Map<string, PackageNode> {
  const nodes = new Map<string, PackageNode>();

  const ensureNode = (dirPath: string): PackageNode => {
    let node = nodes.get(dirPath);
    if (!node) {
      node = {
        path: dirPath,
        modules: modulesByDir.get(dirPath) ?? [],
        children: new Set<PackageNode>(),
      };
      nodes.set(dirPath, node);
    }
    return node;
  };

  for (const dirPath of dirPaths) {
    ensureNode(dirPath);
  }

  for (const dirPath of dirPaths) {
    const parent = getParentWithinRoot(dirPath, rootDir);
    if (!parent) continue;
    const parentNode = ensureNode(parent);
    const childNode = ensureNode(dirPath);
    if (parentNode !== childNode) {
      parentNode.children.add(childNode);
    }
  }

  return nodes;
}

function getParentWithinRoot(dirPath: string, rootDir: string): string | null {
  if (dirPath === rootDir) return null;
  const parent = path.dirname(dirPath);
  if (!parent || parent === dirPath) return null;
  if (!parent.startsWith(rootDir)) return null;
  return parent;
}

function toPascalCase(str: string): string {
  return (
    str
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('') || 'Model'
  );
}

function toSnakeCase(str: string): string {
  let result = str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase();
  while (result.startsWith('_')) {
    result = result.slice(1);
  }
  while (result.endsWith('_')) {
    result = result.slice(0, -1);
  }
  return result;
}
