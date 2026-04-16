import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';

import { generateFilesFromZod } from '../../src/index.js';

const schema = z.object({
  id: z.string(),
  count: z.number().int(),
});

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'schemabridge-'));
const cleanupDirs: string[] = [];

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.length = 0;
});

describe('generateFilesFromZod', () => {
  it('writes pydantic file with appended extension when out has no ext', async () => {
    const tmp = await makeTempDir();
    cleanupDirs.push(tmp);
    const outBase = path.join(tmp, 'model');
    const result = await generateFilesFromZod({
      schema,
      name: 'Model',
      target: 'pydantic',
      out: outBase,
    });

    const expectedPath = `${outBase}.py`;
    expect(result).toEqual([{ path: expectedPath, target: 'pydantic' }]);
    const content = await fs.readFile(expectedPath, 'utf8');
    expect(content).toContain('class Model(BaseModel):');
  });

  it('writes both files to directory when target is all', async () => {
    const tmp = await makeTempDir();
    cleanupDirs.push(tmp);
    const result = await generateFilesFromZod({ schema, name: 'Model', target: 'all', out: tmp });

    const pyPath = path.join(tmp, 'Model.py');
    const dtsPath = path.join(tmp, 'Model.d.ts');
    expect(result).toEqual(
      expect.arrayContaining([
        { path: pyPath, target: 'pydantic' },
        { path: dtsPath, target: 'typescript' },
      ]),
    );
    expect(await fs.readFile(pyPath, 'utf8')).toContain('class Model(BaseModel):');
    expect(await fs.readFile(dtsPath, 'utf8')).toContain('export interface Model');
  });

  it('rejects when target all and out has extension', async () => {
    await expect(
      generateFilesFromZod({ schema, name: 'Model', target: 'all', out: 'model.py' }),
    ).rejects.toThrow(/must be a directory/i);
  });

  it('generates files for comprehensive schema', async () => {
    const tmp = await makeTempDir();
    cleanupDirs.push(tmp);
    const comprehensiveSchema = z.object({
      name: z.string(),
      nested: z.object({
        value: z.number(),
        deep: z.object({
          data: z.string(),
        }),
      }),
    });

    const result = await generateFilesFromZod({
      schema: comprehensiveSchema,
      name: 'Comprehensive',
      target: 'all',
      out: tmp,
    });

    expect(result.length).toBe(2);
    const pyPath = path.join(tmp, 'Comprehensive.py');
    const dtsPath = path.join(tmp, 'Comprehensive.d.ts');
    expect(result).toEqual(
      expect.arrayContaining([
        { path: pyPath, target: 'pydantic' },
        { path: dtsPath, target: 'typescript' },
      ]),
    );
    expect(await fs.readFile(pyPath, 'utf8')).toContain('class Comprehensive(BaseModel):');
    expect(await fs.readFile(dtsPath, 'utf8')).toContain('export interface Comprehensive');
  });
});
