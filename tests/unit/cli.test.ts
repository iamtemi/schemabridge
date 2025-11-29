import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { runCLI } from '../../src/cli/index.js';

const fixture = path.resolve('tests/fixtures/simple-schema.ts');
const complexFixture = path.resolve('tests/fixtures/enriched-transaction.ts');
const comprehensiveFixture = path.resolve('tests/fixtures/comprehensive-schema.ts');
const apiRequestFixture = path.resolve('tests/fixtures/api-request-schema.ts');
const databaseEntityFixture = path.resolve('tests/fixtures/database-entity-schema.ts');
const configFixture = path.resolve('tests/fixtures/config-schema.ts');
const edgeCasesFixture = path.resolve('tests/fixtures/edge-cases-schema.ts');
const eventFixture = path.resolve('tests/fixtures/event-schema.ts');
const cleanupDirs: string[] = [];

const makeTempDir = async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'schemabridge-cli-'));
  cleanupDirs.push(dir);
  return dir;
};

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.length = 0;
  vi.restoreAllMocks();
});

describe('CLI runCLI', () => {
  it('writes output for pydantic target', async () => {
    const tmp = await makeTempDir();
    const outPath = path.join(tmp, 'model.py');
    const code = await runCLI([
      'convert',
      'zod',
      fixture,
      '--export',
      'userSchema',
      '--to',
      'pydantic',
      '--out',
      outPath,
    ]);

    expect(code).toBe(0);
    const content = await fs.readFile(outPath, 'utf8');
    // Validate exact structure, not just presence
    expect(content).toContain('class UserSchema(BaseModel):');
    expect(content).toContain('name: str');
    expect(content).toMatch(/age:\s*(int|conint\(\))/); // int() becomes conint() in Pydantic
    expect(content).toMatch(/from pydantic import.*BaseModel/);
  });

  it('writes output for typescript target', async () => {
    const tmp = await makeTempDir();
    const outPath = path.join(tmp, 'model.d.ts');
    const code = await runCLI([
      'convert',
      'zod',
      fixture,
      '--export',
      'userSchema',
      '--to',
      'typescript',
      '--out',
      outPath,
    ]);

    expect(code).toBe(0);
    const content = await fs.readFile(outPath, 'utf8');
    // Validate exact structure
    expect(content).toContain('export interface UserSchema');
    expect(content).toContain('name: string;');
    expect(content).toContain('age: number;');
  });

  it('writes both outputs when target is all and out is a directory', async () => {
    const tmp = await makeTempDir();
    const code = await runCLI([
      'convert',
      'zod',
      fixture,
      '--export',
      'userSchema',
      '--to',
      'all',
      '--out',
      tmp,
    ]);

    expect(code).toBe(0);
    const pyContent = await fs.readFile(path.join(tmp, 'userSchema.py'), 'utf8');
    const tsContent = await fs.readFile(path.join(tmp, 'userSchema.d.ts'), 'utf8');
    expect(pyContent).toContain('class UserSchema(BaseModel):');
    expect(tsContent).toContain('export interface UserSchema');
  });

  it('defaults to pydantic when --to is omitted', async () => {
    const tmp = await makeTempDir();
    const outPath = path.join(tmp, 'default');
    const code = await runCLI([
      'convert',
      'zod',
      fixture,
      '--export',
      'userSchema',
      '--out',
      outPath,
    ]);

    expect(code).toBe(0);
    const content = await fs.readFile(`${outPath}.py`, 'utf8');
    expect(content).toContain('class UserSchema(BaseModel):');
  });

  it('supports --allow-unresolved flag parsing', async () => {
    const tmp = await makeTempDir();
    const outPath = path.join(tmp, 'model.py');
    const code = await runCLI([
      'convert',
      'zod',
      fixture,
      '--export',
      'userSchema',
      '--allow-unresolved',
      '--out',
      outPath,
    ]);

    expect(code).toBe(0);
  });

  it('handles complex schema end-to-end with --to all', async () => {
    const tmp = await makeTempDir();
    const code = await runCLI([
      'convert',
      'zod',
      complexFixture,
      '--export',
      'enrichedTransactionSchema',
      '--to',
      'all',
      '--out',
      tmp,
    ]);

    expect(code).toBe(0);
    const pyContent = await fs.readFile(path.join(tmp, 'enrichedTransactionSchema.py'), 'utf8');
    const tsContent = await fs.readFile(path.join(tmp, 'enrichedTransactionSchema.d.ts'), 'utf8');
    expect(pyContent).toContain('class EnrichedTransactionSchema(BaseModel):');
    expect(pyContent).toContain('class StatusOption0');
    expect(pyContent).toContain('class StatusOption1');
    expect(tsContent).toContain('export interface EnrichedTransactionSchema');
    expect(tsContent).toContain('status: StatusOption0 | StatusOption1;');
  });

  it('fails with helpful error when using --to all with file out', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runCLI([
      'convert',
      'zod',
      fixture,
      '--export',
      'userSchema',
      '--to',
      'all',
      '--out',
      'model.py',
    ]);

    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/must be a directory/i));
  });

  it('fails when export is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runCLI(['convert', 'zod', fixture, '--export', 'missingExport']);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/not found/));
  });

  it('fails when export is not a Zod schema', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runCLI(['convert', 'zod', fixture, '--export', 'notASchema']);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringMatching(/not a Zod schema/));
  });

  it('fails on unknown option', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const code = await runCLI(['convert', 'zod', fixture, '--export', 'userSchema', '--unknown']);
    expect(code).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  describe('Complex fixture schemas', () => {
    it('handles comprehensive schema with all features', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        comprehensiveFixture,
        '--export',
        'comprehensiveSchema',
        '--to',
        'all',
        '--out',
        tmp,
      ]);

      expect(code).toBe(0);
      const pyContent = await fs.readFile(path.join(tmp, 'comprehensiveSchema.py'), 'utf8');
      const tsContent = await fs.readFile(path.join(tmp, 'comprehensiveSchema.d.ts'), 'utf8');
      expect(pyContent).toContain('class ComprehensiveSchema(BaseModel):');
      expect(pyContent).toContain('class Address(BaseModel):');
      expect(pyContent).toContain('class PaymentOption0(BaseModel):');
      expect(tsContent).toContain('export interface ComprehensiveSchema');
      expect(tsContent).toContain('payment: PaymentOption0 | PaymentOption1 | PaymentOption2;');
    });

    it('handles API request schema', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        apiRequestFixture,
        '--export',
        'apiRequestSchema',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'api.py'),
      ]);

      expect(code).toBe(0);
      const content = await fs.readFile(path.join(tmp, 'api.py'), 'utf8');
      expect(content).toContain('class ApiRequestSchema(BaseModel):');
      expect(content).toContain('class BodyOption0(BaseModel):');
    });

    it('handles database entity schema', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        databaseEntityFixture,
        '--export',
        'userEntitySchema',
        '--to',
        'typescript',
        '--out',
        path.join(tmp, 'user.d.ts'),
      ]);

      expect(code).toBe(0);
      const content = await fs.readFile(path.join(tmp, 'user.d.ts'), 'utf8');
      expect(content).toContain('export interface UserEntitySchema');
      expect(content).toContain('organization?: Organization;');
    });

    it('handles config schema', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        configFixture,
        '--export',
        'configSchema',
        '--to',
        'all',
        '--out',
        tmp,
      ]);

      expect(code).toBe(0);
      const pyContent = await fs.readFile(path.join(tmp, 'configSchema.py'), 'utf8');
      const tsContent = await fs.readFile(path.join(tmp, 'configSchema.d.ts'), 'utf8');
      expect(pyContent).toContain('class ConfigSchema(BaseModel):');
      expect(pyContent).toContain('class Server(BaseModel):');
      expect(tsContent).toContain('export interface ConfigSchema');
    });

    it('handles edge cases schema', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        edgeCasesFixture,
        '--export',
        'edgeCasesSchema',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'edge.py'),
      ]);

      expect(code).toBe(0);
      const content = await fs.readFile(path.join(tmp, 'edge.py'), 'utf8');
      expect(content).toContain('class EdgeCasesSchema(BaseModel):');
      expect(content).toContain('class Level1(BaseModel):');
    });

    it('handles event schema with discriminated unions', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        eventFixture,
        '--export',
        'eventSchema',
        '--to',
        'all',
        '--out',
        tmp,
      ]);

      expect(code).toBe(0);
      const pyContent = await fs.readFile(path.join(tmp, 'eventSchema.py'), 'utf8');
      const tsContent = await fs.readFile(path.join(tmp, 'eventSchema.d.ts'), 'utf8');
      expect(pyContent).toContain('class EventSchema(BaseModel):');
      expect(pyContent).toContain('class PayloadOption0(BaseModel):');
      expect(tsContent).toContain('export interface EventSchema');
      expect(tsContent).toContain(
        'payload: PayloadOption0 | PayloadOption1 | PayloadOption2 | PayloadOption3;',
      );
    });
  });
});
