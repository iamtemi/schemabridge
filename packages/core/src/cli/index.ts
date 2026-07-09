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
  clean: boolean;
  verify: boolean;
  exportNamePattern?: string;
  tsconfigPath?: string;
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
};

type FileArgs = {
  mode: 'file';
  inputFile: string;
  exportName: string;
  target: Target | 'all';
  allowUnresolved: boolean;
  out?: string;
  tsconfigPath?: string;
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
};

type ParsedArgs = FolderArgs | FileArgs;

type CommonCliOptions = {
  target: Target | 'all';
  allowUnresolved: boolean;
  tsconfigPath?: string;
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
};

const USAGE = `
Usage:
  schemabridge convert zod <input-file> --export <schema-name> [--to pydantic|typescript|all] [--out <path>] [--allow-unresolved] [--enum-style enum|literal] [--enum-base-type str|int]
  schemabridge convert folder <source-dir> --out <output-dir> [--to pydantic|typescript|all] [--flat] [--init] [--clean] [--verify] [--export-pattern <pattern>] [--allow-unresolved] [--enum-style enum|literal] [--enum-base-type str|int]

Commands:
  convert zod    Convert a single Zod schema from a file
  convert folder Convert all Zod schemas in a folder recursively

Examples:
  # Convert single schema
  schemabridge convert zod input.ts --export enrichedTransactionSchema --to pydantic --out model.py
  
  # Convert standalone enum
  schemabridge convert zod enums.ts --export statusEnum --to pydantic --out status.py
  
  # Convert with enum options
  schemabridge convert zod input.ts --export schema --to pydantic --out model.py --enum-style literal --enum-base-type str
  
  # Convert all schemas in a folder (preserves structure)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic
  
  # Convert all schemas to flat output structure
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --flat
  
  # Generate __init__.py files for Python packages
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --init

  # Verify generated files are current without writing
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --verify

  # Only convert exports whose names match a pattern (e.g. *Schema)
  schemabridge convert folder ./src/schemas --out ./generated --to pydantic --export-pattern '*Schema'
`.trim();

export async function runCLI(argv: string[] = process.argv.slice(2)): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }

  try {
    const parsed = parseArgs(argv);
    if (parsed.mode === 'folder') {
      return await runFolderConversion(parsed);
    }
    return await runFileConversion(parsed);
  } catch (err) {
    console.error(`Error: ${formatErrorMessage(err)}`);
    console.error(USAGE);
    return 1;
  }
}

async function runFolderConversion(parsed: FolderArgs): Promise<number> {
  const result = await convertFolder({
    sourceDir: parsed.sourceDir,
    outDir: parsed.out,
    target: parsed.target,
    preserveStructure: !parsed.flat,
    generateInitFiles: parsed.generateInitFiles,
    clean: parsed.clean,
    verify: parsed.verify,
    registerTsLoader: true,
    trustedInput: true,
    allowUnresolved: parsed.allowUnresolved,
    ...(parsed.exportNamePattern !== undefined && {
      exportNamePattern: parsed.exportNamePattern,
    }),
    ...(parsed.tsconfigPath !== undefined && { tsconfigPath: parsed.tsconfigPath }),
    ...(parsed.enumStyle !== undefined && { enumStyle: parsed.enumStyle }),
    ...(parsed.enumBaseType !== undefined && { enumBaseType: parsed.enumBaseType }),
  });

  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (result.skippedFiles.length > 0) {
    console.warn(`Skipped ${result.skippedFiles.length} files (no schemas found)`);
  }

  for (const error of result.errors) {
    console.error(`Error: ${error}`);
  }

  for (const file of result.files.filter((file) => file.action === 'written')) {
    console.log(`Wrote ${file.target}: ${file.path}`);
  }

  if (result.deleted > 0) {
    console.log(`Deleted ${result.deleted} stale generated file(s).`);
  }

  console.log(
    `\nSync summary: written ${result.written}, unchanged ${result.unchanged}, deleted ${result.deleted}, out of date ${result.outOfDate}.`,
  );

  if (result.errors.length > 0) {
    return 1;
  }

  if (parsed.verify && result.outOfDate > 0) {
    console.error(`Generated files are out of date (${result.outOfDate}).`);
    return 1;
  }

  return 0;
}

async function runFileConversion(parsed: FileArgs): Promise<number> {
  const { schema, warnings } = await loadZodSchema({
    file: parsed.inputFile,
    exportName: parsed.exportName,
    registerTsLoader: true,
    trustedInput: true,
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
  if (parsed.enumStyle !== undefined) {
    generateOptions.enumStyle = parsed.enumStyle;
  }
  if (parsed.enumBaseType !== undefined) {
    generateOptions.enumBaseType = parsed.enumBaseType;
  }

  const results = await generateFilesFromZod(generateOptions);
  for (const result of results) {
    const label = result.action === 'unchanged' ? 'Unchanged' : 'Wrote';
    console.log(`${label} ${result.target}: ${result.path}`);
  }

  return 0;
}

function formatErrorMessage(err: unknown): string {
  if (err instanceof SchemaLoadError) {
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
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

function readFlagValue(rest: string[], index: number, usage: string): string {
  const value = rest[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(usage);
  }
  return value;
}

function parseTargetValue(value: string): Target | 'all' {
  if (value !== 'pydantic' && value !== 'typescript' && value !== 'all') {
    throw new Error('Invalid --to value. Expected "pydantic", "typescript", or "all".');
  }
  return value;
}

function parseEnumStyle(value: string): 'enum' | 'literal' {
  if (value !== 'enum' && value !== 'literal') {
    throw new Error('Invalid --enum-style value. Expected "enum" or "literal".');
  }
  return value;
}

function parseEnumBaseType(value: string): 'str' | 'int' {
  if (value !== 'str' && value !== 'int') {
    throw new Error('Invalid --enum-base-type value. Expected "str" or "int".');
  }
  return value;
}

function rejectUnknownArg(arg: string): never {
  if (arg.startsWith('-')) {
    throw new Error(`Unknown option: ${arg}`);
  }
  throw new Error(`Unexpected argument: ${arg}`);
}

function applyCommonOption(
  arg: string,
  rest: string[],
  index: number,
  options: CommonCliOptions,
): number | null {
  switch (arg) {
    case '--to': {
      options.target = parseTargetValue(
        readFlagValue(rest, index, '--to requires a value: --to pydantic|typescript|all'),
      );
      return 2;
    }
    case '--allow-unresolved':
      options.allowUnresolved = true;
      return 1;
    case '--tsconfig': {
      options.tsconfigPath = readFlagValue(
        rest,
        index,
        '--tsconfig requires a value: --tsconfig <path>',
      );
      return 2;
    }
    case '--enum-style': {
      options.enumStyle = parseEnumStyle(
        readFlagValue(rest, index, '--enum-style requires a value: --enum-style enum|literal'),
      );
      return 2;
    }
    case '--enum-base-type': {
      options.enumBaseType = parseEnumBaseType(
        readFlagValue(rest, index, '--enum-base-type requires a value: --enum-base-type str|int'),
      );
      return 2;
    }
    default:
      return null;
  }
}

function createCommonOptions(): CommonCliOptions {
  return {
    target: 'pydantic',
    allowUnresolved: false,
  };
}

function parseFileArgs(rest: string[]): FileArgs {
  if (rest.length === 0) {
    throw new Error('Missing <input-file>');
  }

  const inputFile = rest[0];
  if (!inputFile) {
    throw new Error('Missing <input-file>');
  }

  const options = createCommonOptions();
  let exportName: string | undefined;
  let out: string | undefined;

  let index = 1;
  while (index < rest.length) {
    const arg = rest[index];
    if (!arg) {
      index += 1;
      continue;
    }

    const consumed = applyCommonOption(arg, rest, index, options);
    if (consumed !== null) {
      index += consumed;
      continue;
    }

    switch (arg) {
      case '--export':
        exportName = readFlagValue(
          rest,
          index,
          '--export requires a value: --export <schema-name>',
        );
        index += 2;
        break;
      case '--out':
        out = readFlagValue(rest, index, '--out requires a value: --out <path>');
        index += 2;
        break;
      default:
        rejectUnknownArg(arg);
    }
  }

  if (!exportName) {
    throw new Error('Missing required --export <schema-name>');
  }

  const result: FileArgs = {
    mode: 'file',
    inputFile: path.resolve(inputFile),
    exportName,
    target: options.target,
    allowUnresolved: options.allowUnresolved,
    ...(options.tsconfigPath !== undefined && { tsconfigPath: options.tsconfigPath }),
    ...(options.enumStyle !== undefined && { enumStyle: options.enumStyle }),
    ...(options.enumBaseType !== undefined && { enumBaseType: options.enumBaseType }),
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

  const options = createCommonOptions();
  let out: string | undefined;
  let flat = false;
  let generateInitFiles = false;
  let clean = false;
  let verify = false;
  let exportNamePattern: string | undefined;

  let index = 1;
  while (index < rest.length) {
    const arg = rest[index];
    if (!arg) {
      index += 1;
      continue;
    }

    const consumed = applyCommonOption(arg, rest, index, options);
    if (consumed !== null) {
      index += consumed;
      continue;
    }

    switch (arg) {
      case '--out':
        out = readFlagValue(rest, index, '--out requires a value: --out <output-dir>');
        index += 2;
        break;
      case '--flat':
        flat = true;
        index += 1;
        break;
      case '--init':
        generateInitFiles = true;
        index += 1;
        break;
      case '--clean':
        clean = true;
        index += 1;
        break;
      case '--verify':
        verify = true;
        index += 1;
        break;
      case '--export-pattern':
        exportNamePattern = readFlagValue(
          rest,
          index,
          "--export-pattern requires a value, e.g. --export-pattern '*Schema'",
        );
        index += 2;
        break;
      default:
        rejectUnknownArg(arg);
    }
  }

  if (!out) {
    throw new Error('Missing required --out <output-dir>');
  }

  return {
    mode: 'folder',
    sourceDir: path.resolve(sourceDir),
    out: path.resolve(out),
    target: options.target,
    allowUnresolved: options.allowUnresolved,
    flat,
    generateInitFiles,
    clean,
    verify,
    ...(exportNamePattern !== undefined && { exportNamePattern }),
    ...(options.tsconfigPath !== undefined && { tsconfigPath: options.tsconfigPath }),
    ...(options.enumStyle !== undefined && { enumStyle: options.enumStyle }),
    ...(options.enumBaseType !== undefined && { enumBaseType: options.enumBaseType }),
  };
}

const isMainModule =
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '');

if (isMainModule) {
  const exitCode = await runCLI();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
