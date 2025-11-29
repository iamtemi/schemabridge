import type { SchemaNode, VisitorWarning } from '../ast/index.js';

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
}

export interface EmitPydanticOptions {
  name: string;
  sourceModule?: string;
  warnings?: VisitorWarning[];
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
  };

  const classBlock = renderObject(root, options.name, ctx, []);

  const importLines = buildImports(ctx);
  const regexLines = buildRegexConstants(ctx);

  const sections = [importLines, regexLines, classBlock].filter(Boolean);
  return sections.join('\n\n');
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
  const { annotation, defaultCode } = buildAnnotation(node, ctx, path, currentClass);
  const needsAlias = !isValidPythonIdentifier(fieldName);
  const pythonName = needsAlias ? toPythonIdentifier(fieldName) : fieldName;

  const fieldParts: string[] = [];
  if (needsAlias) {
    ctx.pydanticImports.add('Field');
    fieldParts.push(`alias="${fieldName}"`);
  }
  if (defaultCode !== undefined) {
    // If defaultCode already uses Field(), extract the parts
    if (defaultCode.startsWith('Field(')) {
      ctx.pydanticImports.add('Field');
      const inner = defaultCode.slice(6, -1); // Remove "Field(" and ")"
      if (needsAlias) {
        fieldParts.push(inner);
      } else {
        // If we don't need alias, we can use the Field() directly
        return `${pythonName}: ${annotation} = ${defaultCode}`;
      }
    } else {
      if (needsAlias) {
        ctx.pydanticImports.add('Field');
        fieldParts.push(`default=${defaultCode}`);
      } else {
        // No alias needed, use default directly
        return `${pythonName}: ${annotation} = ${defaultCode}`;
      }
    }
  }

  if (fieldParts.length > 0) {
    return `${pythonName}: ${annotation} = Field(${fieldParts.join(', ')})`;
  }
  return `${pythonName}: ${annotation}`;
}

interface TypeBuild {
  annotation: string;
  defaultCode?: string;
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
      ctx.typingImports.add('Literal');
      const literalValues = node.values.map((v) => pythonLiteral(v));
      return { annotation: `Literal[${literalValues.join(', ')}]` };
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

function isValidPythonIdentifier(name: string): boolean {
  // Python identifiers must start with a letter or underscore, and contain only letters, digits, and underscores
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function toPythonIdentifier(name: string): string {
  // Convert invalid identifier to valid one by replacing invalid chars with underscores
  // and ensuring it starts with a letter or underscore
  let result = name.replace(/[^a-zA-Z0-9_]/g, '_');
  if (!/^[a-zA-Z_]/.test(result)) {
    result = `_${result}`;
  }
  return result;
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
