import { cp, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const docsDir = resolve(repoRoot, 'packages/docs');
const sourceDir = resolve(docsDir, '.vercel');
const targetDir = resolve(repoRoot, '.vercel');

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function syncVercelOutput() {
  if (!(await pathExists(sourceDir))) {
    console.warn('[sync-vercel-output] Skipping copy; source .vercel directory does not exist yet.');
    return;
  }

  await rm(targetDir, { recursive: true, force: true });
  await cp(sourceDir, targetDir, { recursive: true });
  console.log(`[sync-vercel-output] Copied ${sourceDir} → ${targetDir}`);
}

await syncVercelOutput();
