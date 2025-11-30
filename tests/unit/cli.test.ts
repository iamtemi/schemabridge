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

  describe('enum flags', () => {
    const enumFixture = path.resolve('examples/source/common/enums.ts');

    it('converts standalone enum with default enum style', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        enumFixture,
        '--export',
        'statusEnum',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'status.py'),
      ]);

      expect(code).toBe(0);
      const content = await fs.readFile(path.join(tmp, 'status.py'), 'utf8');
      expect(content).toContain('from enum import Enum');
      expect(content).toContain('class StatusEnum(str, Enum):');
      expect(content).toContain('ACTIVE = "active"');
    });

    it('uses literal style when --enum-style literal is specified', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        enumFixture,
        '--export',
        'statusEnum',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'status.py'),
        '--enum-style',
        'literal',
      ]);

      expect(code).toBe(0);
      const content = await fs.readFile(path.join(tmp, 'status.py'), 'utf8');
      expect(content).not.toContain('from enum import Enum');
      expect(content).not.toContain('class StatusEnum');
      expect(content).toContain('from typing import Literal');
      expect(content).toContain('Literal["active", "inactive", "suspended"]');
    });

    it('uses int base type when --enum-base-type int is specified', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        enumFixture,
        '--export',
        'statusEnum',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'status.py'),
        '--enum-base-type',
        'int',
      ]);

      expect(code).toBe(0);
      const content = await fs.readFile(path.join(tmp, 'status.py'), 'utf8');
      expect(content).toContain('class StatusEnum(int, Enum):');
    });

    it('works with folder conversion and enum flags', async () => {
      const tmp = await makeTempDir();
      const enumDir = path.resolve('examples/source/common');
      const code = await runCLI([
        'convert',
        'folder',
        enumDir,
        '--out',
        tmp,
        '--to',
        'pydantic',
        '--flat',
        '--enum-style',
        'enum',
        '--enum-base-type',
        'str',
      ]);

      expect(code).toBe(0);
      const statusContent = await fs.readFile(path.join(tmp, 'status_enum.py'), 'utf8');
      expect(statusContent).toContain('class StatusEnum(str, Enum):');
    });

    it('fails with invalid enum-style value', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        enumFixture,
        '--export',
        'statusEnum',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'status.py'),
        '--enum-style',
        'invalid',
      ]);

      expect(code).not.toBe(0);
    });

    it('fails with invalid enum-base-type value', async () => {
      const tmp = await makeTempDir();
      const code = await runCLI([
        'convert',
        'zod',
        enumFixture,
        '--export',
        'statusEnum',
        '--to',
        'pydantic',
        '--out',
        path.join(tmp, 'status.py'),
        '--enum-base-type',
        'invalid',
      ]);

      expect(code).not.toBe(0);
    });
  });
});
