import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { convertZodToPydantic } from '../../src/index.js';
import { emitPydanticModel } from '../../src/core/emitters/pydantic.js';
import { visitZodSchema } from '../../src/core/ast/zod-visitor.js';
import type { VisitorWarning } from '../../src/core/ast/index.js';

describe('emitPydanticModel', () => {
  it('renders nested objects, regex constraints, and arrays', () => {
    const versionPattern = /^v\d{6}-\d{2}-\d+\.\d+\.\d+$/;
    const schema = z.object({
      version: z.string().regex(versionPattern),
      normalized: z.object({
        description: z.string(),
        description_tokens: z.array(z.string()),
      }),
    });

    const code = convertZodToPydantic(schema, { name: 'EnrichedTransactionSchema' }).trim();

    expect(code).toBe(
      [
        'from pydantic import BaseModel, constr',
        'from typing import List',
        '',
        'VERSION_REGEX = r"^v\\d{6}-\\d{2}-\\d+\\.\\d+\\.\\d+$"',
        '',
        'class EnrichedTransactionSchema(BaseModel):',
        '    class Normalized(BaseModel):',
        '        description: str',
        '        description_tokens: List[str]',
        '    version: constr(regex=VERSION_REGEX)',
        '    normalized: Normalized',
      ].join('\n'),
    );
  });

  it('handles defaults, optionals, and typed defaults', () => {
    const schema = z.object({
      id: z.string().uuid(),
      tags: z.array(z.string()).default([]),
      metadata: z.object({ flag: z.boolean() }).optional(),
      created_at: z.string().datetime().optional(),
    });

    const code = convertZodToPydantic(schema, { name: 'Sample' }).trim();

    expect(code).toBe(
      [
        'from pydantic import BaseModel, Field',
        'from typing import List, Optional',
        'from datetime import datetime',
        'from uuid import UUID',
        '',
        'class Sample(BaseModel):',
        '    class Metadata(BaseModel):',
        '        flag: bool',
        '    id: UUID',
        '    tags: List[str] = Field(default_factory=list)',
        '    metadata: Optional[Metadata] = None',
        '    created_at: Optional[datetime] = None',
      ].join('\n'),
    );
  });

  it('renders unions, literals, and constrained numbers', () => {
    const schema = z.object({
      status: z.enum(['pending', 'done']),
      payload: z.union([
        z.object({
          kind: z.literal('a'),
          value: z.number().positive(),
        }),
        z.object({
          kind: z.literal('b'),
          count: z.number().int().nonnegative(),
        }),
      ]),
    });

    const code = convertZodToPydantic(schema, { name: 'UnionExample' }).trim();

    expect(code).toBe(
      [
        'from pydantic import BaseModel, confloat, conint',
        'from typing import Literal, Union',
        '',
        'class UnionExample(BaseModel):',
        '    class PayloadOption0(BaseModel):',
        '        kind: Literal["a"]',
        '        value: confloat(gt=0)',
        '    class PayloadOption1(BaseModel):',
        '        kind: Literal["b"]',
        '        count: conint(ge=0)',
        '    status: Literal["pending", "done"]',
        '    payload: Union[PayloadOption0, PayloadOption1]',
      ].join('\n'),
    );
  });

  it('avoids collisions across multiple unions by prefixing option names', () => {
    const schema = z.object({
      payload: z.union([
        z.object({ kind: z.literal('a'), value: z.number() }),
        z.object({ kind: z.literal('b'), count: z.number() }),
      ]),
      other: z.union([
        z.object({ kind: z.literal('x'), data: z.string() }),
        z.object({ kind: z.literal('y'), flag: z.boolean() }),
      ]),
    });

    const code = convertZodToPydantic(schema, { name: 'MultiUnion' }).trim();

    expect(code).toContain('class PayloadOption0(BaseModel):');
    expect(code).toContain('class PayloadOption1(BaseModel):');
    expect(code).toContain('class OtherOption0(BaseModel):');
    expect(code).toContain('class OtherOption1(BaseModel):');
    expect(code).toContain('payload: Union[PayloadOption0, PayloadOption1]');
    expect(code).toContain('other: Union[OtherOption0, OtherOption1]');
  });

  it('throws error on class name collision', () => {
    // Create a schema where two different paths produce the same PascalCase name
    // "foo_bar" and "fooBar" both become "FooBar"
    const schema = z.object({
      foo_bar: z.object({
        value: z.string(),
      }),
      fooBar: z.object({
        value: z.number(),
      }),
    });

    expect(() => {
      convertZodToPydantic(schema, { name: 'CollisionTest' });
    }).toThrow(
      'Class name collision: "FooBar" already emitted. Path: fooBar. ' +
        'This can happen when different field paths produce the same PascalCase name (e.g., "foo_bar" and "fooBar").',
    );
  });

  it('generates warning for unmapped regex flags', () => {
    // Create a regex with unmapped flags (y, d)
    const regexWithUnmappedFlags = new RegExp('^test$', 'imy');
    const schema = z.object({
      field: z.string().regex(regexWithUnmappedFlags),
    });

    const { node, warnings: visitorWarnings } = visitZodSchema(schema);
    // Create a mutable array to track warnings added by emitter
    const allWarnings: VisitorWarning[] = [...visitorWarnings];

    // Call emitter directly - it will push warnings to the array
    emitPydanticModel(node, {
      name: 'RegexFlagTest',
      warnings: allWarnings,
    });

    // Check that a warning was added for unmapped flags
    const regexWarnings = allWarnings.filter(
      (w) => w.code === 'unsupported_effect' && w.message.includes('Regex flags'),
    );
    expect(regexWarnings.length).toBe(1);
    expect(regexWarnings[0]?.message).toContain('Regex flags');
    expect(regexWarnings[0]?.message).toContain('y');
    expect(regexWarnings[0]?.message).toContain('are not mapped to Python');
    expect(regexWarnings[0]?.path).toEqual(['field']);
  });
});
