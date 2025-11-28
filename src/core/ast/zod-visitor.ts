/**
 * Zod AST Visitor
 *
 * Walks Zod schemas and converts them to SchemaBridge's internal AST representation.
 * Supports both Zod 3 and Zod 4.
 */

import type { ZodTypeAny } from 'zod';

/**
 * Check if a schema is Zod 4 (has _zod property)
 */
function isZod4(schema: ZodTypeAny): boolean {
  return '_zod' in schema;
}

/**
 * Get the definition from a Zod schema (Zod 3 or 4 compatible)
 */
function getSchemaDef(schema: ZodTypeAny): unknown {
  if (isZod4(schema)) {
    return schema._zod.def;
  } else {
    // Zod 3 compatibility
    return (schema as { _def: unknown })._def;
  }
}

/**
 * SchemaBridge Internal AST Node Types
 * This is the intermediate representation between Zod and target languages
 */
export type SchemaNode =
  | { type: 'string'; constraints?: StringConstraints }
  | { type: 'number'; constraints?: NumberConstraints }
  | { type: 'int'; constraints?: IntConstraints }
  | { type: 'boolean' }
  | { type: 'date' }
  | { type: 'datetime' }
  | { type: 'uuid' }
  | { type: 'enum'; values: readonly string[] }
  | { type: 'literal'; value: unknown }
  | { type: 'object'; fields: Record<string, SchemaNode> }
  | { type: 'array'; element: SchemaNode }
  | { type: 'union'; options: SchemaNode[] }
  | { type: 'optional'; inner: SchemaNode }
  | { type: 'nullable'; inner: SchemaNode }
  | { type: 'nullish'; inner: SchemaNode }
  | { type: 'any' }
  | { type: 'unknown' }
  | { type: 'reference'; name: string }; // For schema references

export interface StringConstraints {
  minLength?: number;
  maxLength?: number;
  length?: number;
  regex?: RegExp | string;
}

export interface NumberConstraints {
  min?: number;
  max?: number;
  positive?: boolean;
  nonnegative?: boolean;
}

export interface IntConstraints {
  min?: number;
  max?: number;
  positive?: boolean;
  nonnegative?: boolean;
}

/**
 * Visit a Zod schema and convert it to SchemaBridge AST
 *
 * @param schema - Zod schema instance (Zod 3 or 4)
 * @returns SchemaBridge AST node
 */
export function visitZodSchema(schema: ZodTypeAny): SchemaNode {
  const def = getSchemaDef(schema);

  if (!def || typeof def !== 'object') {
    throw new Error('Invalid Zod schema definition');
  }

  const defObj = def as Record<string, unknown>;

  // Handle optional/nullable/nullish wrappers first
  if (defObj.type === 'optional') {
      const innerType = (defObj.innerType as ZodTypeAny) || schema;
      return {
        type: 'optional',
        inner: visitZodSchema(innerType),
      };
    }

    if (defObj.type === 'nullable') {
      const innerType = (defObj.innerType as ZodTypeAny) || schema;
      return {
        type: 'nullable',
        inner: visitZodSchema(innerType),
      };
    }

    if (defObj.type === 'nullish') {
      const innerType = (defObj.innerType as ZodTypeAny) || schema;
      return {
        type: 'nullish',
        inner: visitZodSchema(innerType),
      };
    }

  // Handle base types
  switch (defObj.type) {
    case 'string': {
      const constraints = extractStringConstraints(defObj);
      return constraints ? { type: 'string', constraints } : { type: 'string' };
    }

    case 'number': {
      const constraints = extractNumberConstraints(defObj);
      return constraints ? { type: 'number', constraints } : { type: 'number' };
    }

    case 'int':
    case 'integer': {
      const constraints = extractIntConstraints(defObj);
      return constraints ? { type: 'int', constraints } : { type: 'int' };
    }

    case 'boolean':
      return { type: 'boolean' };

    case 'date':
      return { type: 'date' };

    case 'datetime':
      return { type: 'datetime' };

    case 'uuid':
      return { type: 'uuid' };

    case 'enum': {
      const values = defObj.values as readonly string[];
      return { type: 'enum', values };
    }

    case 'literal': {
      const value = defObj.value;
      return { type: 'literal', value };
    }

    case 'object': {
      const shape = defObj.shape as Record<string, ZodTypeAny> | undefined;
      if (!shape) {
        throw new Error('Object schema missing shape');
      }

      const fields: Record<string, SchemaNode> = {};
      for (const [key, value] of Object.entries(shape)) {
        fields[key] = visitZodSchema(value);
      }

      return { type: 'object', fields };
    }

    case 'array': {
      const elementType = defObj.elementType as ZodTypeAny | undefined;
      if (!elementType) {
        throw new Error('Array schema missing elementType');
      }
      return {
        type: 'array',
        element: visitZodSchema(elementType),
      };
    }

    case 'union': {
      const options = (defObj.options as ZodTypeAny[]) || [];
      return {
        type: 'union',
        options: options.map((opt) => visitZodSchema(opt)),
      };
    }

    case 'any':
      return { type: 'any' };

    case 'unknown':
      return { type: 'unknown' };

    default:
      // Future-proof: warn but don't fail
      console.warn(`Unknown Zod schema type: ${String(defObj.type)}. Treating as 'any'.`);
      return { type: 'any' };
  }
}

/**
 * Extract string constraints from Zod definition
 */
function extractStringConstraints(def: Record<string, unknown>): StringConstraints | undefined {
  const checks = (def.checks as Array<{ kind: string; value?: unknown; regex?: RegExp | string }>) || [];
  if (checks.length === 0) {
    return undefined;
  }

  const constraints: StringConstraints = {};

  for (const check of checks) {
    switch (check.kind) {
      case 'min':
        constraints.minLength = check.value as number;
        break;
      case 'max':
        constraints.maxLength = check.value as number;
        break;
      case 'length':
        constraints.length = check.value as number;
        break;
      case 'regex':
        if (check.regex !== undefined) {
          constraints.regex = check.regex;
        }
        break;
    }
  }

  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Extract number constraints from Zod definition
 */
function extractNumberConstraints(def: Record<string, unknown>): NumberConstraints | undefined {
  const checks = (def.checks as Array<{ kind: string; value?: unknown }>) || [];
  if (checks.length === 0) {
    return undefined;
  }

  const constraints: NumberConstraints = {};

  for (const check of checks) {
    switch (check.kind) {
      case 'min':
        constraints.min = check.value as number;
        break;
      case 'max':
        constraints.max = check.value as number;
        break;
      case 'positive':
        constraints.positive = true;
        break;
      case 'nonnegative':
        constraints.nonnegative = true;
        break;
    }
  }

  return Object.keys(constraints).length > 0 ? constraints : undefined;
}

/**
 * Extract integer constraints from Zod definition
 */
function extractIntConstraints(def: Record<string, unknown>): IntConstraints | undefined {
  // Same as number constraints for now
  return extractNumberConstraints(def) as IntConstraints | undefined;
}

