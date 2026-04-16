/**
 * SchemaBridge AST (Intermediate Representation)
 *
 * This module exports the AST types and conversion functions
 * that serve as the bridge between Zod schemas and target languages.
 */

export * from './zod-visitor.js';
export type {
  SchemaNode,
  StringConstraints,
  NumberConstraints,
  VisitorWarning,
  VisitResult,
} from './zod-visitor.js';
