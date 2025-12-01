import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const BUNDLED_CLI = path.resolve('bin/schemabridge.js');
const fixture = path.resolve('tests/fixtures/simple-schema.ts');
const cleanupDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'schemabridge-bundled-'));
  cleanupDirs.push(dir);
  return dir;
};

let bundledCliExists = false;

beforeAll(async () => {
  try {
    await fs.access(BUNDLED_CLI);
    bundledCliExists = true;
  } catch {
    bundledCliExists = false;
  }
});

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.length = 0;
});

describe('Bundled CLI (bin/schemabridge.js)', () => {
  it('should exist and be a valid file', async () => {
    if (!bundledCliExists) {
      expect.fail('Bundled CLI not found. Run `pnpm build` first.');
    }
    const stats = await fs.stat(BUNDLED_CLI);
    expect(stats.isFile()).toBe(true);
    // Note: We don't check execute bit since we run it with `node` explicitly
    // The file just needs to exist and be readable
  });

  it('should show help when --help is passed', () => {
    if (!bundledCliExists) {
      expect.fail('Bundled CLI not found. Run `pnpm build` first.');
    }
    try {
      execSync(`node ${BUNDLED_CLI} --help`, { encoding: 'utf8', stdio: 'pipe' });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      const output = error.stderr?.toString() || error.message || '';
      expect(output).toContain('Usage:');
      expect(output).toContain('convert zod');
      expect(output).toContain('convert folder');
    }
  });

  it('should convert a single schema to pydantic', async () => {
    if (!bundledCliExists) {
      expect.fail('Bundled CLI not found. Run `pnpm build` first.');
    }
    const tmp = await makeTempDir();
    const outPath = path.join(tmp, 'model.py');

    execSync(
      `node ${BUNDLED_CLI} convert zod ${fixture} --export userSchema --to pydantic --out ${outPath}`,
      { encoding: 'utf8' },
    );

    const content = await fs.readFile(outPath, 'utf8');
    expect(content).toContain('class UserSchema(BaseModel):');
    expect(content).toContain('name: str');
    expect(content).toMatch(/age:\s*(int|conint\(\))/);
    expect(content).toMatch(/from pydantic import.*BaseModel/);
  });

  it('should convert a single schema to typescript', async () => {
    if (!bundledCliExists) {
      expect.fail('Bundled CLI not found. Run `pnpm build` first.');
    }
    const tmp = await makeTempDir();
    const outPath = path.join(tmp, 'model.d.ts');

    execSync(
      `node ${BUNDLED_CLI} convert zod ${fixture} --export userSchema --to typescript --out ${outPath}`,
      { encoding: 'utf8' },
    );

    const content = await fs.readFile(outPath, 'utf8');
    expect(content).toContain('export interface UserSchema');
    expect(content).toContain('name: string;');
    expect(content).toContain('age: number;');
  });

  it('should convert folder with --flat flag', async () => {
    if (!bundledCliExists) {
      expect.fail('Bundled CLI not found. Run `pnpm build` first.');
    }
    const tmp = await makeTempDir();
    const sourceDir = path.resolve('tests/fixtures');
    const outDir = path.join(tmp, 'output');

    execSync(
      `node ${BUNDLED_CLI} convert folder ${sourceDir} --out ${outDir} --to pydantic --flat`,
      { encoding: 'utf8' },
    );

    // Check that files were created
    const files = await fs.readdir(outDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('.py'))).toBe(true);
  });

  it('should handle errors gracefully', () => {
    if (!bundledCliExists) {
      expect.fail('Bundled CLI not found. Run `pnpm build` first.');
    }
    try {
      execSync(`node ${BUNDLED_CLI} convert zod nonexistent.ts --export test`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      // Should have an error message
      const output = error.stderr?.toString() || error.message || '';
      expect(output.length).toBeGreaterThan(0);
    }
  });
});
