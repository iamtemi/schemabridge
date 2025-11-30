import type { SchemaNode, VisitorWarning } from '../ast/index.js';

interface EnumClassInfo {
  name: string;
  values: readonly string[];
  baseType: 'str' | 'int';
}

interface EmitContext {
  typingImports: Set<string>;
  pydanticImports: Set<string>;
  needsUUID: boolean;
  needsDate: boolean;
  needsDatetime: boolean;
  regexConstants: Map<string, string>;
  regexOrder: string[];
  warnings: VisitorWarning[];
  renderedPaths: Set<string>;
  pathNameMap: Map<string, string>;
  nameCounts: Map<string, number>;
  enumClasses: Map<string, EnumClassInfo>; // key = sorted values joined by '|'
  enumClassesToRender: EnumClassInfo[]; // for rendering order
  enumStyle: 'enum' | 'literal';
  enumBaseType: 'str' | 'int';
}

export interface EmitPydanticOptions {
  name: string;
  sourceModule?: string;
  warnings?: VisitorWarning[];
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
}

/**
 * Convert SchemaBridge AST into Pydantic v2 model code.
 */
export function emitPydanticModel(root: SchemaNode, options: EmitPydanticOptions): string {
  const ctx: EmitContext = {
    typingImports: new Set(),
    pydanticImports: new Set(['BaseModel']),
    needsUUID: false,
    needsDate: false,
    needsDatetime: false,
    regexConstants: new Map(),
    regexOrder: [],
    warnings: options.warnings ?? [],
    renderedPaths: new Set(),
    pathNameMap: new Map(),
    nameCounts: new Map(),
    enumClasses: new Map(),
    enumClassesToRender: [],
    enumStyle: options.enumStyle ?? 'enum',
    enumBaseType: options.enumBaseType ?? 'str',
  };

  const classBlock = renderObject(root, options.name, ctx, []);

  const importLines = buildImports(ctx);
  const regexLines = buildRegexConstants(ctx);
  const enumClassesBlock = buildEnumClasses(ctx);

  const sections = [importLines, regexLines, enumClassesBlock, classBlock].filter(Boolean);
  return sections.join('\n\n');
}

/**
 * Convert a standalone enum SchemaNode into a Pydantic Enum class or Literal type.
 */
export function emitPydanticEnum(root: SchemaNode, options: EmitPydanticOptions): string {
  if (root.type !== 'enum') {
    throw new Error('Root schema must be an enum to generate Pydantic Enum class.');
  }

  const enumStyle = options.enumStyle ?? 'enum';

  if (enumStyle === 'literal') {
    const literalValues = root.values.map((v) => pythonLiteral(v));
    return [
      'from typing import Literal',
      '',
      `type ${toPascalCase(options.name)} = Literal[${literalValues.join(', ')}]`,
    ].join('\n');
  }

  const enumName = toPascalCase(options.name);
  const enumClass = renderEnumClass(enumName, root.values, options.enumBaseType ?? 'str');

  return ['from enum import Enum', '', enumClass].join('\n');
}

function renderObject(
  node: SchemaNode,
  className: string,
  ctx: EmitContext,
  path: string[],
): string {
  if (node.type !== 'object') {
    throw new Error(`Cannot render non-object node as class "${className}"`);
  }

  const resolvedName = getNameForPath(path.join('.') || className, className, ctx, path);

  const nestedBlocks: string[] = [];
  for (const [key, value] of Object.entries(node.fields)) {
    collectObjectNodes(value, [...path, key], (objNode, objPath) => {
      const pathKey = objPath.join('.');
      if (ctx.renderedPaths.has(pathKey)) return;
      ctx.renderedPaths.add(pathKey);
      const nestedName = getNameForPath(
        pathKey,
        objPath[objPath.length - 1] ?? 'Model',
        ctx,
        objPath,
        className,
      );
      nestedBlocks.push(renderObject(objNode, nestedName, ctx, objPath));
    });
  }

  const fieldLines: string[] = [];
  for (const [key, value] of Object.entries(node.fields)) {
    fieldLines.push(renderField(key, value, ctx, [...path, key], className));
  }

  const indent = (line: string) => (line.length === 0 ? '' : `    ${line}`);
  const bodyLines: string[] = [];
  // Empty classes use 'pass' as the minimal body (valid Pydantic models)
  for (const block of [...nestedBlocks, ...(fieldLines.length ? fieldLines : ['pass'])]) {
    if (block.includes('\n')) {
      bodyLines.push(...block.split('\n').map(indent));
    } else {
      bodyLines.push(indent(block));
    }
  }

  return [`class ${resolvedName}(BaseModel):`, ...bodyLines].join('\n');
}

function renderField(
  fieldName: string,
  node: SchemaNode,
  ctx: EmitContext,
  path: string[],
  currentClass: string,
): string {
  const { annotation, defaultCode, optional } = buildAnnotation(node, ctx, path, currentClass);
  const { name: safeName, alias } = sanitizePythonIdentifier(fieldName);

  let finalDefault = defaultCode;
  if (alias) {
    finalDefault = buildFieldWithAlias(finalDefault, alias, optional ?? false);
    ctx.pydanticImports.add('Field');
  }

  if (finalDefault !== undefined) {
    return `${safeName}: ${annotation} = ${finalDefault}`;
  }
  return `${safeName}: ${annotation}`;
}

interface TypeBuild {
  annotation: string;
  defaultCode?: string;
  optional?: boolean;
}

function buildAnnotation(
  node: SchemaNode,
  ctx: EmitContext,
  path: string[],
  currentClass: string,
): TypeBuild {
  const { inner, optional, nullable, defaultValue } = unwrapOptionality(node);
  const base = buildType(inner, ctx, path, currentClass);

  let annotation = base.annotation;
  if (nullable) {
    ctx.typingImports.add('Optional');
    annotation = `Optional[${annotation}]`;
  }
  if (optional) {
    ctx.typingImports.add('Optional');
    annotation = `Optional[${annotation}]`;
  }

  const result: TypeBuild = { annotation };

  if (defaultValue !== undefined) {
    result.defaultCode = buildDefaultCode(defaultValue, ctx);
    return result;
  }

  if (optional) {
    result.defaultCode = 'None';
    return result;
  }

  if (base.defaultCode !== undefined) {
    result.defaultCode = base.defaultCode;
  }

  result.optional = optional;
  return result;
}

function buildType(
  node: SchemaNode,
  ctx: EmitContext,
  path: string[],
  currentClass: string,
): TypeBuild {
  switch (node.type) {
    case 'string': {
      const constraints = node.constraints;
      if (constraints) {
        ctx.pydanticImports.add('constr');
        const parts: string[] = [];
        if (constraints.length !== undefined) {
          parts.push(`min_length=${constraints.length}`, `max_length=${constraints.length}`);
        } else {
          if (constraints.minLength !== undefined)
            parts.push(`min_length=${constraints.minLength}`);
          if (constraints.maxLength !== undefined)
            parts.push(`max_length=${constraints.maxLength}`);
        }
        if (constraints.regex !== undefined) {
          const constName = registerRegex(constraints.regex, path, ctx);
          parts.push(`pattern=${constName}`);
        }
        return { annotation: `constr(${parts.join(', ')})` };
      }
      return { annotation: 'str' };
    }

    case 'number': {
      const constraints = node.constraints;
      if (constraints) {
        ctx.pydanticImports.add('confloat');
        const args = buildNumberArgs(constraints);
        return { annotation: `confloat(${args.join(', ')})` };
      }
      return { annotation: 'float' };
    }

    case 'int': {
      const constraints = node.constraints;
      ctx.pydanticImports.add('conint');
      const args = constraints ? buildNumberArgs(constraints) : [];
      return { annotation: args.length ? `conint(${args.join(', ')})` : 'conint()' };
    }

    case 'boolean':
      return { annotation: 'bool' };

    case 'date':
      ctx.needsDate = true;
      return { annotation: 'date' };

    case 'datetime':
      ctx.needsDatetime = true;
      return { annotation: 'datetime' };

    case 'uuid':
      ctx.needsUUID = true;
      return { annotation: 'UUID' };

    case 'enum': {
      if (ctx.enumStyle === 'literal') {
        ctx.typingImports.add('Literal');
        const literalValues = node.values.map((v) => pythonLiteral(v));
        return { annotation: `Literal[${literalValues.join(', ')}]` };
      }

      // enumStyle === 'enum': generate or reference enum class
      const key = node.values.slice().sort().join('|');
      const existingEnum = ctx.enumClasses.get(key);

      if (existingEnum) {
        // Reference existing enum class
        return { annotation: existingEnum.name };
      }

      // Generate new enum class
      const enumPathKey = path.length > 0 ? `${path.join('.')}.Enum` : 'Enum';
      const lastPathSegment = path[path.length - 1];
      const enumName = getNameForPath(
        enumPathKey,
        lastPathSegment ? `${toPascalCase(lastPathSegment)}Enum` : 'Enum',
        ctx,
        [...path, 'Enum'],
        currentClass,
      );

      const enumInfo: EnumClassInfo = {
        name: enumName,
        values: node.values,
        baseType: ctx.enumBaseType,
      };

      ctx.enumClasses.set(key, enumInfo);
      ctx.enumClassesToRender.push(enumInfo);

      return { annotation: enumName };
    }

    case 'literal': {
      ctx.typingImports.add('Literal');
      return { annotation: `Literal[${pythonLiteral(node.value)}]` };
    }

    case 'array': {
      ctx.typingImports.add('List');
      const inner = buildAnnotation(node.element, ctx, [...path, '[item]'], currentClass);
      const result: TypeBuild = { annotation: `List[${inner.annotation}]` };
      if (inner.defaultCode !== undefined) {
        result.defaultCode = inner.defaultCode;
      }
      return result;
    }

    case 'union': {
      ctx.typingImports.add('Union');
      const options = node.options.map(
        (opt, idx) => buildAnnotation(opt, ctx, [...path, `option${idx}`], currentClass).annotation,
      );
      return { annotation: `Union[${options.join(', ')}]` };
    }

    case 'object': {
      const className = getNameForPath(
        path.join('.'),
        path[path.length - 1] ?? currentClass,
        ctx,
        path,
        currentClass,
      );
      return { annotation: className };
    }

    case 'any':
    case 'unknown':
      ctx.typingImports.add('Any');
      return { annotation: 'Any' };

    case 'reference':
      return { annotation: node.name };

    default:
      ctx.typingImports.add('Any');
      return { annotation: 'Any' };
  }
}

function buildNumberArgs(constraints: {
  min?: { value: number; inclusive: boolean };
  max?: { value: number; inclusive: boolean };
  positive?: boolean;
  nonnegative?: boolean;
}) {
  const args: string[] = [];

  if (constraints.min) {
    args.push(`${constraints.min.inclusive ? 'ge' : 'gt'}=${constraints.min.value}`);
  }
  if (constraints.max) {
    args.push(`${constraints.max.inclusive ? 'le' : 'lt'}=${constraints.max.value}`);
  }
  if (constraints.positive && !constraints.min) {
    args.push('gt=0');
  }
  if (constraints.nonnegative && !constraints.min) {
    args.push('ge=0');
  }

  return args;
}

function unwrapOptionality(node: SchemaNode): {
  inner: SchemaNode;
  optional: boolean;
  nullable: boolean;
  defaultValue?: unknown;
} {
  let current = node;
  let optional = false;
  let nullable = false;
  let defaultValue: unknown;

  while (true) {
    if (current.type === 'optional') {
      optional = true;
      current = current.inner;
      continue;
    }
    if (current.type === 'nullish') {
      optional = true;
      nullable = true;
      current = current.inner;
      continue;
    }
    if (current.type === 'nullable') {
      nullable = true;
      current = current.inner;
      continue;
    }
    if (current.type === 'default') {
      defaultValue = current.defaultValue;
      current = current.inner;
      continue;
    }
    break;
  }

  return { inner: current, optional, nullable, defaultValue };
}

function buildDefaultCode(value: unknown, ctx: EmitContext): string {
  ctx.pydanticImports.add('Field');
  if (Array.isArray(value)) {
    // Field(default_factory=list) matches Zod's "fresh mutable" behavior for z.array().default([])
    return 'Field(default_factory=list)';
  }
  if (value && typeof value === 'object') {
    // Field(default_factory=dict) matches Zod's "fresh mutable" behavior for z.object().default({})
    // If the default is a non-empty object, we could emit Field(default=<literal>) instead,
    // but for empty objects, factory is correct.
    return 'Field(default_factory=dict)';
  }
  const literal = pythonLiteral(value);
  return `Field(default=${literal})`;
}

function registerRegex(regex: RegExp | string, path: string[], ctx: EmitContext): string {
  const key = regexToKey(regex);
  const existing = ctx.regexConstants.get(key);
  if (existing) return existing;

  // Check for unmapped regex flags and warn
  if (typeof regex === 'object' && regex instanceof RegExp) {
    const mappedFlags = ['i', 'm', 's'];
    const unmappedFlags = regex.flags
      .split('')
      .filter((flag) => !mappedFlags.includes(flag) && flag !== 'u' && flag !== 'g');
    if (unmappedFlags.length > 0) {
      ctx.warnings.push({
        code: 'unsupported_effect',
        path,
        message: `Regex flags "${unmappedFlags.join('')}" are not mapped to Python. Only i/m/s are embedded inline; u is default in Python, g is irrelevant.`,
      });
    }
  }

  const baseName = toConstantName([...path].pop() ?? 'pattern');
  const constName = `${baseName}_REGEX`;
  ctx.regexConstants.set(key, constName);
  ctx.regexOrder.push(key);
  return constName;
}

function regexToKey(regex: RegExp | string): string {
  if (typeof regex === 'string') return regex;
  return `/${regex.source}/${regex.flags}`;
}

function regexToPython(regex: RegExp | string): string {
  if (typeof regex === 'string') {
    return pythonRawString(regex);
  }

  const inlineFlags = regex.flags
    .split('')
    .map((flag) => {
      switch (flag) {
        case 'i':
          return 'i';
        case 'm':
          return 'm';
        case 's':
          return 's';
        default:
          return '';
      }
    })
    .join('');

  const prefix = inlineFlags ? `(?${inlineFlags})` : '';
  return pythonRawString(prefix + regex.source);
}

function buildRegexConstants(ctx: EmitContext): string {
  if (!ctx.regexOrder.length) return '';
  const lines = ctx.regexOrder.map((key) => {
    const name = ctx.regexConstants.get(key);
    if (!name) {
      throw new Error(`Missing regex constant for key: ${key}`);
    }
    return `${name} = ${regexToPython(key.startsWith('/') ? new RegExp(key.slice(1, key.lastIndexOf('/')), key.slice(key.lastIndexOf('/') + 1)) : key)}`;
  });
  return lines.join('\n');
}

function buildImports(ctx: EmitContext): string {
  const lines: string[] = [];

  const pydanticImports = Array.from(ctx.pydanticImports).sort();
  if (pydanticImports.length) {
    lines.push(`from pydantic import ${pydanticImports.join(', ')}`);
  }

  const typingImports = Array.from(ctx.typingImports).sort();
  if (typingImports.length) {
    lines.push(`from typing import ${typingImports.join(', ')}`);
  }

  if (ctx.enumClassesToRender.length > 0) {
    lines.push('from enum import Enum');
  }

  const dateImports = [];
  if (ctx.needsDate) dateImports.push('date');
  if (ctx.needsDatetime) dateImports.push('datetime');
  if (dateImports.length) {
    lines.push(`from datetime import ${dateImports.join(', ')}`);
  }

  if (ctx.needsUUID) {
    lines.push('from uuid import UUID');
  }

  return lines.join('\n');
}

function renderEnumClass(name: string, values: readonly string[], baseType: 'str' | 'int'): string {
  const members = values.map((value) => {
    const memberName = toEnumMemberName(value);
    const valueLiteral = pythonString(value);
    return `    ${memberName} = ${valueLiteral}`;
  });

  return [`class ${name}(${baseType}, Enum):`, ...members].join('\n');
}

function buildEnumClasses(ctx: EmitContext): string {
  if (ctx.enumClassesToRender.length === 0) return '';

  return ctx.enumClassesToRender
    .map((enumInfo) => renderEnumClass(enumInfo.name, enumInfo.values, enumInfo.baseType))
    .join('\n\n');
}

function toEnumMemberName(value: string): string {
  // Convert string value to valid Python enum member name
  // Uppercase, replace non-alphanumeric with underscore
  return (
    value
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '') || 'VALUE'
  );
}

function pythonLiteral(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return pythonString(value);
    case 'number':
      return Number.isFinite(value) ? value.toString() : 'None';
    case 'boolean':
      return value ? 'True' : 'False';
    case 'undefined':
      return 'None';
    case 'object':
      if (value === null) return 'None';
      if (Array.isArray(value)) {
        return `[${value.map((v) => pythonLiteral(v)).join(', ')}]`;
      }
      return (
        '{' +
        Object.entries(value)
          .map(([k, v]) => `${pythonString(k)}: ${pythonLiteral(v)}`)
          .join(', ') +
        '}'
      );
    default:
      return 'None';
  }
}

function pythonString(value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function pythonRawString(value: string): string {
  const escaped = value.replace(/"/g, '\\"');
  return `r"${escaped}"`;
}

function sanitizePythonIdentifier(name: string): { name: string; alias?: string } {
  const isValid = /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
  if (isValid) {
    return { name };
  }
  const sanitized = name
    .replace(/[^A-Za-z0-9_]/g, '_')
    .replace(/^[^A-Za-z_]+/, (m) => `_${m}`)
    .replace(/_+/g, '_');
  return { name: sanitized || '_field', alias: name };
}

function buildFieldWithAlias(
  baseDefault: string | undefined,
  alias: string,
  optional: boolean,
): string {
  const aliasArg = `alias=${pythonString(alias)}`;

  if (baseDefault?.startsWith('Field(')) {
    const inner = baseDefault.slice('Field('.length, baseDefault.length - 1).trim();
    const args = inner ? [aliasArg, inner] : [aliasArg];
    return `Field(${args.join(', ')})`;
  }

  if (baseDefault !== undefined) {
    return `Field(${aliasArg}, default=${baseDefault})`;
  }

  if (optional) {
    return `Field(${aliasArg}, default=None)`;
  }

  return `Field(${aliasArg}, default=...)`;
}

function getNameForPath(
  pathKey: string,
  fallback: string,
  ctx: EmitContext,
  pathSegments: string[],
  currentClass?: string,
): string {
  const existing = ctx.pathNameMap.get(pathKey);
  if (existing) {
    return existing;
  }

  const baseName = deriveNameFromPath(pathSegments, fallback, currentClass);
  const count = ctx.nameCounts.get(baseName) ?? 0;
  const uniqueName = count === 0 ? baseName : `${baseName}${count + 1}`;
  ctx.nameCounts.set(baseName, count + 1);
  ctx.pathNameMap.set(pathKey, uniqueName);
  return uniqueName;
}

function deriveNameFromPath(
  pathSegments: string[],
  fallback: string,
  currentClass?: string,
): string {
  const cleanedSegments = pathSegments
    .filter(Boolean)
    .map((seg) => {
      if (seg === '[item]') return 'Item';
      if (/^option\d+$/i.test(seg)) return seg;
      return seg;
    })
    .filter((seg) => seg !== '');

  if (cleanedSegments.length === 0) {
    return toPascalCase(fallback || currentClass || 'Model');
  }

  // Include parent chain to avoid collisions (e.g., body.option1.data vs body.option2.data)
  return toPascalCase(cleanedSegments.join(' '));
}

function toPascalCase(value: string): string {
  return (
    value
      .split(/[^a-zA-Z0-9]/g)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('') || 'Model'
  );
}

function toConstantName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toUpperCase();
}

function collectObjectNodes(
  node: SchemaNode,
  path: string[],
  onObject: (node: Extract<SchemaNode, { type: 'object' }>, path: string[]) => void,
) {
  const { inner } = unwrapOptionality(node);

  if (inner.type === 'object') {
    onObject(inner, path);
    for (const [key, value] of Object.entries(inner.fields)) {
      collectObjectNodes(value, [...path, key], onObject);
    }
    return;
  }

  if (inner.type === 'array') {
    collectObjectNodes(inner.element, [...path, '[item]'], onObject);
    return;
  }

  if (inner.type === 'union') {
    inner.options.forEach((opt, idx) =>
      collectObjectNodes(opt, [...path, `option${idx}`], onObject),
    );
  }
}
