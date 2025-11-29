import { z } from 'zod';

// Edge cases and boundary conditions

export const edgeCasesSchema = z.object({
  // Very deep nesting (5+ levels)
  level1: z.object({
    level2: z.object({
      level3: z.object({
        level4: z.object({
          level5: z.object({
            level6: z.object({
              value: z.string(),
            }),
          }),
        }),
      }),
    }),
  }),

  // Multiple unions in single object
  union1: z.union([z.string(), z.number()]),
  union2: z.union([
    z.object({ type: z.literal('a'), value: z.string() }),
    z.object({ type: z.literal('b'), count: z.number() }),
  ]),
  union3: z.union([z.array(z.string()), z.array(z.number()), z.array(z.boolean())]),

  // Arrays of unions
  arrayOfUnions: z.array(
    z.union([
      z.object({ kind: z.literal('x'), data: z.string() }),
      z.object({ kind: z.literal('y'), flag: z.boolean() }),
    ]),
  ),

  // Unions of arrays
  unionOfArrays: z.union([
    z.array(z.string()),
    z.array(z.number()),
    z.array(
      z.object({
        id: z.string(),
        value: z.number(),
      }),
    ),
  ]),

  // Complex optional/nullable chains
  optionalNullable: z.string().optional().nullable(),
  nullableOptional: z.string().nullable().optional(),
  nullishOptional: z.string().nullish().optional(),
  optionalNullish: z.string().optional().nullish(),
  tripleOptional: z.string().optional().nullable().nullish(),

  // Empty objects
  emptyObject: z.object({}),

  // Objects with only optional fields
  allOptional: z.object({
    field1: z.string().optional(),
    field2: z.number().optional(),
    field3: z.boolean().optional(),
    nested: z
      .object({
        inner: z.string().optional(),
      })
      .optional(),
  }),

  // Very long field names
  thisIsAVeryLongFieldNameThatTestsHowWeHandleLongIdentifiersInGeneratedCode: z.string(),
  anotherExtremelyLongFieldNameThatMightCauseIssuesWithCodeGenerationAndFormatting: z.number(),

  // All constraint combinations
  stringConstraints: z
    .string()
    .min(1)
    .max(1000)
    .regex(/^[a-z]+$/),
  numberConstraints: z.number().int().min(-100).max(100).positive().nonnegative(),

  // Complex nested arrays
  nestedArrays: z.array(
    z.array(
      z.array(
        z.object({
          value: z.string(),
        }),
      ),
    ),
  ),

  // Mixed optionality in nested structures
  complexNested: z
    .object({
      required: z.string(),
      optional: z.string().optional(),
      nullable: z.string().nullable(),
      nullish: z.string().nullish(),
      nested: z
        .object({
          inner: z.string().optional().nullable(),
        })
        .optional()
        .nullable(),
    })
    .optional(),

  // Arrays with complex element types
  arrayOfComplex: z.array(
    z.union([
      z.object({
        type: z.literal('simple'),
        value: z.string(),
      }),
      z.object({
        type: z.literal('complex'),
        data: z.object({
          nested: z.array(z.string()),
          metadata: z.any(),
        }),
      }),
    ]),
  ),

  // Default values with complex types
  defaultArray: z.array(z.string()).default([]),
  defaultObject: z.object({ key: z.string() }).default({ key: 'value' }),
  defaultNested: z
    .object({
      config: z
        .object({
          enabled: z.boolean().default(true),
        })
        .default({
          enabled: true,
        }),
    })
    .optional(),
});
