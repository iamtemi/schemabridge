/**
 * Zod AST Visitor
 *
 * Walks Zod schemas and converts them to SchemaBridge's internal AST representation.
 * Supports both Zod 3 and Zod 4 (using the `_def` and `_zod.def` shapes respectively).
 */

import type { ZodType } from 'zod';

export type SchemaNode =
  | { type: 'string'; constraints?: StringConstraints }
  | { type: 'number'; constraints?: NumberConstraints }
  | { type: 'int'; constraints?: NumberConstraints }
  | { type: 'boolean' }
  | { type: 'date' }
  | { type: 'isodate' }
  | { type: 'datetime' }
  | { type: 'uuid' }
  | { type: 'ipv4' }
  | { type: 'ipv6' }
  | { type: 'time' }
  | { type: 'duration' }
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

type InferredStringType = 'uuid' | 'isodate' | 'datetime' | 'ipv4' | 'ipv6' | 'time' | 'duration';

/**
 * Visit a Zod schema and convert it to SchemaBridge AST.
 * @param schema - Zod schema instance (Zod 3 or 4)
 * @param path - path within the schema, used for warnings context
 */
export function visitZodSchema(schema: ZodType, path: string[] = []): VisitResult {
  const warnings: VisitorWarning[] = [];
  const node = walkSchema(schema, path, warnings);
  return { node, warnings };
}

function walkSchema(schema: unknown, path: string[], warnings: VisitorWarning[]): SchemaNode {
  if (isPrimitiveLiteralValue(schema)) {
    return { type: 'literal', value: schema };
  }

  const def = getSchemaDef(schema);
  if (!def || typeof def !== 'object') {
    throw new Error('Invalid Zod schema definition');
  }

  const defObj = def as Record<string, unknown>;
  const typeName = normalizeTypeName(defObj);
  const wrapperNode = walkWrapperSchema(typeName, defObj, path, warnings);
  if (wrapperNode) {
    return wrapperNode;
  }

  return walkSchemaType(typeName, defObj, path, warnings);
}

function walkWrapperSchema(
  typeName: string | undefined,
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode | undefined {
  switch (typeName) {
    case 'optional':
    case 'ZodOptional':
      return wrapInnerSchema('optional', defObj, path, warnings);
    case 'nullable':
    case 'ZodNullable':
      return wrapInnerSchema('nullable', defObj, path, warnings);
    case 'nullish':
    case 'ZodNullish':
      return wrapInnerSchema('nullish', defObj, path, warnings);
    case 'default':
    case 'ZodDefault':
      return walkDefaultSchema(defObj, path, warnings);
    case 'effects':
    case 'ZodEffects':
      return walkEffectsSchema(defObj, path, warnings);
    case 'pipe':
      return walkPipeSchema(defObj, path, warnings);
    default:
      return undefined;
  }
}

function wrapInnerSchema(
  wrapper: 'optional' | 'nullable' | 'nullish',
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  const innerType = defObj.innerType as ZodType;
  return { type: wrapper, inner: walkSchema(innerType, path, warnings) };
}

function walkDefaultSchema(
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  const innerType = defObj.innerType as ZodType;
  const rawDefault = defObj.defaultValue;
  const defaultValue = typeof rawDefault === 'function' ? undefined : rawDefault;
  if (typeof rawDefault === 'function') {
    warnings.push({
      code: 'unsupported_effect',
      path,
      message:
        'Encountered function default factory; skipping execution and default value extraction.',
    });
  }
  return {
    type: 'default',
    defaultValue,
    inner: walkSchema(innerType, path, warnings),
  };
}

function walkEffectsSchema(
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  const effectType =
    (defObj.effect as { type?: string } | undefined)?.type ??
    (defObj.effects as Array<{ type?: string }> | undefined)?.[0]?.type;
  const message = effectType
    ? `Encountered Zod effect "${effectType}"; using base schema shape.`
    : 'Encountered Zod effect; using base schema shape.';
  warnings.push({
    code: 'unsupported_effect',
    path,
    message,
  });
  const inner = (defObj.schema as ZodType) ?? (defObj.innerType as ZodType);
  return walkSchema(inner, path, warnings);
}

function walkPipeSchema(
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  warnings.push({
    code: 'unsupported_effect',
    path,
    message: 'Encountered Zod pipeline; using input schema shape.',
  });
  const inner = (defObj.in as ZodType) ?? (defObj.schema as ZodType);
  return walkSchema(inner, path, warnings);
}

function walkSchemaType(
  typeName: string | undefined,
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  switch (typeName) {
    case 'string':
    case 'ZodString':
      return walkStringSchema(defObj);
    case 'number':
    case 'ZodNumber':
      return walkNumberSchema(defObj);
    case 'boolean':
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'date':
    case 'ZodDate':
      return { type: 'date' };
    case 'uuid':
      return { type: 'uuid' };
    case 'enum':
    case 'ZodEnum':
      return walkEnumSchema(defObj);
    case 'literal':
    case 'ZodLiteral':
      return walkLiteralSchema(defObj);
    case 'null':
    case 'ZodNull':
      return { type: 'literal', value: null };
    case 'object':
    case 'ZodObject':
      return walkObjectSchema(defObj, path, warnings);
    case 'array':
    case 'ZodArray':
      return walkArraySchema(defObj, path, warnings);
    case 'union':
    case 'ZodUnion':
      return walkUnionOptions((defObj.options as ZodType[]) || [], path, warnings);
    case 'ZodDiscriminatedUnion':
      return walkDiscriminatedUnionSchema(defObj, path, warnings);
    case 'any':
    case 'ZodAny':
      return { type: 'any' };
    case 'unknown':
    case 'ZodUnknown':
      return { type: 'unknown' };
    default:
      return walkUnknownSchema(typeName, path, warnings);
  }
}

function walkStringSchema(defObj: Record<string, unknown>): SchemaNode {
  const { constraints, inferredType } = extractStringConstraints(defObj);
  if (inferredType) {
    return { type: inferredType };
  }
  return constraints ? { type: 'string', constraints } : { type: 'string' };
}

function walkNumberSchema(defObj: Record<string, unknown>): SchemaNode {
  const { constraints, isInt } = extractNumberConstraints(defObj);
  const type = isInt ? 'int' : 'number';
  return constraints ? { type, constraints } : { type };
}

function walkEnumSchema(defObj: Record<string, unknown>): SchemaNode {
  const values =
    (defObj.values as readonly string[]) ??
    (defObj.entries ? Object.values(defObj.entries as Record<string, string>) : undefined) ??
    [];
  return { type: 'enum', values };
}

function walkLiteralSchema(defObj: Record<string, unknown>): SchemaNode {
  if ('value' in defObj) {
    return { type: 'literal', value: (defObj as { value: unknown }).value };
  }

  const values = (defObj as { values?: unknown }).values;
  if (Array.isArray(values)) {
    return { type: 'literal', value: values[0] };
  }
  if (values instanceof Set) {
    return { type: 'literal', value: values.values().next().value };
  }

  return { type: 'literal', value: undefined };
}

function walkObjectSchema(
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  const shapeGetter = defObj.shape as (() => Record<string, unknown>) | Record<string, unknown>;
  const shape = typeof shapeGetter === 'function' ? shapeGetter() : shapeGetter;
  const fields: Record<string, SchemaNode> = {};
  for (const [key, value] of Object.entries(shape)) {
    fields[key] = walkSchema(value, [...path, key], warnings);
  }
  return { type: 'object', fields };
}

function walkArraySchema(
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  const elementType =
    (defObj.element as ZodType) ??
    (defObj.type !== 'array' ? (defObj.type as ZodType) : undefined) ??
    (defObj.elementType as ZodType) ??
    (defObj.items as ZodType);
  if (!elementType) {
    throw new Error('Array schema missing element type');
  }
  return { type: 'array', element: walkSchema(elementType, [...path, '[element]'], warnings) };
}

function walkUnionOptions(
  options: ZodType[],
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  return {
    type: 'union',
    options: options.map((opt, idx) => walkSchema(opt, [...path, `option${idx}`], warnings)),
  };
}

function walkDiscriminatedUnionSchema(
  defObj: Record<string, unknown>,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  const optionsMap =
    (defObj.options as Map<string, ZodType>) ?? (defObj.optionsMap as Map<string, ZodType>);
  const options = optionsMap ? Array.from(optionsMap.values()) : [];
  return walkUnionOptions(options, path, warnings);
}

function walkUnknownSchema(
  typeName: string | undefined,
  path: string[],
  warnings: VisitorWarning[],
): SchemaNode {
  warnings.push({
    code: 'unknown_type',
    path,
    message: `Unknown or unsupported Zod schema type "${String(typeName)}"; defaulting to 'any'.`,
  });
  return { type: 'any' };
}

function isPrimitiveLiteralValue(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isZod4(schema: unknown): schema is ZodType & { _zod: { def: unknown } } {
  return typeof schema === 'object' && schema !== null && '_zod' in schema;
}

function getSchemaDef(schema: unknown): unknown {
  if (isZod4(schema)) {
    return (schema as { _zod: { def: unknown } })._zod.def;
  }
  return (schema as { _def: unknown })._def;
}

function normalizeTypeName(def: Record<string, unknown>): string | undefined {
  const rawType = typeof def.type === 'string' ? def.type : undefined;
  if (rawType) return rawType;

  const rawTypeName = readLegacyTypeName(def);
  if (!rawTypeName) return undefined;

  if (rawTypeName.startsWith('Symbol(') && rawTypeName.endsWith(')')) {
    return rawTypeName.slice('Symbol('.length, -1);
  }
  return rawTypeName;
}

function readLegacyTypeName(def: Record<string, unknown>): string | undefined {
  if (typeof def.typeName === 'string') {
    return def.typeName;
  }
  if (typeof def.typeName === 'symbol') {
    return def.typeName.description;
  }
  return undefined;
}

interface StringConstraintState {
  constraints: StringConstraints;
  inferredType?: InferredStringType;
}

function extractStringConstraints(def: Record<string, unknown>): {
  constraints?: StringConstraints;
  inferredType?: InferredStringType;
} {
  const checks = (def.checks as unknown[]) || [];
  const state: StringConstraintState = { constraints: {} };

  for (const check of checks) {
    const normalized = normalizeStringCheck(check);
    if (normalized) {
      applyStringCheck(normalized, state);
    }
  }

  if (checks.length === 0 && def.check) {
    const normalized = normalizeStringCheck(def);
    if (normalized) {
      applyStringCheck(normalized, state);
    }
  }

  const result: {
    constraints?: StringConstraints;
    inferredType?: InferredStringType;
  } = {};
  if (Object.keys(state.constraints).length > 0) {
    result.constraints = state.constraints;
  }
  if (state.inferredType !== undefined) {
    result.inferredType = state.inferredType;
  }
  return result;
}

function applyStringCheck(normalized: NormalizedStringCheck, state: StringConstraintState): void {
  switch (normalized.kind) {
    case 'min':
      state.constraints.minLength = normalized.value;
      return;
    case 'max':
      state.constraints.maxLength = normalized.value;
      return;
    case 'length':
      state.constraints.length = normalized.value;
      return;
    case 'regex':
      state.constraints.regex = normalized.regex;
      return;
    case 'uuid':
    case 'datetime':
    case 'isodate':
    case 'ipv4':
    case 'ipv6':
    case 'time':
    case 'duration':
      state.inferredType = normalized.kind;
  }
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
    if (normalized) {
      isInt = applyNumberCheck(normalized, constraints) || isInt;
    }
  }

  if (checks.length === 0 && def.check) {
    const normalized = normalizeNumberCheck(def);
    if (normalized) {
      isInt = applyNumberCheck(normalized, constraints) || isInt;
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

function applyNumberCheck(
  normalized: NormalizedNumberCheck,
  constraints: NumberConstraints,
): boolean {
  switch (normalized.kind) {
    case 'int':
      return true;
    case 'min':
      constraints.min = {
        value: normalized.value,
        inclusive: normalized.inclusive ?? true,
      };
      applyMinBoundaryFlags(constraints);
      return false;
    case 'max':
      constraints.max = {
        value: normalized.value,
        inclusive: normalized.inclusive ?? true,
      };
      return false;
  }
}

function applyMinBoundaryFlags(constraints: NumberConstraints): void {
  if (!constraints.min) return;
  if (constraints.min.value === 0 && constraints.min.inclusive === false) {
    constraints.positive = true;
  }
  if (constraints.min.value === 0 && constraints.min.inclusive === true) {
    constraints.nonnegative = true;
  }
}

type NormalizedStringCheck =
  | { kind: 'min'; value: number }
  | { kind: 'max'; value: number }
  | { kind: 'length'; value: number }
  | { kind: 'regex'; regex: RegExp | string }
  | { kind: 'uuid' }
  | { kind: 'isodate' }
  | { kind: 'datetime' }
  | { kind: 'ipv4' }
  | { kind: 'ipv6' }
  | { kind: 'time' }
  | { kind: 'duration' };

const STRING_FORMAT_TO_KIND: Record<string, InferredStringType> = {
  uuid: 'uuid',
  datetime: 'datetime',
  date: 'isodate',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  time: 'time',
  duration: 'duration',
};

function inferredStringCheck(format: string): NormalizedStringCheck | null {
  const kind = STRING_FORMAT_TO_KIND[format];
  return kind ? { kind } : null;
}

function normalizeStringCheck(raw: unknown): NormalizedStringCheck | null {
  if (!raw || typeof raw !== 'object') return null;

  const legacy = normalizeLegacyStringCheck(raw);
  if (legacy) return legacy;

  const direct = normalizeDirectStringFormatCheck(raw);
  if (direct) return direct;

  return normalizeDefStringCheck(raw);
}

function normalizeLegacyStringCheck(raw: object): NormalizedStringCheck | null {
  if (!('kind' in raw)) return null;

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
      return { kind: 'isodate' };
    case 'ipv4':
      return { kind: 'ipv4' };
    case 'ipv6':
      return { kind: 'ipv6' };
    case 'time':
      return { kind: 'time' };
    case 'duration':
      return { kind: 'duration' };
    default:
      return null;
  }
}

function normalizeDirectStringFormatCheck(raw: object): NormalizedStringCheck | null {
  const check = (raw as { check?: string }).check;
  if (check !== 'string_format') return null;

  const format = (raw as { format?: string; pattern?: RegExp | string }).format;
  if (format === 'regex') {
    const pattern = (raw as { pattern?: RegExp | string }).pattern;
    return pattern ? { kind: 'regex', regex: pattern } : null;
  }

  return inferredStringCheck(format ?? '');
}

function normalizeDefStringCheck(raw: object): NormalizedStringCheck | null {
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
    case 'string_format':
      return stringFormatCheckFromDef(def);
    default:
      return null;
  }
}

function stringFormatCheckFromDef(def: Record<string, unknown>): NormalizedStringCheck | null {
  const format = def.format as string | undefined;
  if (format === 'regex' && def.pattern) {
    return { kind: 'regex', regex: def.pattern as RegExp | string };
  }

  return inferredStringCheck(format ?? '');
}

type NormalizedNumberCheck =
  | { kind: 'min'; value: number; inclusive?: boolean }
  | { kind: 'max'; value: number; inclusive?: boolean }
  | { kind: 'int' };

function normalizeNumberCheck(raw: unknown): NormalizedNumberCheck | null {
  if (!raw || typeof raw !== 'object') return null;

  const legacy = normalizeLegacyNumberCheck(raw);
  if (legacy) return legacy;

  const direct = normalizeDirectNumberCheck(raw);
  if (direct) return direct;

  return normalizeDefNumberCheck(raw);
}

function normalizeLegacyNumberCheck(raw: object): NormalizedNumberCheck | null {
  if (!('kind' in raw)) return null;

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
    default:
      return null;
  }
}

function normalizeDirectNumberCheck(raw: object): NormalizedNumberCheck | null {
  const check = (raw as { check?: string }).check;
  if (check === 'number_format') {
    const format = (raw as { format?: string }).format;
    if (format === 'int' || format === 'safeint') {
      return { kind: 'int' };
    }
  }

  if (check === 'greater_than') {
    const value = (raw as { value?: number }).value;
    if (value !== undefined) {
      const inclusive = (raw as { inclusive?: boolean }).inclusive;
      return { kind: 'min', value, inclusive: inclusive ?? false };
    }
  }

  if (check === 'less_than') {
    const value = (raw as { value?: number }).value;
    if (value !== undefined) {
      const inclusive = (raw as { inclusive?: boolean }).inclusive;
      return { kind: 'max', value, inclusive: inclusive ?? false };
    }
  }

  return null;
}

function normalizeDefNumberCheck(raw: object): NormalizedNumberCheck | null {
  const defFromZ4 = (raw as { _zod?: { def: Record<string, unknown> } })._zod?.def;
  const defFromInstance = (raw as { def?: Record<string, unknown> }).def;
  const def = defFromZ4 ?? defFromInstance;
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
