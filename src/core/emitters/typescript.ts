/**
 * TypeScript Definition Emitter
 *
 * Converts SchemaBridge AST into TypeScript .d.ts definition files.
 */

import type { SchemaNode, VisitorWarning } from '../ast/index.js';

interface EmitContext {
  renderedPaths: Set<string>; // Track which paths have been rendered to prevent duplicates
  warnings: VisitorWarning[];
  exportNameOverrides: Map<string, string>;
  pathNameMap: Map<string, string>;
  nameCounts: Map<string, number>;
}

export interface EmitTypeScriptOptions {
  name: string;
  sourceModule?: string;
  warnings?: VisitorWarning[];
  exportNameOverrides?: Record<string, string>;
}

/**
 * Convert SchemaBridge AST into TypeScript .d.ts definition code.
 */
export function emitTypeScriptDefinitions(
  root: SchemaNode,
  options: EmitTypeScriptOptions,
): string {
  const ctx: EmitContext = {
    renderedPaths: new Set(),
    warnings: options.warnings ?? [],
    exportNameOverrides: new Map(Object.entries(options.exportNameOverrides ?? {})),
    pathNameMap: new Map(),
    nameCounts: new Map(),
  };

  if (root.type !== 'object') {
    throw new Error('Root schema must be a Zod object to generate TypeScript interfaces.');
  }

  const interfaceBlock = renderInterface(root, options.name, ctx, []);

  return interfaceBlock;
}

function renderInterface(
  node: SchemaNode,
  interfaceName: string,
  ctx: EmitContext,
  path: string[],
): string {
  if (node.type !== 'object') {
    throw new Error(`Cannot render non-object node as interface "${interfaceName}"`);
  }

  const resolvedName = getNameForPath(path.join('.') || interfaceName, interfaceName, ctx, path);

  // Collect nested object interfaces
  // Strategy: Collect nested objects that are NOT direct children
  // Direct children will be rendered separately and will collect their own nested objects
  const nestedInterfaces: string[] = [];

  for (const [key, value] of Object.entries(node.fields)) {
    const { inner } = unwrapOptionality(value);

    if (inner.type === 'object') {
      const childPath = [...path, key];
      const pathKey = childPath.join('.');
      if (!ctx.renderedPaths.has(pathKey)) {
        ctx.renderedPaths.add(pathKey);
        const childName = getNameForPath(childPath.join('.'), key, ctx, childPath, resolvedName);
        nestedInterfaces.push(renderInterface(inner, childName, ctx, childPath));
      }
    } else {
      collectObjectNodes(value, [...path, key], (objNode, objPath) => {
        const pathKey = objPath.join('.');
        if (ctx.renderedPaths.has(pathKey)) return;
        ctx.renderedPaths.add(pathKey);

        const nestedName = getNameForPath(
          pathKey,
          objPath[objPath.length - 1] ?? 'Model',
          ctx,
          objPath,
          resolvedName,
        );
        nestedInterfaces.push(renderInterface(objNode, nestedName, ctx, objPath));
      });
    }
  }

  // Render fields
  const fieldLines: string[] = [];
  for (const [key, value] of Object.entries(node.fields)) {
    fieldLines.push(renderProperty(key, value, ctx, [...path, key], resolvedName));
  }

  const indent = (line: string) => (line.length === 0 ? '' : `  ${line}`);
  const bodyLines: string[] = [];
  for (const line of fieldLines.length ? fieldLines : []) {
    bodyLines.push(indent(line));
  }

  const interfaceBody = bodyLines.length > 0 ? ` {\n${bodyLines.join('\n')}\n}` : ' {}';
  const interfaceDef = `export interface ${resolvedName}${interfaceBody}`;

  // Combine nested interfaces and main interface
  const allInterfaces = [...nestedInterfaces, interfaceDef];
  return allInterfaces.join('\n\n');
}

function renderProperty(
  propertyName: string,
  node: SchemaNode,
  ctx: EmitContext,
  path: string[],
  currentInterface: string,
): string {
  const { typeAnnotation, isOptional } = buildTypeAnnotation(
    node,
    ctx,
    path,
    currentInterface,
    true,
  );
  const optionalMarker = isOptional ? '?' : '';
  return `${propertyName}${optionalMarker}: ${typeAnnotation};`;
}

function buildTypeAnnotation(
  node: SchemaNode,
  ctx: EmitContext,
  path: string[],
  currentInterface: string,
  isProperty: boolean,
): { typeAnnotation: string; isOptional: boolean } {
  const { inner, optional, nullable, nullish } = unwrapOptionality(node);
  const baseType = buildBaseType(inner, ctx, path, currentInterface);

  let typeAnnotation = baseType;
  let isOptional = false;

  // Handle optionality for properties vs standalone types
  if (isProperty) {
    // For object properties, use ? modifier
    if (nullish) {
      isOptional = true;
      // nullish means T | null | undefined, use ? for optional and | null for nullable
      typeAnnotation = `${baseType} | null`;
    } else if (optional && nullable) {
      // Both optional and nullable (e.g., z.string().optional().nullable())
      isOptional = true;
      typeAnnotation = `${baseType} | null`;
    } else if (optional) {
      isOptional = true;
      typeAnnotation = baseType;
    } else if (nullable) {
      typeAnnotation = `${baseType} | null`;
    }
  } else {
    // For standalone types, use union types
    if (nullish) {
      typeAnnotation = `${baseType} | null | undefined`;
    } else if (optional && nullable) {
      typeAnnotation = `${baseType} | null | undefined`;
    } else if (optional) {
      typeAnnotation = `${baseType} | undefined`;
    } else if (nullable) {
      typeAnnotation = `${baseType} | null`;
    }
  }

  return { typeAnnotation, isOptional };
}

function buildBaseType(
  node: SchemaNode,
  ctx: EmitContext,
  path: string[],
  currentInterface: string,
): string {
  switch (node.type) {
    case 'string':
      return 'string';

    case 'number':
    case 'int':
      return 'number';

    case 'boolean':
      return 'boolean';

    case 'date':
      return 'Date';

    case 'datetime':
      return 'string';

    case 'uuid':
      return 'string';

    case 'enum': {
      const literalValues = node.values.map((v) => typescriptLiteral(v));
      return literalValues.join(' | ');
    }

    case 'literal': {
      return typescriptLiteral(node.value);
    }

    case 'array': {
      const inner = buildTypeAnnotation(
        node.element,
        ctx,
        [...path, '[item]'],
        currentInterface,
        false,
      );
      // Wrap union types in parentheses for proper array syntax
      const needsParens = inner.typeAnnotation.includes(' | ');
      const wrappedType = needsParens ? `(${inner.typeAnnotation})` : inner.typeAnnotation;
      return `${wrappedType}[]`;
    }

    case 'union': {
      const options = node.options.map((opt, idx) =>
        buildTypeAnnotation(opt, ctx, [...path, `option${idx}`], currentInterface, false),
      );
      return options.map((opt) => opt.typeAnnotation).join(' | ');
    }

    case 'object': {
      const overrideKey = path.join('.');
      const overrideName = ctx.exportNameOverrides.get(overrideKey);
      const interfaceName =
        overrideName ??
        getNameForPath(
          path.join('.'),
          path[path.length - 1] ?? currentInterface,
          ctx,
          path,
          currentInterface,
        );
      return interfaceName;
    }

    case 'any':
      return 'any';

    case 'unknown':
      return 'unknown';

    case 'reference':
      return node.name;

    default:
      return 'any';
  }
}

function unwrapOptionality(node: SchemaNode): {
  inner: SchemaNode;
  optional: boolean;
  nullable: boolean;
  nullish: boolean;
} {
  let current = node;
  let optional = false;
  let nullable = false;
  let nullish = false;

  while (true) {
    if (current.type === 'optional') {
      optional = true;
      current = current.inner;
      continue;
    }
    if (current.type === 'nullish') {
      nullish = true;
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
      // Unwrap default, but don't track it for TypeScript (defaults are runtime-only)
      current = current.inner;
      continue;
    }
    break;
  }

  return { inner: current, optional, nullable, nullish };
}

function typescriptLiteral(value: unknown): string {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'number':
      return Number.isFinite(value) ? value.toString() : 'null';
    case 'boolean':
      return value ? 'true' : 'false';
    case 'undefined':
      return 'undefined';
    case 'object':
      if (value === null) return 'null';
      if (Array.isArray(value)) {
        return `[${value.map((v) => typescriptLiteral(v)).join(', ')}]`;
      }
      return (
        '{ ' +
        Object.entries(value)
          .map(([k, v]) => `${JSON.stringify(k)}: ${typescriptLiteral(v)}`)
          .join(', ') +
        ' }'
      );
    default:
      return 'any';
  }
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

function getNameForPath(
  pathKey: string,
  fallback: string,
  ctx: EmitContext,
  pathSegments: string[],
  currentInterface?: string,
): string {
  const override = ctx.exportNameOverrides.get(pathKey);
  if (override) {
    ctx.pathNameMap.set(pathKey, override);
    return override;
  }
  const existing = ctx.pathNameMap.get(pathKey);
  if (existing) {
    return existing;
  }

  const baseName = deriveNameFromPath(pathSegments, fallback, currentInterface);
  const count = ctx.nameCounts.get(baseName) ?? 0;
  const uniqueName = count === 0 ? baseName : `${baseName}${count + 1}`;
  ctx.nameCounts.set(baseName, count + 1);
  ctx.pathNameMap.set(pathKey, uniqueName);
  return uniqueName;
}

function deriveNameFromPath(
  pathSegments: string[],
  fallback: string,
  currentInterface?: string,
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
    return toPascalCase(fallback || currentInterface || 'Model');
  }

  return toPascalCase(cleanedSegments.join(' '));
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
