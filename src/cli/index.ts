import { fileURLToPath } from 'node:url';
import path from 'node:path';
import process from 'node:process';
import { generateFilesFromZod, loadZodSchema, SchemaLoadError, type Target } from '../index.js';

interface ParsedArgs {
  inputFile: string;
  exportName: string;
  target: Target | 'all';
  out?: string;
  allowUnresolved: boolean;
  tsconfigPath?: string;
}

const USAGE = `
Usage:
  schemabridge convert zod <input-file> --export <schema-name> [--to pydantic|typescript|all] [--out <path>] [--allow-unresolved]

Examples:
  schemabridge convert zod input.ts --export enrichedTransactionSchema --to pydantic --out model.py
  schemabridge convert zod input.ts --export enrichedTransactionSchema --to all --out ./out
`.trim();

export async function runCLI(argv: string[] = process.argv.slice(2)): Promise<number> {
  try {
    const parsed = parseArgs(argv);
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
  if (command !== 'convert' || kind !== 'zod') {
    throw new Error('Expected command: convert zod <input-file>');
  }

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

  const result: ParsedArgs = {
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

if (path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1] ?? '')) {
  void runCLI().then((code) => {
    if (code !== 0) process.exit(code);
  });
}
