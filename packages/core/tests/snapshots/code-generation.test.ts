/**
 * Snapshot tests for code generation
 *
 * These tests capture the generated output for all fixtures and detect regressions
 * by comparing against stored snapshots. When output intentionally changes,
 * update snapshots with: pnpm test:snapshots -- -u
 */

import { describe, it, expect } from 'vitest';
import { convertZodToPydantic, convertZodToTypescript } from '../../src/index.js';
import { assertValidPythonSyntax } from '../../src/utils/python-validator.js';
import { assertValidTypeScriptSyntax } from '../../src/utils/typescript-validator.js';

// Import all fixtures
import { userSchema as simpleSchema } from '../fixtures/simple-schema.js';
import { comprehensiveSchema } from '../fixtures/comprehensive-schema.js';
import { edgeCasesSchema } from '../fixtures/edge-cases-schema.js';
import { apiRequestSchema } from '../fixtures/api-request-schema.js';
import { userEntitySchema as databaseEntitySchema } from '../fixtures/database-entity-schema.js';
import { configSchema } from '../fixtures/config-schema.js';
import { eventSchema } from '../fixtures/event-schema.js';

describe('Pydantic Code Generation Snapshots', () => {
  it('generates consistent output for simple schema', async () => {
    const code = convertZodToPydantic(simpleSchema, { name: 'SimpleSchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for comprehensive schema', async () => {
    const code = convertZodToPydantic(comprehensiveSchema, { name: 'ComprehensiveSchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for edge cases schema', async () => {
    const code = convertZodToPydantic(edgeCasesSchema, { name: 'EdgeCasesSchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for API request schema', async () => {
    const code = convertZodToPydantic(apiRequestSchema, { name: 'ApiRequestSchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for database entity schema', async () => {
    const code = convertZodToPydantic(databaseEntitySchema, { name: 'DatabaseEntitySchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for config schema', async () => {
    const code = convertZodToPydantic(configSchema, { name: 'ConfigSchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for event schema', async () => {
    const code = convertZodToPydantic(eventSchema, { name: 'EventSchema' });
    await assertValidPythonSyntax(code);
    expect(code).toMatchSnapshot();
  });
});

describe('TypeScript Code Generation Snapshots', () => {
  it('generates consistent output for simple schema', () => {
    const code = convertZodToTypescript(simpleSchema, { name: 'SimpleSchema' });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for comprehensive schema', () => {
    const code = convertZodToTypescript(comprehensiveSchema, {
      name: 'ComprehensiveSchema',
    });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for edge cases schema', () => {
    const code = convertZodToTypescript(edgeCasesSchema, { name: 'EdgeCasesSchema' });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for API request schema', () => {
    const code = convertZodToTypescript(apiRequestSchema, { name: 'ApiRequestSchema' });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for database entity schema', () => {
    const code = convertZodToTypescript(databaseEntitySchema, {
      name: 'DatabaseEntitySchema',
    });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for config schema', () => {
    const code = convertZodToTypescript(configSchema, { name: 'ConfigSchema' });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });

  it('generates consistent output for event schema', () => {
    const code = convertZodToTypescript(eventSchema, { name: 'EventSchema' });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });
});

describe('TypeScript Generation with Export Name Overrides', () => {
  it('generates consistent output with export name overrides', () => {
    const code = convertZodToTypescript(comprehensiveSchema, {
      name: 'RootSchema',
      exportNameOverrides: {
        nested: 'CustomNestedType',
        'deeply.nested': 'DeepType',
      },
    });
    assertValidTypeScriptSyntax(code);
    expect(code).toMatchSnapshot();
  });
});
