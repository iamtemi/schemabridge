import type { ZodType } from 'zod';

export function looksLikeZodSchema(value: unknown): value is ZodType {
  if (!value || typeof value !== 'object') return false;
  return (
    '_def' in (value as Record<string, unknown>) || '_zod' in (value as Record<string, unknown>)
  );
}

let tsLoaderPromise: Promise<unknown> | null = null;
export async function ensureTsLoader(): Promise<void> {
  if (tsLoaderPromise) {
    await tsLoaderPromise;
    return;
  }
  tsLoaderPromise = import('tsx/esm').catch((err) => {
    tsLoaderPromise = null;
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to register TypeScript loader (tsx). Install "tsx" as a dependency or precompile schemas. ${message}`,
    );
  });
  await tsLoaderPromise;
}
