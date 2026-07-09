import type { ZodType } from 'zod';
import {
  emitPydanticModel,
  emitPydanticEnum,
  emitPydanticTypeAlias,
} from '../emitters/pydantic.js';
import {
  emitTypeScriptDefinitions,
  emitTypeScriptEnum,
  emitTypeScriptTypeAlias,
} from '../emitters/typescript.js';
import { visitZodSchema } from '../ast/zod-visitor.js';

export type Target = 'pydantic' | 'typescript';

export interface SchemaConversionOptions {
  name: string;
  sourceModule?: string;
  allowUnresolved?: boolean;
  exportNameOverrides?: Record<string, string>;
  enumStyle?: 'enum' | 'literal';
  enumBaseType?: 'str' | 'int';
}

export function convertZodToPydantic(schema: ZodType, options: SchemaConversionOptions): string {
  const { node, warnings } = visitZodSchema(schema);

  const emitOptions: {
    name: string;
    sourceModule?: string;
    warnings?: typeof warnings;
    enumStyle?: 'enum' | 'literal';
    enumBaseType?: 'str' | 'int';
  } = {
    name: options.name,
    warnings,
  };

  if (options.sourceModule !== undefined) {
    emitOptions.sourceModule = options.sourceModule;
  }
  if (options.enumStyle !== undefined) {
    emitOptions.enumStyle = options.enumStyle;
  }
  if (options.enumBaseType !== undefined) {
    emitOptions.enumBaseType = options.enumBaseType;
  }

  if (node.type === 'enum') {
    return emitPydanticEnum(node, emitOptions);
  }

  if (node.type === 'object') {
    return emitPydanticModel(node, emitOptions);
  }

  return emitPydanticTypeAlias(node, emitOptions);
}

export function convertZodToTypescript(schema: ZodType, options: SchemaConversionOptions): string {
  const { node, warnings } = visitZodSchema(schema);

  const emitOptions: {
    name: string;
    sourceModule?: string;
    warnings?: typeof warnings;
    exportNameOverrides?: Record<string, string>;
  } = {
    name: options.name,
    warnings,
  };
  if (options.sourceModule !== undefined) {
    emitOptions.sourceModule = options.sourceModule;
  }
  if (options.exportNameOverrides !== undefined) {
    emitOptions.exportNameOverrides = options.exportNameOverrides;
  }

  if (node.type === 'enum') {
    return emitTypeScriptEnum(node, emitOptions);
  }

  if (node.type === 'object') {
    return emitTypeScriptDefinitions(node, emitOptions);
  }

  return emitTypeScriptTypeAlias(node, emitOptions);
}
