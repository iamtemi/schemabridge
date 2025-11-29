import { describe, expect, it } from 'vitest';
import { loadZodSchema, SchemaLoadError } from '../../src/core/loader/index.js';
import { ZodType } from 'zod';

const fixturePath = './tests/fixtures/simple-schema.ts';
const importedFixture = './tests/fixtures/imported/root.ts';

describe('loadZodSchema', () => {
  it('loads a named export Zod schema', async () => {
    const schema = await loadZodSchema({ file: fixturePath, exportName: 'userSchema' });
    expect(schema).toBeTruthy();
    expect((schema as ZodType).parse({ name: 'Jane', age: 30 })).toEqual({
      name: 'Jane',
      age: 30,
    });
  });

  it('throws when export is missing', async () => {
    await expect(loadZodSchema({ file: fixturePath, exportName: 'missing' })).rejects.toThrow(
      SchemaLoadError,
    );
  });

  it('throws when export is not a Zod schema', async () => {
    await expect(loadZodSchema({ file: fixturePath, exportName: 'notASchema' })).rejects.toThrow(
      SchemaLoadError,
    );
  });

  it('loads comprehensive schema', async () => {
    const schema = await loadZodSchema({
      file: './tests/fixtures/comprehensive-schema.ts',
      exportName: 'comprehensiveSchema',
    });
    expect(schema).toBeTruthy();
  });

  it('loads API request schema', async () => {
    const schema = await loadZodSchema({
      file: './tests/fixtures/api-request-schema.ts',
      exportName: 'apiRequestSchema',
    });
    expect(schema).toBeTruthy();
  });

  it('loads database entity schema', async () => {
    const schema = await loadZodSchema({
      file: './tests/fixtures/database-entity-schema.ts',
      exportName: 'userEntitySchema',
    });
    expect(schema).toBeTruthy();
  });

  it('loads config schema', async () => {
    const schema = await loadZodSchema({
      file: './tests/fixtures/config-schema.ts',
      exportName: 'configSchema',
    });
    expect(schema).toBeTruthy();
  });

  it('loads edge cases schema', async () => {
    const schema = await loadZodSchema({
      file: './tests/fixtures/edge-cases-schema.ts',
      exportName: 'edgeCasesSchema',
    });
    expect(schema).toBeTruthy();
  });

  it('loads event schema', async () => {
    const schema = await loadZodSchema({
      file: './tests/fixtures/event-schema.ts',
      exportName: 'eventSchema',
    });
    expect(schema).toBeTruthy();
  });

  it('resolves schemas that import other files when ts loader is registered', async () => {
    const schema = await loadZodSchema({
      file: importedFixture,
      exportName: 'importedSchema',
      registerTsLoader: true,
    });
    expect(schema).toBeTruthy();
    expect(
      (schema as ZodType).parse({
        id: '123e4567-e89b-12d3-a456-426614174000',
        metadata: { source: 'api', tags: [] },
      }),
    ).toBeTruthy();
  });
});
