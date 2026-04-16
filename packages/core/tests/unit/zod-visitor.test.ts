import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { visitZodSchema } from '../../src/core/ast/zod-visitor.js';

describe('visitZodSchema', () => {
  it('captures string constraints', () => {
    const { node, warnings } = visitZodSchema(z.string().min(2).max(5).regex(/abc/));

    expect(warnings).toHaveLength(0);
    expect(node).toEqual({
      type: 'string',
      constraints: {
        minLength: 2,
        maxLength: 5,
        regex: /abc/,
      },
    });
  });

  it('detects uuid and date/datetime specializations', () => {
    const uuidResult = visitZodSchema(z.string().uuid());
    expect(uuidResult.node).toEqual({ type: 'uuid' });

    const dateResult = visitZodSchema(z.date());
    expect(dateResult.node).toEqual({ type: 'date' });

    const datetimeResult = visitZodSchema(z.string().datetime());
    expect(datetimeResult.node).toEqual({ type: 'datetime' });
  });

  it('detects z.uuid() directly (Zod v4)', () => {
    const result = visitZodSchema(z.uuid());
    expect(result.node).toEqual({ type: 'uuid' });
    expect(result.warnings).toHaveLength(0);
  });

  it('detects z.int() directly (Zod v4)', () => {
    const result = visitZodSchema(z.int());
    expect(result.node).toEqual({ type: 'int' });
    expect(result.warnings).toHaveLength(0);
  });

  it('distinguishes z.date() from z.iso.date()', () => {
    // z.date() validates Date objects
    const dateResult = visitZodSchema(z.date());
    expect(dateResult.node).toEqual({ type: 'date' });

    // z.iso.date() validates ISO date strings
    const isoDateResult = visitZodSchema(z.iso.date());
    expect(isoDateResult.node).toEqual({ type: 'isodate' });
  });

  it('detects z.iso.datetime() correctly', () => {
    const result = visitZodSchema(z.iso.datetime());
    expect(result.node).toEqual({ type: 'datetime' });
    expect(result.warnings).toHaveLength(0);
  });

  it('detects z.string().datetime() correctly', () => {
    const result = visitZodSchema(z.string().datetime());
    expect(result.node).toEqual({ type: 'datetime' });
    expect(result.warnings).toHaveLength(0);
  });

  it('detects new Zod v4 string formats', () => {
    expect(visitZodSchema(z.ipv4()).node).toEqual({ type: 'ipv4' });
    expect(visitZodSchema(z.ipv6()).node).toEqual({ type: 'ipv6' });
    expect(visitZodSchema(z.iso.time()).node).toEqual({ type: 'time' });
    expect(visitZodSchema(z.iso.duration()).node).toEqual({ type: 'duration' });
  });

  it('handles all date/datetime variants in objects', () => {
    const schema = z.object({
      dateObj: z.date(), // Date object
      isoDate: z.iso.date(), // ISO date string
      isoDatetime: z.iso.datetime(), // ISO datetime string
      stringDatetime: z.string().datetime(), // String datetime
    });

    const { node, warnings } = visitZodSchema(schema);
    expect(warnings).toHaveLength(0);
    expect(node).toEqual({
      type: 'object',
      fields: {
        dateObj: { type: 'date' },
        isoDate: { type: 'isodate' },
        isoDatetime: { type: 'datetime' },
        stringDatetime: { type: 'datetime' },
      },
    });
  });

  it('captures number and int constraints', () => {
    const intResult = visitZodSchema(z.number().int().min(1).max(10));
    expect(intResult.node).toEqual({
      type: 'int',
      constraints: {
        min: { value: 1, inclusive: true },
        max: { value: 10, inclusive: true },
      },
    });

    const positiveResult = visitZodSchema(z.number().positive());
    expect(positiveResult.node).toEqual({
      type: 'number',
      constraints: {
        min: { value: 0, inclusive: false },
        positive: true,
      },
    });
  });

  it('handles objects with optional and nullable fields', () => {
    const schema = z.object({
      id: z.string().uuid(),
      nickname: z.string().optional(),
      metadata: z.object({ flag: z.boolean() }).nullable(),
    });

    const { node, warnings } = visitZodSchema(schema);

    expect(warnings).toHaveLength(0);
    expect(node).toEqual({
      type: 'object',
      fields: {
        id: { type: 'uuid' },
        nickname: { type: 'optional', inner: { type: 'string' } },
        metadata: {
          type: 'nullable',
          inner: {
            type: 'object',
            fields: {
              flag: { type: 'boolean' },
            },
          },
        },
      },
    });
  });

  it('wraps defaults around inner nodes', () => {
    const { node, warnings } = visitZodSchema(z.string().default('abc'));

    expect(warnings).toHaveLength(0);
    expect(node).toEqual({
      type: 'default',
      defaultValue: 'abc',
      inner: { type: 'string' },
    });
  });

  it('represents unions', () => {
    const { node } = visitZodSchema(z.union([z.literal('a'), z.number()]));

    expect(node).toEqual({
      type: 'union',
      options: [{ type: 'literal', value: 'a' }, { type: 'number' }],
    });
  });

  it('emits warnings for effects but preserves inner shape', () => {
    const { node, warnings } = visitZodSchema(
      z.object({
        score: z.number().transform((value) => value + 1),
      }),
    );

    expect(node).toEqual({
      type: 'object',
      fields: {
        score: { type: 'number' },
      },
    });
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'unsupported_effect',
        path: ['score'],
      }),
    ]);
  });

  it('falls back to any with warning for unsupported schema types', () => {
    const { node, warnings } = visitZodSchema(z.never());

    expect(node).toEqual({ type: 'any' });
    expect(warnings).toEqual([
      expect.objectContaining({
        code: 'unknown_type',
        path: [],
      }),
    ]);
  });
});
