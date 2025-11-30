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

            // Generate __init__.py if requested and target is pydantic
            if (generateInitFiles && t === 'pydantic') {
              const initPath = path.join(outputDir, '__init__.py');
              await fs.writeFile(initPath, '', 'utf8');
            }
          }

          await fs.writeFile(outputPath, output.content, 'utf8');

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

  // Generate root __init__.py if requested (for both flat and structured)
  if (generateInitFiles && (target === 'pydantic' || target === 'all')) {
    const rootInitPath = path.join(resolvedOutDir, '__init__.py');
    // Only create if it doesn't already exist (might have been created above)
    try {
      await fs.access(rootInitPath);
    } catch {
      await fs.writeFile(rootInitPath, '', 'utf8');
    }
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
): { path: string; content: string } {
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

  return { path: outputPath, content };
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
