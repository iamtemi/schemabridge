import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { convertFolder } from '../../src/index.js';

const sourceDir = path.resolve('tests/fixtures/folder-structure');

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'schemabridge-folder-'));
const cleanupDirs: string[] = [];

afterEach(async () => {
  while (cleanupDirs.length > 0) {
    const dir = cleanupDirs.pop();
    if (!dir) continue;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

describe('convertFolder init population', () => {
  it('populates __init__.py files for structured outputs', async () => {
    const outDir = await makeTempDir();
    cleanupDirs.push(outDir);

    await convertFolder({
      sourceDir,
      outDir,
      target: 'pydantic',
      preserveStructure: true,
      generateInitFiles: true,
    });

    const rootInit = await fs.readFile(path.join(outDir, '__init__.py'), 'utf8');
    expect(rootInit).toContain('from .accounts import UserAccountSchema, AddressSchema');
    expect(rootInit).toContain('from .inventory import ProductSchema');
    expect(rootInit).toContain('__all__ = ["UserAccountSchema", "AddressSchema", "ProductSchema"]');

    const accountsInit = await fs.readFile(path.join(outDir, 'accounts', '__init__.py'), 'utf8');
    expect(accountsInit).toContain('from .user_account_schema import UserAccountSchema');
    expect(accountsInit).toContain('from .nested import AddressSchema');
    expect(accountsInit).toContain('__all__ = ["UserAccountSchema", "AddressSchema"]');

    const nestedInit = await fs.readFile(
      path.join(outDir, 'accounts', 'nested', '__init__.py'),
      'utf8',
    );
    expect(nestedInit).toContain('from .address_schema import AddressSchema');
    expect(nestedInit).toContain('__all__ = ["AddressSchema"]');
  });

  it('populates __init__.py files for flat outputs', async () => {
    const outDir = await makeTempDir();
    cleanupDirs.push(outDir);

    await convertFolder({
      sourceDir,
      outDir,
      target: 'pydantic',
      preserveStructure: false,
      generateInitFiles: true,
    });

    const rootInit = await fs.readFile(path.join(outDir, '__init__.py'), 'utf8');
    expect(rootInit).toContain('from .address_schema import AddressSchema');
    expect(rootInit).toContain('from .product_schema import ProductSchema');
    expect(rootInit).toContain('from .user_account_schema import UserAccountSchema');
    expect(rootInit).toContain('__all__ = ["AddressSchema", "ProductSchema", "UserAccountSchema"]');
  });
});
