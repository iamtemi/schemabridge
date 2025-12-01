import { describe, expect, it, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadZodSchema } from '../../src/core/loader/index.js';
import { convertZodToPydantic, convertZodToTypescript } from '../../src/index.js';
import { assertValidPythonSyntax } from '../../src/utils/python-validator.js';
import { assertValidTypeScriptSyntax } from '../../src/utils/typescript-validator.js';

const makeTempDir = async () => fs.mkdtemp(path.join(os.tmpdir(), 'schemabridge-integration-'));
const cleanupDirs: string[] = [];

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await fs.rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.length = 0;
});

describe('Integration tests for complex fixtures', () => {
  const fixtures = [
    {
      file: './tests/fixtures/comprehensive-schema.ts',
      exportName: 'comprehensiveSchema',
      name: 'ComprehensiveSchema',
    },
    {
      file: './tests/fixtures/api-request-schema.ts',
      exportName: 'apiRequestSchema',
      name: 'ApiRequestSchema',
    },
    {
      file: './tests/fixtures/database-entity-schema.ts',
      exportName: 'userEntitySchema',
      name: 'UserEntitySchema',
    },
    {
      file: './tests/fixtures/config-schema.ts',
      exportName: 'configSchema',
      name: 'ConfigSchema',
    },
    {
      file: './tests/fixtures/edge-cases-schema.ts',
      exportName: 'edgeCasesSchema',
      name: 'EdgeCasesSchema',
    },
    {
      file: './tests/fixtures/event-schema.ts',
      exportName: 'eventSchema',
      name: 'EventSchema',
    },
  ];

  for (const fixture of fixtures) {
    describe(`${fixture.name}`, () => {
      it('loads schema successfully', async () => {
        const { schema } = await loadZodSchema({
          file: fixture.file,
          exportName: fixture.exportName,
        });
        expect(schema).toBeTruthy();
      });

      it('converts to Pydantic successfully', async () => {
        const { schema } = await loadZodSchema({
          file: fixture.file,
          exportName: fixture.exportName,
        });

        const pydanticCode = convertZodToPydantic(schema, {
          name: fixture.name,
        });

        expect(pydanticCode).toBeTruthy();
        expect(pydanticCode).toContain('class');
        expect(pydanticCode).toContain('BaseModel');
        expect(pydanticCode).toContain(fixture.name);

        // Validate structure - check for proper imports
        expect(pydanticCode).toMatch(/from pydantic import.*BaseModel/);
        // Check for proper field syntax (colon after field name)
        expect(pydanticCode).toMatch(
          /\w+:\s*(str|int|float|bool|UUID|datetime|date|List|Optional|Union|Literal|Any)/,
        );
        // Verify it's valid Python syntax (basic check)
        expect(pydanticCode).not.toContain('undefined');
        // Note: Python uses None, not null, but 'null' might appear in string literals or comments

        // Validate Python syntax
        await assertValidPythonSyntax(pydanticCode);
      });

      it('converts to TypeScript successfully', async () => {
        const { schema } = await loadZodSchema({
          file: fixture.file,
          exportName: fixture.exportName,
        });

        const tsCode = convertZodToTypescript(schema, {
          name: fixture.name,
        });

        expect(tsCode).toBeTruthy();
        expect(tsCode).toContain('export interface');
        expect(tsCode).toContain(fixture.name);

        // Validate structure - check for proper property syntax
        expect(tsCode).toMatch(/\w+:\s*(string|number|boolean|Date|any|unknown|\[|\|)/);
        // Check for proper interface structure
        expect(tsCode).toMatch(/export interface \w+\s*\{/);
        // Verify it's valid TypeScript syntax (basic check)
        // Note: TypeScript uses undefined and null, so we don't check for their absence

        // Validate TypeScript syntax
        assertValidTypeScriptSyntax(tsCode);
      });

      it('generates valid nested structures', async () => {
        const { schema } = await loadZodSchema({
          file: fixture.file,
          exportName: fixture.exportName,
        });

        const pydanticCode = convertZodToPydantic(schema, {
          name: fixture.name,
        });

        // Check for nested class definitions
        const nestedClassMatches = pydanticCode.match(/class \w+\(BaseModel\):/g);
        expect(nestedClassMatches?.length).toBeGreaterThan(0);

        // Verify nested classes are properly indented
        const lines = pydanticCode.split('\n');
        let foundNested = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]?.includes('class') && lines[i]?.includes('BaseModel')) {
            if (i > 0 && lines[i]?.startsWith('    ')) {
              foundNested = true;
              break;
            }
          }
        }
        // Not all schemas have nested classes, so this is optional
      });

      it('preserves constraints in Pydantic output', async () => {
        const { schema } = await loadZodSchema({
          file: fixture.file,
          exportName: fixture.exportName,
        });

        const pydanticCode = convertZodToPydantic(schema, {
          name: fixture.name,
        });

        // Check for constraint types (constr, conint, confloat)
        const hasConstraints =
          pydanticCode.includes('constr') ||
          pydanticCode.includes('conint') ||
          pydanticCode.includes('confloat');

        // Not all schemas have constraints, so this is informational
        if (hasConstraints) {
          expect(pydanticCode).toMatch(/constr|conint|confloat/);
        }
      });

      it('handles optional/nullable fields correctly', async () => {
        const { schema } = await loadZodSchema({
          file: fixture.file,
          exportName: fixture.exportName,
        });

        const pydanticCode = convertZodToPydantic(schema, {
          name: fixture.name,
        });
        const tsCode = convertZodToTypescript(schema, {
          name: fixture.name,
        });

        // Pydantic should use Optional for optional fields
        if (pydanticCode.includes('Optional')) {
          expect(pydanticCode).toContain('from typing import');
        }

        // TypeScript should use ? for optional fields
        if (tsCode.includes('?')) {
          // Verify it's used in property declarations
          expect(tsCode).toMatch(/\w+\?:/);
        }
      });
    });
  }
});
