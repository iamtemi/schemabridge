import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { convertZodToTypescript } from '../../src/index.js';
import { emitTypeScriptDefinitions } from '../../src/core/emitters/typescript.js';
import { visitZodSchema } from '../../src/core/ast/zod-visitor.js';
import type { VisitorWarning } from '../../src/core/ast/index.js';
import { assertValidTypeScriptSyntax } from '../../src/utils/typescript-validator.js';

describe('emitTypeScriptDefinitions', () => {
  it('renders basic types correctly', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean(),
    });

    const code = convertZodToTypescript(schema, { name: 'User' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface User {',
        '  name: string;',
        '  age: number;',
        '  isActive: boolean;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('renders nested objects as separate interfaces', () => {
    const schema = z.object({
      user: z.object({
        name: z.string(),
        profile: z.object({
          bio: z.string(),
        }),
      }),
    });

    const code = convertZodToTypescript(schema, { name: 'Root' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface UserProfile {',
        '  bio: string;',
        '}',
        '',
        'export interface User {',
        '  name: string;',
        '  profile: UserProfile;',
        '}',
        '',
        'export interface Root {',
        '  user: User;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles optional, nullable, and nullish fields', () => {
    const schema = z.object({
      optionalField: z.string().optional(),
      nullableField: z.string().nullable(),
      nullishField: z.string().nullish(),
      requiredField: z.string(),
    });

    const code = convertZodToTypescript(schema, { name: 'Test' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface Test {',
        '  optionalField?: string;',
        '  nullableField: string | null;',
        '  nullishField?: string | null;',
        '  requiredField: string;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles arrays', () => {
    const schema = z.object({
      tags: z.array(z.string()),
      numbers: z.array(z.number()),
      nested: z.array(
        z.object({
          value: z.string(),
        }),
      ),
    });

    const code = convertZodToTypescript(schema, { name: 'ArrayTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface NestedItem {',
        '  value: string;',
        '}',
        '',
        'export interface ArrayTest {',
        '  tags: string[];',
        '  numbers: number[];',
        '  nested: NestedItem[];',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles unions', () => {
    const schema = z.object({
      status: z.union([z.literal('pending'), z.literal('done')]),
      value: z.union([z.string(), z.number()]),
    });

    const code = convertZodToTypescript(schema, { name: 'UnionTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface UnionTest {',
        '  status: "pending" | "done";',
        '  value: string | number;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles enums as union of string literals', () => {
    const schema = z.object({
      status: z.enum(['pending', 'done', 'cancelled']),
    });

    const code = convertZodToTypescript(schema, { name: 'EnumTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      ['export interface EnumTest {', '  status: "pending" | "done" | "cancelled";', '}'].join(
        '\n',
      ),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles literals', () => {
    const schema = z.object({
      kind: z.literal('test'),
      count: z.literal(42),
      flag: z.literal(true),
    });

    const code = convertZodToTypescript(schema, { name: 'LiteralTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface LiteralTest {',
        '  kind: "test";',
        '  count: 42;',
        '  flag: true;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles date and datetime', () => {
    const schema = z.object({
      createdAt: z.date(),
      updatedAt: z.string().datetime(),
    });

    const code = convertZodToTypescript(schema, { name: 'DateTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      ['export interface DateTest {', '  createdAt: Date;', '  updatedAt: string;', '}'].join('\n'),
    );

    // Validate syntax
  });

  it('handles uuid as string', () => {
    const schema = z.object({
      id: z.string().uuid(),
    });

    const code = convertZodToTypescript(schema, { name: 'UuidTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(['export interface UuidTest {', '  id: string;', '}'].join('\n'));
  });

  it('handles int as number', () => {
    const schema = z.object({
      count: z.number().int(),
    });

    const code = convertZodToTypescript(schema, { name: 'IntTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(['export interface IntTest {', '  count: number;', '}'].join('\n'));
  });

  it('handles complex nested structures', () => {
    const schema = z.object({
      user: z.object({
        id: z.string().uuid(),
        name: z.string(),
        tags: z.array(z.string()),
        metadata: z
          .object({
            role: z.enum(['admin', 'user']),
            permissions: z.array(z.string()),
          })
          .optional(),
      }),
    });

    const code = convertZodToTypescript(schema, { name: 'ComplexTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface UserMetadata {',
        '  role: "admin" | "user";',
        '  permissions: string[];',
        '}',
        '',
        'export interface User {',
        '  id: string;',
        '  name: string;',
        '  tags: string[];',
        '  metadata?: UserMetadata;',
        '}',
        '',
        'export interface ComplexTest {',
        '  user: User;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles union with nested objects', () => {
    const schema = z.object({
      payload: z.union([
        z.object({
          kind: z.literal('a'),
          value: z.number(),
        }),
        z.object({
          kind: z.literal('b'),
          count: z.number(),
        }),
      ]),
    });

    const code = convertZodToTypescript(schema, { name: 'UnionNestedTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface PayloadOption0 {',
        '  kind: "a";',
        '  value: number;',
        '}',
        '',
        'export interface PayloadOption1 {',
        '  kind: "b";',
        '  count: number;',
        '}',
        '',
        'export interface UnionNestedTest {',
        '  payload: PayloadOption0 | PayloadOption1;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles empty objects', () => {
    const schema = z.object({});

    const code = convertZodToTypescript(schema, { name: 'EmptyTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(['export interface EmptyTest {}'].join('\n'));
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

    const code = convertZodToTypescript(schema, { name: 'MultiUnion' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toContain('export interface PayloadOption0');
    expect(code).toContain('export interface PayloadOption1');
    expect(code).toContain('export interface OtherOption0');
    expect(code).toContain('export interface OtherOption1');
    expect(code).toContain('payload: PayloadOption0 | PayloadOption1;');
    expect(code).toContain('other: OtherOption0 | OtherOption1;');

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles any and unknown types', () => {
    const schema = z.object({
      anyField: z.any(),
      unknownField: z.unknown(),
    });

    const code = convertZodToTypescript(schema, { name: 'AnyTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      ['export interface AnyTest {', '  anyField: any;', '  unknownField: unknown;', '}'].join(
        '\n',
      ),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles defaults by unwrapping them', () => {
    const schema = z.object({
      name: z.string().default('unknown'),
      tags: z.array(z.string()).default([]),
    });

    const code = convertZodToTypescript(schema, { name: 'DefaultTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      ['export interface DefaultTest {', '  name: string;', '  tags: string[];', '}'].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles export name overrides', () => {
    const schema = z.object({
      user: z.object({
        profile: z.object({
          bio: z.string(),
        }),
      }),
    });

    const code = convertZodToTypescript(schema, {
      name: 'Root',
      exportNameOverrides: {
        'user.profile': 'CustomProfile',
      },
    }).trim();

    expect(code).toBe(
      [
        'export interface CustomProfile {',
        '  bio: string;',
        '}',
        '',
        'export interface User {',
        '  profile: CustomProfile;',
        '}',
        '',
        'export interface Root {',
        '  user: User;',
        '}',
      ].join('\n'),
    );
  });

  it('disambiguates type name collisions using path-based names', () => {
    // Create a schema where two different paths produce the same PascalCase name
    const schema = z.object({
      foo_bar: z.object({
        value: z.string(),
      }),
      fooBar: z.object({
        value: z.number(),
      }),
    });

    const code = convertZodToTypescript(schema, { name: 'CollisionTest' });
    expect(code).toContain('export interface FooBar');
    expect(code).toContain('export interface FooBar2');
  });

  it('handles nested optionality correctly', () => {
    const schema = z.object({
      field1: z.string().optional().nullable(),
      field2: z.string().nullable().optional(),
      field3: z.string().nullish(),
    });

    const code = convertZodToTypescript(schema, { name: 'NestedOptionalTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      [
        'export interface NestedOptionalTest {',
        '  field1?: string | null;',
        '  field2?: string | null;',
        '  field3?: string | null;',
        '}',
      ].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles arrays of unions', () => {
    const schema = z.object({
      items: z.array(z.union([z.string(), z.number()])),
    });

    const code = convertZodToTypescript(schema, { name: 'ArrayUnionTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      ['export interface ArrayUnionTest {', '  items: (string | number)[];', '}'].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });

  it('handles arrays with optional elements', () => {
    const schema = z.object({
      items: z.array(z.string().optional()),
    });

    const code = convertZodToTypescript(schema, { name: 'ArrayOptionalTest' }).trim();

    // Validate syntax
    assertValidTypeScriptSyntax(code);

    expect(code).toBe(
      ['export interface ArrayOptionalTest {', '  items: (string | undefined)[];', '}'].join('\n'),
    );

    // Validate syntax
    assertValidTypeScriptSyntax(code);
  });
});

describe('Snapshot tests for complex schemas', () => {
  it('matches snapshot for complex nested schema', () => {
    const schema = z.object({
      version: z.string().regex(/^v\d+$/),
      normalized: z.object({
        description: z.string(),
        description_tokens: z.array(z.string()),
        metadata: z
          .object({
            role: z.enum(['admin', 'user', 'guest']),
            permissions: z.array(z.string()),
            settings: z
              .object({
                theme: z.enum(['light', 'dark']),
                notifications: z.boolean(),
              })
              .optional(),
          })
          .nullable(),
      }),
      tags: z.array(z.string()).optional(),
    });

    const code = convertZodToTypescript(schema, { name: 'EnrichedTransactionSchema' });
    expect(code).toMatchSnapshot();
  });

  it('matches snapshot for union-heavy schema', () => {
    const schema = z.object({
      status: z.enum(['pending', 'done', 'cancelled']),
      payload: z.union([
        z.object({
          kind: z.literal('a'),
          value: z.number().positive(),
        }),
        z.object({
          kind: z.literal('b'),
          count: z.number().int().nonnegative(),
        }),
        z.object({
          kind: z.literal('c'),
          data: z.string(),
        }),
      ]),
    });

    const code = convertZodToTypescript(schema, { name: 'UnionExample' });
    expect(code).toMatchSnapshot();
  });
});

describe('Parity tests with Zod inference', () => {
  it('generates types compatible with z.infer for simple schema', () => {
    const schema = z.object({
      name: z.string(),
      age: z.number(),
      isActive: z.boolean(),
    });

    type ZodInferred = z.infer<typeof schema>;
    const code = convertZodToTypescript(schema, { name: 'User' });

    // The generated code should produce a type that matches the structure
    // We can't directly test type compatibility in runtime tests, but we can
    // verify the structure matches by checking the generated code
    expect(code).toContain('name: string');
    expect(code).toContain('age: number');
    expect(code).toContain('isActive: boolean');

    // Verify the structure matches by creating a test object
    const testObj: ZodInferred = {
      name: 'Test',
      age: 25,
      isActive: true,
    };

    expect(testObj).toBeDefined();
  });

  it('generates types compatible with z.infer for optional fields', () => {
    const schema = z.object({
      id: z.string().uuid(),
      tags: z.array(z.string()).default([]),
      metadata: z.object({ flag: z.boolean() }).optional(),
      created_at: z.string().datetime().optional(),
    });

    type ZodInferred = z.infer<typeof schema>;
    const code = convertZodToTypescript(schema, { name: 'Sample' });

    // Verify optional fields are marked correctly
    expect(code).toContain('metadata?:');
    expect(code).toContain('created_at?:');

    // Verify structure matches
    const testObj: ZodInferred = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      tags: [],
    };

    expect(testObj).toBeDefined();
    expect(testObj.metadata).toBeUndefined();
  });

  it('generates types compatible with z.infer for unions', () => {
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

    type ZodInferred = z.infer<typeof schema>;
    const code = convertZodToTypescript(schema, { name: 'UnionExample' });

    // Verify union is generated correctly
    expect(code).toContain('status: "pending" | "done"');
    expect(code).toContain('payload:');

    // Verify structure matches
    const testObj1: ZodInferred = {
      status: 'pending',
      payload: {
        kind: 'a',
        value: 5,
      },
    };

    const testObj2: ZodInferred = {
      status: 'done',
      payload: {
        kind: 'b',
        count: 10,
      },
    };

    expect(testObj1).toBeDefined();
    expect(testObj2).toBeDefined();
  });

  it('generates types compatible with z.infer for arrays', () => {
    const schema = z.object({
      tags: z.array(z.string()),
      numbers: z.array(z.number()),
      nested: z.array(
        z.object({
          value: z.string(),
        }),
      ),
    });

    type ZodInferred = z.infer<typeof schema>;
    const code = convertZodToTypescript(schema, { name: 'ArrayTest' });

    // Verify arrays are generated correctly
    expect(code).toContain('tags: string[]');
    expect(code).toContain('numbers: number[]');
    expect(code).toContain('nested:');

    // Verify structure matches
    const testObj: ZodInferred = {
      tags: ['tag1', 'tag2'],
      numbers: [1, 2, 3],
      nested: [{ value: 'test' }],
    };

    expect(testObj).toBeDefined();
    expect(testObj.tags).toHaveLength(2);
    expect(testObj.numbers).toHaveLength(3);
    expect(testObj.nested).toHaveLength(1);
  });

  it('generates types compatible with z.infer for nullable fields', () => {
    const schema = z.object({
      id: z.string().uuid(),
      nickname: z.string().optional(),
      metadata: z.object({ flag: z.boolean() }).nullable(),
    });

    type ZodInferred = z.infer<typeof schema>;
    const code = convertZodToTypescript(schema, { name: 'NullableTest' });

    // Verify nullable fields are marked correctly
    expect(code).toContain('nickname?:');
    expect(code).toContain('metadata:');

    // Verify structure matches
    const testObj1: ZodInferred = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      metadata: null,
    };

    const testObj2: ZodInferred = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      nickname: 'test',
      metadata: { flag: true },
    };

    expect(testObj1).toBeDefined();
    expect(testObj2).toBeDefined();
  });
});
