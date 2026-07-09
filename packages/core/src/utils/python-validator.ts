/**
 * Python syntax validation utility
 *
 * Validates generated Python code by attempting to compile it using Python's AST parser.
 * This only checks syntax, not runtime dependencies or execution.
 */

import { spawn } from 'node:child_process';

interface PythonValidationResult {
  valid: boolean;
  error?: string;
}

const PYTHON_SYNTAX_CHECK_SCRIPT = `
import ast
import sys

try:
    ast.parse(sys.stdin.read())
    sys.exit(0)
except SyntaxError as e:
    print(f"{e.filename}:{e.lineno}:{e.offset}: {e.msg}", file=sys.stderr)
    print(f"  {e.text}", file=sys.stderr)
    sys.exit(1)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`.trim();

async function validatePythonSyntax(code: string): Promise<PythonValidationResult> {
  const pythonCommand = process.env.PYTHON || 'python3';

  return new Promise((resolve) => {
    const proc = spawn(pythonCommand, ['-c', PYTHON_SYNTAX_CHECK_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    let stdout = '';

    proc.stdin?.write(code);
    proc.stdin?.end();

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.on('error', (err) => {
      resolve({
        valid: false,
        error: `Failed to spawn ${pythonCommand}: ${err.message}`,
      });
    });

    proc.on('close', (exitCode) => {
      if (exitCode === 0) {
        resolve({ valid: true });
        return;
      }

      resolve({
        valid: false,
        error:
          stderr.trim() ||
          stdout.trim() ||
          `Python syntax validation failed with exit code ${exitCode}`,
      });
    });
  });
}

/**
 * Validate Python code syntax and throw an error if invalid.
 *
 * Convenience function for use in tests where you want to fail immediately on invalid syntax.
 *
 * @param code - The Python code to validate
 * @throws Error if the code has syntax errors
 *
 * @example
 * ```typescript
 * await assertValidPythonSyntax(generatedCode); // Throws if invalid
 * ```
 */
export async function assertValidPythonSyntax(code: string): Promise<void> {
  const result = await validatePythonSyntax(code);
  if (!result.valid) {
    throw new Error(`Invalid Python syntax:\n${result.error}`);
  }
}
