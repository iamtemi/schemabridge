import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import {
  convertFolder,
  generateFilesFromZod,
  loadZodSchema,
  SchemaLoadError,
  type Target,
} from '../index.js';

type FolderArgs = {
  mode: 'folder';
  sourceDir: string;
  out: string;
  target: Target | 'all';
  allowUnresolved: boolean;
  flat: boolean;
  generateInitFiles: boolean;
  /** Optional export name pattern (wildcard, e.g. "*Schema") for folder mode */
  exportNamePattern?: string;
  tsconfigPath?: string;
};

type FileArgs = {
  mode: 'file';
  inputFile: string;
  exportName: string;
  target: Target | 'all';
  allowUnresolved: boolean;
  out?: string;
  tsconfigPath?: string;
};

type ParsedArgs = FolderArgs | FileArgs;

const USAGE = `
Usage:
  schemabridge convert zod <input-file> --export <schema-name> [--to pydantic|typescript|all] [--out <path>] [--allow-unresolved]
  schemabridge convert folder <source-dir> --out <output-dir> [--to pydantic|typescript|all] [--flat] [--init] [--export-pattern <pattern>] [--allow-unresolved]

Commands:
  convert zod    Convert a single Zod schema from a file
  convert folder Convert all Zod schemas in a folder recursively

Examples:
  # Convert single schema
  schemabridge convert zod input.ts --export enrichedTransactionSchema --to pydantic --out model.py
  
  # Convert all schemas in a folder (preserves structure)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic
  
  # Convert all schemas to flat output structure
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --flat
  
  # Generate __init__.py files for Python packages
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --init

  # Only convert exports whose names match a pattern (e.g. *Schema)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --export-pattern '*Schema'
`.trim();

export async function runCLI(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);

    // Handle folder conversion
    if (parsed.mode === 'folder') {
      const result = await convertFolder({
        sourceDir: parsed.sourceDir,
        outDir: parsed.out,
        target: parsed.target,
        preserveStructure: !parsed.flat,
        generateInitFiles: parsed.generateInitFiles,
        registerTsLoader: true,
        allowUnresolved: parsed.allowUnresolved,
        ...(parsed.exportNamePattern !== undefined && {
          exportNamePattern: parsed.exportNamePattern,
        }),
        ...(parsed.tsconfigPath !== undefined && { tsconfigPath: parsed.tsconfigPath }),
      });

      for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
      }

      if (result.skippedFiles.length > 0) {
        console.warn(`Skipped ${result.skippedFiles.length} files (no schemas found)`);
      }

      for (const file of result.files) {
        console.log(`Wrote ${file.target}: ${file.path}`);
      }

      console.log(`\nConverted ${result.files.length} schema(s) successfully.`);
      return 0;
    }

    // Handle single file conversion
    const { schema, warnings } = await loadZodSchema({
      file: parsed.inputFile,
      exportName: parsed.exportName,
      registerTsLoader: true,
      ...(parsed.tsconfigPath !== undefined && { tsconfigPath: parsed.tsconfigPath }),
      allowUnresolved: parsed.allowUnresolved,
    });

    for (const warning of warnings) {
      console.warn(`Warning: ${warning}`);
    }

    const generateOptions: Parameters<typeof generateFilesFromZod>[0] = {
      schema,
      name: parsed.exportName,
      target: parsed.target,
      allowUnresolved: parsed.allowUnresolved,
      sourceModule: parsed.inputFile,
    };
    if (parsed.out !== undefined) {
      generateOptions.out = parsed.out;
    }
    const results = await generateFilesFromZod(generateOptions);

    for (const result of results) {
      console.log(`Wrote ${result.target}: ${result.path}`);
    }
    return 0;
  } catch (err) {
    const message =
      err instanceof SchemaLoadError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    console.error(`Error: ${message}`);
    console.error(USAGE);
    return 1;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    throw new Error(USAGE);
  }

  const [command, kind, ...rest] = argv;
  if (command !== 'convert') {
    throw new Error('Expected command: convert zod|folder ...');
  }

  if (kind === 'folder') {
    return parseFolderArgs(rest);
  }

  if (kind !== 'zod') {
    throw new Error('Expected command: convert zod <input-file> or convert folder <source-dir>');
  }

  return parseFileArgs(rest);
}

function parseFileArgs(rest: string[]): FileArgs {
  if (rest.length === 0) {
    throw new Error('Missing <input-file>');
  }

  const inputFile = rest[0];
  if (!inputFile) {
    throw new Error('Missing <input-file>');
  }
  let exportName: string | undefined;
  let target: Target | 'all' = 'pydantic';
  let out: string | undefined;
  let allowUnresolved = false;
  let tsconfigPath: string | undefined;

  for (let i = 1; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg) continue;

    switch (arg) {
      case '--export': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--export requires a value: --export <schema-name>');
        }
        exportName = val;
        break;
      }
      case '--to': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--to requires a value: --to pydantic|typescript|all');
        }
        if (val !== 'pydantic' && val !== 'typescript' && val !== 'all') {
          throw new Error('Invalid --to value. Expected "pydantic", "typescript", or "all".');
        }
        target = val;
        break;
      }
      case '--out': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--out requires a value: --out <path>');
        }
        out = val;
        break;
      }
      case '--allow-unresolved':
        allowUnresolved = true;
        break;
      case '--tsconfig': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--tsconfig requires a value: --tsconfig <path>');
        }
        tsconfigPath = val;
        break;
      }
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
    }
  }

  if (!exportName) {
    throw new Error('Missing required --export <schema-name>');
  }

  const result: FileArgs = {
    mode: 'file',
    inputFile: path.resolve(inputFile),
    exportName,
    target,
    allowUnresolved,
    ...(tsconfigPath !== undefined && { tsconfigPath }),
  };
  if (out !== undefined) {
    result.out = out;
  }
  return result;
}

function parseFolderArgs(rest: string[]): FolderArgs {
  if (rest.length === 0) {
    throw new Error('Missing <source-dir>');
  }

  const sourceDir = rest[0];
  if (!sourceDir) {
    throw new Error('Missing <source-dir>');
  }
  let target: Target | 'all' = 'pydantic';
  let out: string | undefined;
  let allowUnresolved = false;
  let flat = false;
  let generateInitFiles = false;
  let exportNamePattern: string | undefined;
  let tsconfigPath: string | undefined;

  for (let i = 1; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg) continue;

    switch (arg) {
      case '--to': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--to requires a value: --to pydantic|typescript|all');
        }
        if (val !== 'pydantic' && val !== 'typescript' && val !== 'all') {
          throw new Error('Invalid --to value. Expected "pydantic", "typescript", or "all".');
        }
        target = val;
        break;
      }
      case '--out': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--out requires a value: --out <output-dir>');
        }
        out = val;
        break;
      }
      case '--allow-unresolved':
        allowUnresolved = true;
        break;
      case '--flat':
        flat = true;
        break;
      case '--init':
        generateInitFiles = true;
        break;
      case '--export-pattern': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error("--export-pattern requires a value, e.g. --export-pattern '*Schema'");
        }
        exportNamePattern = val;
        break;
      }
      case '--tsconfig': {
        const val = rest[++i];
        if (!val || val.startsWith('-')) {
          throw new Error('--tsconfig requires a value: --tsconfig <path>');
        }
        tsconfigPath = val;
        break;
      }
      default:
        if (arg.startsWith('-')) {
          throw new Error(`Unknown option: ${arg}`);
        } else {
          throw new Error(`Unexpected argument: ${arg}`);
        }
    }
  }

  if (!out) {
    throw new Error('Missing required --out <output-dir>');
  }

  return {
    mode: 'folder',
    sourceDir: path.resolve(sourceDir),
    out: path.resolve(out),
    target,
    allowUnresolved,
    flat,
    generateInitFiles,
    ...(exportNamePattern !== undefined && { exportNamePattern }),
    ...(tsconfigPath !== undefined && { tsconfigPath }),
  };
}

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '')) {
  void runCLI().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
