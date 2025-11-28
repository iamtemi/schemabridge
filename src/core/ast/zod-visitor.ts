/**
 * Zod AST Visitor
 *
 * Walks Zod schemas and converts them to SchemaBridge's internal AST representation.
 * Supports both Zod 3 and Zod 4 (using the `_def` and `_zod.def` shapes respectively).
 */

import type { ZodTypeAny } from 'zod';

export type SchemaNode =
  | { type: 'string'; constraints?: StringConstraints }
  | { type: 'number'; constraints?: NumberConstraints }
  | { type: 'int'; constraints?: NumberConstraints }
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
  | { type: 'default'; inner: SchemaNode; defaultValue: unknown }
  | { type: 'any' }
  | { type: 'unknown' }
  | { type: 'reference'; name: string };

export interface StringConstraints {
  minLength?: number;
  maxLength?: number;
  length?: number;
  regex?: RegExp | string;
}

export interface NumberConstraints {
  min?: BoundConstraint;
  max?: BoundConstraint;
  positive?: boolean;
  nonnegative?: boolean;
}

interface BoundConstraint {
  value: number;
  inclusive: boolean;
}

export interface VisitorWarning {
  code: 'unsupported_effect' | 'unknown_type';
  path: string[];
  message: string;
}

export interface VisitResult {
  node: SchemaNode;
  warnings: VisitorWarning[];
}

/**
 * Visit a Zod schema and convert it to SchemaBridge AST.
 * @param schema - Zod schema instance (Zod 3 or 4)
 * @param path - path within the schema, used for warnings context
 */
export function visitZodSchema(schema: ZodTypeAny, path: string[] = []): VisitResult {
  const warnings: VisitorWarning[] = [];
  const node = walkSchema(schema, path, warnings);
  return { node, warnings };
}

function walkSchema(schema: ZodTypeAny, path: string[], warnings: VisitorWarning[]): SchemaNode {
  const def = getSchemaDef(schema);
  if (!def || typeof def !== 'object') {
    throw new Error('Invalid Zod schema definition');
  }

  const defObj = def as Record<string, unknown>;
  const typeName = normalizeTypeName(defObj);

  switch (typeName) {
    case 'optional':
    case 'ZodOptional': {
      const innerType = defObj.innerType as ZodTypeAny;
      return { type: 'optional', inner: walkSchema(innerType, path, warnings) };
    }
    case 'nullable':
    case 'ZodNullable': {
      const innerType = defObj.innerType as ZodTypeAny;
      return { type: 'nullable', inner: walkSchema(innerType, path, warnings) };
    }
    case 'nullish':
    case 'ZodNullish': {
      const innerType = defObj.innerType as ZodTypeAny;
      return { type: 'nullish', inner: walkSchema(innerType, path, warnings) };
    }
    case 'default':
    case 'ZodDefault': {
      const innerType = defObj.innerType as ZodTypeAny;
      const defaultValue =
        typeof defObj.defaultValue === 'function'
          ? (defObj.defaultValue as () => unknown)()
          : defObj.defaultValue;
      return {
        type: 'default',
        defaultValue,
        inner: walkSchema(innerType, path, warnings),
      };
    }
    case 'effects':
    case 'ZodEffects': {
      const effectType =
        (defObj.effect as { type?: string } | undefined)?.type ??
        (defObj.effects as Array<{ type?: string }> | undefined)?.[0]?.type;
      warnings.push({
        code: 'unsupported_effect',
        path,
        message: `Encountered Zod effect${effectType ? ` "${effectType}"` : ''}; using base schema shape.`,
      });
      const inner = (defObj.schema as ZodTypeAny) ?? (defObj.innerType as ZodTypeAny);
      return walkSchema(inner, path, warnings);
    }

    case 'pipe': {
      warnings.push({
        code: 'unsupported_effect',
        path,
        message: 'Encountered Zod pipeline; using input schema shape.',
      });
      const inner = (defObj.in as ZodTypeAny) ?? (defObj.schema as ZodTypeAny);
      return walkSchema(inner, path, warnings);
    }
  }

  switch (typeName) {
    case 'string':
    case 'ZodString': {
      const { constraints, inferredType } = extractStringConstraints(defObj);
      if (inferredType === 'uuid') return { type: 'uuid' };
      if (inferredType === 'date') return { type: 'date' };
      if (inferredType === 'datetime') return { type: 'datetime' };
      return constraints ? { type: 'string', constraints } : { type: 'string' };
    }
    case 'number':
    case 'ZodNumber': {
      const { constraints, isInt } = extractNumberConstraints(defObj);
      if (isInt) {
        return constraints ? { type: 'int', constraints } : { type: 'int' };
      }
      return constraints ? { type: 'number', constraints } : { type: 'number' };
    }
    case 'boolean':
    case 'ZodBoolean':
      return { type: 'boolean' };

    case 'date':
    case 'ZodDate':
      return { type: 'date' };

    case 'uuid':
      return { type: 'uuid' };

    case 'enum':
    case 'ZodEnum': {
      const values =
        (defObj.values as readonly string[]) ??
        (defObj.entries
          ? (Object.values(defObj.entries as Record<string, string>) as readonly string[])
          : undefined) ??
        [];
      return { type: 'enum', values };
    }

    case 'literal':
    case 'ZodLiteral': {
      const directValue = 'value' in defObj ? (defObj as { value: unknown }).value : undefined;
      const arrayValue =
        'values' in defObj && Array.isArray((defObj as { values: unknown }).values)
          ? (defObj as { values: unknown[] }).values[0]
          : undefined;
      const setValue =
        'values' in defObj && (defObj as { values: Set<unknown> }).values instanceof Set
          ? (defObj as { values: Set<unknown> }).values.values().next().value
          : undefined;

      return { type: 'literal', value: directValue ?? arrayValue ?? setValue };
    }

    case 'null':
    case 'ZodNull': {
      return { type: 'literal', value: null };
    }

    case 'object':
    case 'ZodObject': {
      const shapeGetter = defObj.shape as
        | (() => Record<string, ZodTypeAny>)
        | Record<string, ZodTypeAny>;
      const shape = typeof shapeGetter === 'function' ? shapeGetter() : shapeGetter;
      const fields: Record<string, SchemaNode> = {};
      for (const [key, value] of Object.entries(shape)) {
        fields[key] = walkSchema(value, [...path, key], warnings);
      }
      return { type: 'object', fields };
    }

    case 'array':
    case 'ZodArray': {
      const elementType =
        (defObj.element as ZodTypeAny) ??
        (defObj.type !== 'array' ? (defObj.type as ZodTypeAny) : undefined) ??
        (defObj.elementType as ZodTypeAny) ??
        (defObj.items as ZodTypeAny);
      if (!elementType) {
        throw new Error('Array schema missing element type');
      }
      return { type: 'array', element: walkSchema(elementType, [...path, '[element]'], warnings) };
    }

    case 'union':
    case 'ZodUnion': {
      const options = (defObj.options as ZodTypeAny[]) || [];
      return {
        type: 'union',
        options: options.map((opt, idx) => walkSchema(opt, [...path, `option${idx}`], warnings)),
      };
    }

    case 'ZodDiscriminatedUnion': {
      const optionsMap =
        (defObj.options as Map<string, ZodTypeAny>) ??
        (defObj.optionsMap as Map<string, ZodTypeAny>);
      const options = optionsMap ? Array.from(optionsMap.values()) : [];
      return {
        type: 'union',
        options: options.map((opt, idx) => walkSchema(opt, [...path, `option${idx}`], warnings)),
      };
    }

    case 'any':
    case 'ZodAny':
      return { type: 'any' };

    case 'unknown':
    case 'ZodUnknown':
      return { type: 'unknown' };

    default: {
      warnings.push({
        code: 'unknown_type',
        path,
        message: `Unknown or unsupported Zod schema type "${String(typeName)}"; defaulting to 'any'.`,
      });
      return { type: 'any' };
    }
  }
}

function isZod4(schema: ZodTypeAny): schema is ZodTypeAny & { _zod: { def: unknown } } {
  return typeof schema === 'object' && schema !== null && '_zod' in schema;
}

function getSchemaDef(schema: ZodTypeAny): unknown {
  if (isZod4(schema)) {
    return (schema as { _zod: { def: unknown } })._zod.def;
  }
  return (schema as { _def: unknown })._def;
}

function normalizeTypeName(def: Record<string, unknown>): string | undefined {
  const rawType = typeof def.type === 'string' ? def.type : undefined;
  if (rawType) return rawType;

  const rawTypeName =
    typeof def.typeName === 'string'
      ? def.typeName
      : typeof def.typeName === 'symbol'
        ? def.typeName.description
        : undefined;
  if (!rawTypeName) return undefined;

  if (rawTypeName.startsWith('Symbol(') && rawTypeName.endsWith(')')) {
    return rawTypeName.slice('Symbol('.length, -1);
  }
  return rawTypeName;
}

function extractStringConstraints(def: Record<string, unknown>): {
  constraints?: StringConstraints;
  inferredType?: 'uuid' | 'date' | 'datetime';
} {
  const checks = (def.checks as unknown[]) || [];
  const constraints: StringConstraints = {};
  let inferredType: 'uuid' | 'date' | 'datetime' | undefined;

  for (const check of checks) {
    const normalized = normalizeStringCheck(check);
    if (!normalized) continue;

    switch (normalized.kind) {
      case 'min':
        constraints.minLength = normalized.value;
        break;
      case 'max':
        constraints.maxLength = normalized.value;
        break;
      case 'length':
        constraints.length = normalized.value;
        break;
      case 'regex':
        constraints.regex = normalized.regex;
        break;
      case 'uuid':
        inferredType = 'uuid';
        break;
      case 'datetime':
        inferredType = 'datetime';
        break;
      case 'date':
        inferredType = 'date';
        break;
    }
  }

  const result: {
    constraints?: StringConstraints;
    inferredType?: 'uuid' | 'date' | 'datetime';
  } = {};
  if (Object.keys(constraints).length > 0) {
    result.constraints = constraints;
  }
  if (inferredType !== undefined) {
    result.inferredType = inferredType;
  }
  return result;
}

function extractNumberConstraints(def: Record<string, unknown>): {
  constraints?: NumberConstraints;
  isInt: boolean;
} {
  const checks = (def.checks as unknown[]) || [];
  const constraints: NumberConstraints = {};
  let isInt = false;

  for (const check of checks) {
    const normalized = normalizeNumberCheck(check);
    if (!normalized) continue;

    switch (normalized.kind) {
      case 'min':
        constraints.min = {
          value: normalized.value,
          inclusive: normalized.inclusive ?? true,
        };
        if (constraints.min.value === 0 && constraints.min.inclusive === false) {
          constraints.positive = true;
        }
        if (constraints.min.value === 0 && constraints.min.inclusive === true) {
          constraints.nonnegative = true;
        }
        break;
      case 'max':
        constraints.max = {
          value: normalized.value,
          inclusive: normalized.inclusive ?? true,
        };
        break;
      case 'int':
        isInt = true;
        break;
    }
  }

  const result: {
    constraints?: NumberConstraints;
    isInt: boolean;
  } = { isInt };
  if (Object.keys(constraints).length > 0) {
    result.constraints = constraints;
  }
  return result;
}

type NormalizedStringCheck =
  | { kind: 'min'; value: number }
  | { kind: 'max'; value: number }
  | { kind: 'length'; value: number }
  | { kind: 'regex'; regex: RegExp | string }
  | { kind: 'uuid' }
  | { kind: 'date' }
  | { kind: 'datetime' };

function normalizeStringCheck(raw: unknown): NormalizedStringCheck | null {
  if (!raw || typeof raw !== 'object') return null;

  if ('kind' in raw) {
    const legacy = raw as { kind: string; value?: unknown; regex?: RegExp | string };
    switch (legacy.kind) {
      case 'min':
        return { kind: 'min', value: legacy.value as number };
      case 'max':
        return { kind: 'max', value: legacy.value as number };
      case 'length':
        return { kind: 'length', value: legacy.value as number };
      case 'regex':
        return { kind: 'regex', regex: legacy.regex as RegExp | string };
      case 'uuid':
        return { kind: 'uuid' };
      case 'datetime':
        return { kind: 'datetime' };
      case 'date':
        return { kind: 'date' };
    }
  }

  const def =
    (raw as { _zod?: { def: Record<string, unknown> }; def?: Record<string, unknown> })._zod?.def ??
    (raw as { def?: Record<string, unknown> }).def;

  if (!def) return null;
  const checkType = def.check as string | undefined;

  switch (checkType) {
    case 'min_length':
      return { kind: 'min', value: def.minimum as number };
    case 'max_length':
      return { kind: 'max', value: def.maximum as number };
    case 'length_equals':
      return { kind: 'length', value: def.length as number };
    case 'string_format': {
      const format = def.format as string | undefined;
      if (format === 'regex' && def.pattern) {
        return { kind: 'regex', regex: def.pattern as RegExp | string };
      }
      if (format === 'uuid') return { kind: 'uuid' };
      if (format === 'datetime') return { kind: 'datetime' };
      if (format === 'date') return { kind: 'date' };
      return null;
    }
    default:
      return null;
  }
}

type NormalizedNumberCheck =
  | { kind: 'min'; value: number; inclusive?: boolean }
  | { kind: 'max'; value: number; inclusive?: boolean }
  | { kind: 'int' };

function normalizeNumberCheck(raw: unknown): NormalizedNumberCheck | null {
  if (!raw || typeof raw !== 'object') return null;

  if ('kind' in raw) {
    const legacy = raw as { kind: string; value?: unknown; inclusive?: boolean };
    switch (legacy.kind) {
      case 'min': {
        const result: NormalizedNumberCheck = { kind: 'min', value: legacy.value as number };
        if (legacy.inclusive !== undefined) {
          result.inclusive = legacy.inclusive;
        }
        return result;
      }
      case 'max': {
        const result: NormalizedNumberCheck = { kind: 'max', value: legacy.value as number };
        if (legacy.inclusive !== undefined) {
          result.inclusive = legacy.inclusive;
        }
        return result;
      }
      case 'int':
        return { kind: 'int' };
      case 'positive':
        return { kind: 'min', value: 0, inclusive: false };
      case 'nonnegative':
        return { kind: 'min', value: 0, inclusive: true };
    }
  }

  const defFromZ4 = (raw as { _zod?: { def: Record<string, unknown> } })._zod?.def;
  const defFromInstance = (raw as { def?: Record<string, unknown> }).def;
  const def = defFromZ4 ?? defFromInstance ?? undefined;

  if (def) {
    const checkType = def.check as string | undefined;
    switch (checkType) {
      case 'greater_than':
        return { kind: 'min', value: def.value as number, inclusive: def.inclusive as boolean };
      case 'less_than':
        return { kind: 'max', value: def.value as number, inclusive: def.inclusive as boolean };
      case 'number_format': {
        const format = def.format as string | undefined;
        if (format === 'int' || format === 'safeint') {
          return { kind: 'int' };
        }
        break;
      }
    }
  }

  if ((raw as { isInt?: boolean }).isInt === true) {
    return { kind: 'int' };
  }

  return null;
}
