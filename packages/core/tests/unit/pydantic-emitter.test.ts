import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { convertZodToPydantic } from '../../src/index.js';
import { emitPydanticModel } from '../../src/core/emitters/pydantic.js';
import { visitZodSchema } from '../../src/core/ast/zod-visitor.js';
import type { VisitorWarning } from '../../src/core/ast/index.js';
import { assertValidPythonSyntax } from '../../src/utils/python-validator.js';

describe('emitPydanticModel', () => {
  it('renders nested objects, regex constraints, and arrays', async () => {
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
        '    version: constr(pattern=VERSION_REGEX)',
        '    normalized: Normalized',
      ].join('\n'),
    );

    // Validate syntax
    await assertValidPythonSyntax(code);
  });

  it('handles defaults, optionals, and typed defaults', async () => {
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

    // Validate syntax
    await assertValidPythonSyntax(code);
  });

  it('handles z.uuid() directly (Zod v4)', async () => {
    const schema = z.object({
      id: z.uuid(),
    });

    const code = convertZodToPydantic(schema, { name: 'UuidTest' }).trim();

    expect(code).toContain('from uuid import UUID');
    expect(code).toContain('id: UUID');
    await assertValidPythonSyntax(code);
  });

  it('handles z.int() directly (Zod v4)', async () => {
    const schema = z.object({
      count: z.int(),
    });

    const code = convertZodToPydantic(schema, { name: 'IntTest' }).trim();

    expect(code).toContain('from pydantic import BaseModel, conint');
    expect(code).toContain('count: conint()');
    await assertValidPythonSyntax(code);
  });

  it('distinguishes z.date() from z.iso.date()', async () => {
    const schema = z.object({
      dateObj: z.date(),
      isoDate: z.iso.date(),
    });

    const code = convertZodToPydantic(schema, { name: 'DateTest' }).trim();

    expect(code).toContain('from datetime import date');
    expect(code).toContain('dateObj: date');
    expect(code).toContain('isoDate: date'); // Both map to Python date
    await assertValidPythonSyntax(code);
  });

  it('handles z.iso.datetime() and z.string().datetime()', async () => {
    const schema = z.object({
      isoDatetime: z.iso.datetime(),
      stringDatetime: z.string().datetime(),
    });

    const code = convertZodToPydantic(schema, { name: 'DatetimeTest' }).trim();

    expect(code).toContain('from datetime import datetime');
    expect(code).toContain('isoDatetime: datetime');
    expect(code).toContain('stringDatetime: datetime');
    await assertValidPythonSyntax(code);
  });

  it('handles new Zod v4 string formats', async () => {
    const schema = z.object({
      ipv4: z.ipv4(),
      ipv6: z.ipv6(),
      time: z.iso.time(),
      duration: z.iso.duration(),
    });

    const code = convertZodToPydantic(schema, { name: 'FormatTest' }).trim();

    expect(code).toContain('from ipaddress import IPv4Address, IPv6Address');
    expect(code).toContain('from datetime import time, timedelta');
    expect(code).toContain('ipv4: IPv4Address');
    expect(code).toContain('ipv6: IPv6Address');
    expect(code).toContain('time: time');
    expect(code).toContain('duration: timedelta');
    await assertValidPythonSyntax(code);
  });

  it('renders unions, literals, and constrained numbers', async () => {
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

    const code = convertZodToPydantic(schema, {
      name: 'UnionExample',
      enumStyle: 'literal',
    }).trim();

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

    // Validate syntax
    await assertValidPythonSyntax(code);
  });

  it('avoids collisions across multiple unions by prefixing option names', async () => {
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

    // Validate syntax
    await assertValidPythonSyntax(code);
  });

  it('disambiguates colliding paths by using full path naming', async () => {
    const schema = z.object({
      foo_bar: z.object({
        value: z.string(),
      }),
      fooBar: z.object({
        value: z.number(),
      }),
    });

    const code = convertZodToPydantic(schema, { name: 'CollisionTest' }).trim();
    expect(code).toContain('class FooBar(BaseModel):');
    expect(code).toContain('class FooBar2(BaseModel):');

    // Validate syntax
    await assertValidPythonSyntax(code);
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

describe('Enum support', () => {
  it('converts standalone enum to Python Enum class', async () => {
    const schema = z.enum(['active', 'inactive', 'suspended']);

    const code = convertZodToPydantic(schema, { name: 'StatusEnum' }).trim();

    expect(code).toBe(
      [
        'from enum import Enum',
        '',
        'class StatusEnum(str, Enum):',
        '    ACTIVE = "active"',
        '    INACTIVE = "inactive"',
        '    SUSPENDED = "suspended"',
      ].join('\n'),
    );

    await assertValidPythonSyntax(code);
  });

  it('generates enum classes for enum fields in objects (default enumStyle)', async () => {
    const schema = z.object({
      status: z.enum(['pending', 'done', 'cancelled']),
      currency: z.enum(['USD', 'EUR', 'GBP']),
    });

    const code = convertZodToPydantic(schema, { name: 'OrderSchema' }).trim();

    expect(code).toContain('from enum import Enum');
    expect(code).toContain('class StatusEnum(str, Enum):');
    expect(code).toContain('    PENDING = "pending"');
    expect(code).toContain('class CurrencyEnum(str, Enum):');
    expect(code).toContain('    USD = "USD"');
    expect(code).toContain('status: StatusEnum');
    expect(code).toContain('currency: CurrencyEnum');

    await assertValidPythonSyntax(code);
  });

  it('uses Literal types when enumStyle is literal (backward compatible)', async () => {
    const schema = z.object({
      status: z.enum(['pending', 'done']),
    });

    const code = convertZodToPydantic(schema, { name: 'OrderSchema', enumStyle: 'literal' }).trim();

    expect(code).not.toContain('from enum import Enum');
    expect(code).not.toContain('class StatusEnum');
    expect(code).toContain('from typing import Literal');
    expect(code).toContain('status: Literal["pending", "done"]');

    await assertValidPythonSyntax(code);
  });

  it('references same enum class when enum values match', async () => {
    const schema = z.object({
      status1: z.enum(['active', 'inactive']),
      status2: z.enum(['active', 'inactive']), // Same values
    });

    const code = convertZodToPydantic(schema, { name: 'TestSchema' }).trim();

    // Should only generate one enum class
    const enumClassMatches = code.match(/class \w+Enum\(str, Enum\):/g);
    expect(enumClassMatches?.length).toBe(1);

    // Both fields should reference the same enum
    expect(code).toMatch(/status1: \w+Enum/);
    expect(code).toMatch(/status2: \w+Enum/);
    const status1Match = code.match(/status1: (\w+Enum)/);
    const status2Match = code.match(/status2: (\w+Enum)/);
    expect(status1Match?.[1]).toBe(status2Match?.[1]);

    await assertValidPythonSyntax(code);
  });

  it('generates separate enum classes for different enum values', async () => {
    const schema = z.object({
      status: z.enum(['active', 'inactive']),
      role: z.enum(['admin', 'user']),
    });

    const code = convertZodToPydantic(schema, { name: 'TestSchema' }).trim();

    expect(code).toContain('class StatusEnum(str, Enum):');
    expect(code).toContain('class RoleEnum(str, Enum):');
    expect(code).toContain('status: StatusEnum');
    expect(code).toContain('role: RoleEnum');

    await assertValidPythonSyntax(code);
  });

  it('supports enumBaseType option', async () => {
    const schema = z.enum(['one', 'two', 'three']);

    const code = convertZodToPydantic(schema, { name: 'NumberEnum', enumBaseType: 'int' }).trim();

    expect(code).toContain('class NumberEnum(int, Enum):');

    await assertValidPythonSyntax(code);
  });

  it('handles enum member name sanitization for special characters', async () => {
    const schema = z.enum(['value-1', 'value_2', 'value 3']);

    const code = convertZodToPydantic(schema, { name: 'TestEnum' }).trim();

    expect(code).toContain('VALUE_1 = "value-1"');
    expect(code).toContain('VALUE_2 = "value_2"');
    expect(code).toContain('VALUE_3 = "value 3"');

    await assertValidPythonSyntax(code);
  });

  it('handles optional enum fields', async () => {
    const schema = z.object({
      status: z.enum(['active', 'inactive']).optional(),
    });

    const code = convertZodToPydantic(schema, { name: 'TestSchema' }).trim();

    expect(code).toContain('from typing import Optional');
    expect(code).toContain('status: Optional[StatusEnum]');

    await assertValidPythonSyntax(code);
  });
});
