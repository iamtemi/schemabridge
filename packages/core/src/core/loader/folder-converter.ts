/**
 * Folder Converter
 *
 * Converts all Zod schemas in a folder to Pydantic/TypeScript outputs.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { convertZodToPydantic, convertZodToTypescript, type Target } from '../../index.js';
import type { SchemaExport, ScanFolderOptions } from './folder-scanner.js';
import { scanFolderForSchemas } from './folder-scanner.js';

export interface ConvertFolderOptions extends ScanFolderOptions {
  /** Output directory */
  outDir: string;
  /** Target language(s) to generate */
  target: Target | 'all';
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
}

export interface ConvertFolderResult {
  /** Files that were written */
  files: ConvertedFile[];
  /** Warnings encountered during conversion */
  warnings: string[];
  /** Files that were skipped */
  skippedFiles: string[];
}

/**
 * Convert all Zod schemas in a folder to Pydantic/TypeScript outputs.
 */
export async function convertFolder(options: ConvertFolderOptions): Promise<ConvertFolderResult> {
  const {
    outDir,
    target,
    preserveStructure = true,
    skipEmptyFiles: _skipEmptyFiles = true,
    generateInitFiles = false,
    ...scanOptions
  } = options;

  const resolvedOutDir = path.resolve(outDir);
  await fs.mkdir(resolvedOutDir, { recursive: true });

  // Scan for all schemas
  const scanResult = await scanFolderForSchemas(scanOptions);
  const allWarnings = [...scanResult.warnings];
  const allSkipped = [...scanResult.skippedFiles];
  const convertedFiles: ConvertedFile[] = [];
  const pythonModuleMap: Map<string, PythonModuleEntry[]> | null =
    generateInitFiles && (target === 'pydantic' || target === 'all') ? new Map() : null;

  // Deduplicate schemas by export name (handle re-exports)
  // Keep the first occurrence (original file, not re-export)
  const schemaMap = new Map<string, SchemaExport>();
  const schemaFiles = new Map<string, string>(); // exportName -> original file

  for (const schema of scanResult.schemas) {
    const key = schema.exportName;
    if (!schemaMap.has(key)) {
      schemaMap.set(key, schema);
      schemaFiles.set(key, schema.file);
    } else {
      // If this is from a re-export file (index.ts), skip it
      const originalFile = schemaFiles.get(key);
      if (!originalFile) {
        schemaMap.set(key, schema);
        schemaFiles.set(key, schema.file);
        continue;
      }
      const isReExport =
        path.basename(schema.file) === 'index.ts' || path.basename(schema.file) === 'index.js';
      if (isReExport) {
        // Skip re-exports
        continue;
      }
      // If original was from index.ts and this is the actual file, replace it
      if (
        path.basename(originalFile) === 'index.ts' ||
        path.basename(originalFile) === 'index.js'
      ) {
        schemaMap.set(key, schema);
        schemaFiles.set(key, schema.file);
      }
    }
  }

  // Group deduplicated schemas by file
  const schemasByFile = new Map<string, SchemaExport[]>();
  for (const schema of schemaMap.values()) {
    const existing = schemasByFile.get(schema.file) || [];
    existing.push(schema);
    schemasByFile.set(schema.file, existing);
  }

  // Track used file names to handle collisions
  const usedNames = new Map<string, number>();
  const createdDirs = new Set<string>();

  // Convert each schema
  for (const [sourceFile, schemas] of schemasByFile.entries()) {
    if (schemas.length === 0) continue;

    const relativePath = path.relative(scanOptions.sourceDir, sourceFile);

    // Determine output path structure
    let outputBasePath: string;
    if (preserveStructure) {
      // Mirror source structure
      const relativeDir = path.dirname(relativePath);
      const baseName = path.basename(sourceFile, path.extname(sourceFile));
      outputBasePath = path.join(resolvedOutDir, relativeDir, baseName);
    } else {
      // Flat structure: just use outDir
      outputBasePath = resolvedOutDir;
    }

    // Convert each schema in the file
    for (const schemaExport of schemas) {
      const targets: Target[] = target === 'all' ? ['pydantic', 'typescript'] : [target];

      for (const t of targets) {
        try {
          const convertOptions: Parameters<typeof convertSchema>[2] = {
            preserveStructure,
            outputBasePath,
            sourceFile,
            outDir: resolvedOutDir,
            usedNames,
          };
          if (options.enumStyle !== undefined) {
            convertOptions.enumStyle = options.enumStyle;
          }
          if (options.enumBaseType !== undefined) {
            convertOptions.enumBaseType = options.enumBaseType;
          }
          const output = convertSchema(schemaExport, t, convertOptions);

          const outputPath = output.path;
          const outputDir = path.dirname(outputPath);

          // Create directory if needed
          if (!createdDirs.has(outputDir)) {
            await fs.mkdir(outputDir, { recursive: true });
            createdDirs.add(outputDir);
          }

          await fs.writeFile(outputPath, output.content, 'utf8');

          if (pythonModuleMap && t === 'pydantic') {
            recordPythonModule(pythonModuleMap, outputPath, output.symbolName);
          }

          convertedFiles.push({
            path: outputPath,
            sourceFile,
            exportName: schemaExport.exportName,
            target: t,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          allWarnings.push(
            `Failed to convert ${schemaExport.exportName} from ${sourceFile}: ${message}`,
          );
        }
      }
    }
  }

  if (pythonModuleMap) {
    await writeInitFiles(resolvedOutDir, pythonModuleMap);
  }

  return {
    files: convertedFiles,
    warnings: allWarnings,
    skippedFiles: allSkipped,
  };
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
  };
  if (enumStyle !== undefined) {
    conversionOptions.enumStyle = enumStyle;
  }
  if (enumBaseType !== undefined) {
    conversionOptions.enumBaseType = enumBaseType;
  }

  const content =
    target === 'pydantic'
      ? convertZodToPydantic(schema, conversionOptions)
      : convertZodToTypescript(schema, conversionOptions);

  return { path: outputPath, content, symbolName: className };
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

async function writeInitFiles(
  rootDir: string,
  modulesByDir: Map<string, PythonModuleEntry[]>,
): Promise<void> {
  const dirPaths = buildDirSet(rootDir, modulesByDir);
  if (!dirPaths.has(rootDir)) {
    dirPaths.add(rootDir);
  }

  const nodes = createPackageNodes(rootDir, dirPaths, modulesByDir);
  const rootNode = nodes.get(rootDir);
  if (!rootNode) return;

  const fileContents = new Map<string, string>();

  const traverse = (node: PackageNode): string[] => {
    const lines: string[] = [];
    const exportedSymbols: string[] = [];

    const moduleEntries = [...node.modules].sort((a, b) =>
      a.moduleName.localeCompare(b.moduleName),
    );
    for (const entry of moduleEntries) {
      const joinedSymbols = entry.symbolNames.join(', ');
      lines.push(`from .${entry.moduleName} import ${joinedSymbols}`);
      exportedSymbols.push(...entry.symbolNames);
    }

    const childEntries = [...node.children].sort((a, b) =>
      path.basename(a.path).localeCompare(path.basename(b.path)),
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

  for (const [dirPath, content] of fileContents.entries()) {
    const initPath = path.join(dirPath, '__init__.py');
    await fs.writeFile(initPath, content, 'utf8');
  }
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
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');
}
