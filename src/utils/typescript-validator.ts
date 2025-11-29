/**
 * TypeScript syntax validation utility
 *
 * Validates generated TypeScript code using the TypeScript compiler API.
 */

import ts from 'typescript';

export interface TypeScriptValidationResult {
  valid: boolean;
  errors?: ts.Diagnostic[];
}

/**
 * Validate TypeScript code syntax using the TypeScript compiler.
 *
 * This function creates a source file and checks for syntax and semantic errors
 * without emitting any output files.
 *
 * @param code - The TypeScript code to validate
 * @param fileName - Optional filename for better error messages (default: 'generated.d.ts')
 * @returns Validation result with any diagnostic errors
 *
 * @example
 * ```typescript
 * const result = validateTypeScriptSyntax('export interface User { name: string; }');
 * if (!result.valid) {
 *   console.error('Errors:', result.errors);
 * }
 * ```
 */
export function validateTypeScriptSyntax(
  code: string,
  fileName = 'generated.d.ts',
): TypeScriptValidationResult {
  // Create a source file from the code
  const sourceFile = ts.createSourceFile(
    fileName,
    code,
    ts.ScriptTarget.Latest,
    true, // setParentNodes
    ts.ScriptKind.TS,
  );

  // Create a compiler host with minimal configuration
  const options: ts.CompilerOptions = {
    noEmit: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    strict: true,
    skipLibCheck: true,
  };

  // Create a program with just this one file
  const host = ts.createCompilerHost(options);
  const originalGetSourceFile = host.getSourceFile.bind(host);

  host.getSourceFile = (name, languageVersion) => {
    if (name === fileName) {
      return sourceFile;
    }
    return originalGetSourceFile(name, languageVersion);
  };

  const program = ts.createProgram([fileName], options, host);

  // Get all diagnostics (syntax + semantic)
  const diagnostics = [
    ...program.getSyntacticDiagnostics(sourceFile),
    ...program.getSemanticDiagnostics(sourceFile),
  ];

  if (diagnostics.length === 0) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: diagnostics,
  };
}

/**
 * Format TypeScript diagnostics into readable error messages.
 *
 * @param diagnostics - Array of TypeScript diagnostics
 * @returns Formatted error message string
 */
export function formatTypeScriptDiagnostics(diagnostics: ts.Diagnostic[]): string {
  return diagnostics
    .map((diagnostic) => {
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');

      if (diagnostic.file && diagnostic.start !== undefined) {
        const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        return `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`;
      }

      return message;
    })
    .join('\n');
}

/**
 * Validate TypeScript code syntax and throw an error if invalid.
 *
 * Convenience function for use in tests where you want to fail immediately on invalid syntax.
 *
 * @param code - The TypeScript code to validate
 * @param fileName - Optional filename for better error messages
 * @throws Error if the code has syntax or type errors
 *
 * @example
 * ```typescript
 * assertValidTypeScriptSyntax(generatedCode); // Throws if invalid
 * ```
 */
export function assertValidTypeScriptSyntax(code: string, fileName?: string): void {
  const result = validateTypeScriptSyntax(code, fileName);
  if (!result.valid) {
    const errorMessage = result.errors
      ? formatTypeScriptDiagnostics(result.errors)
      : 'Unknown TypeScript error';
    throw new Error(`Invalid TypeScript syntax:\n${errorMessage}`);
  }
}
