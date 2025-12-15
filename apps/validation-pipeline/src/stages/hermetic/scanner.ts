/**
 * AST scanner for detecting disallowed global references.
 *
 * Uses TypeScript's compiler API for accurate parsing and analysis.
 */

import * as ts from 'typescript';

import type { HermeticViolation, ScanContext } from './types.js';

/**
 * Scan a TypeScript file for disallowed global references.
 *
 * @param filePath - Absolute path to the file (for error reporting)
 * @param content - Source code content
 * @param blockedGlobals - Set of global names to detect
 * @returns Array of violations found
 */
export function scanFileForGlobals(
  filePath: string,
  content: string,
  blockedGlobals: Set<string>
): HermeticViolation[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes - needed for scope analysis
    ts.ScriptKind.TS
  );

  const violations: HermeticViolation[] = [];
  const context = buildScanContext(sourceFile);

  function visit(node: ts.Node): void {
    // Check bare identifiers
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (blockedGlobals.has(name) && isGlobalReference(node, context)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          filePath,
          line: line + 1,
          column: character + 1,
          globalName: name,
        });
      }
    }

    // Check globalThis.X / window.X / global.X patterns
    if (ts.isPropertyAccessExpression(node)) {
      const globalName = getGlobalThisAccess(node, blockedGlobals);
      if (globalName) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        violations.push({
          filePath,
          line: line + 1,
          column: character + 1,
          globalName,
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

/**
 * Build scope context by collecting all imports and local declarations.
 */
function buildScanContext(sourceFile: ts.SourceFile): ScanContext {
  const importedNames = new Set<string>();
  const localDeclarations = new Set<string>();

  function collectDeclarations(node: ts.Node): void {
    // Import declarations
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause) {
        // Default import
        if (clause.name) {
          importedNames.add(clause.name.text);
        }

        // Named imports
        if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
          for (const spec of clause.namedBindings.elements) {
            importedNames.add(spec.name.text);
          }
        }

        // Namespace import
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
          importedNames.add(clause.namedBindings.name.text);
        }
      }
    }

    // Variable declarations
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      localDeclarations.add(node.name.text);
    }

    // Function declarations
    if (ts.isFunctionDeclaration(node) && node.name) {
      localDeclarations.add(node.name.text);
    }

    // Class declarations
    if (ts.isClassDeclaration(node) && node.name) {
      localDeclarations.add(node.name.text);
    }

    // Type alias declarations
    if (ts.isTypeAliasDeclaration(node)) {
      localDeclarations.add(node.name.text);
    }

    // Interface declarations
    if (ts.isInterfaceDeclaration(node)) {
      localDeclarations.add(node.name.text);
    }

    // Enum declarations
    if (ts.isEnumDeclaration(node)) {
      localDeclarations.add(node.name.text);
    }

    // Parameter declarations
    if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      localDeclarations.add(node.name.text);
    }

    ts.forEachChild(node, collectDeclarations);
  }

  collectDeclarations(sourceFile);
  return { importedNames, localDeclarations };
}

/**
 * Check if an identifier is a global reference (not imported or locally declared).
 */
function isGlobalReference(node: ts.Identifier, context: ScanContext): boolean {
  const name = node.text;

  // Imported - not a global reference
  if (context.importedNames.has(name)) return false;

  // Locally declared - not a global reference
  if (context.localDeclarations.has(name)) return false;

  // Type-only position - allowed
  if (isTypeOnlyPosition(node)) return false;

  // Property name in access expression - not a reference
  if (isPropertyName(node)) return false;

  // Part of import/export specifier - not a reference
  if (isImportOrExportSpecifier(node)) return false;

  return true;
}

/**
 * Check if node is in a type-only position (type annotation, typeof, etc.).
 */
function isTypeOnlyPosition(node: ts.Identifier): boolean {
  let current: ts.Node = node;

  while (current.parent) {
    const parent = current.parent;

    // Inside a type node (type annotations, type parameters, etc.)
    if (ts.isTypeNode(parent)) return true;

    // Type query (typeof X)
    if (ts.isTypeQueryNode(parent)) return true;

    // Type parameter declaration
    if (ts.isTypeParameterDeclaration(parent)) return true;

    // Type alias right-hand side
    if (ts.isTypeAliasDeclaration(parent) && parent.type === current) return true;

    // Heritage clause (extends/implements)
    if (ts.isHeritageClause(parent)) return true;

    // Type assertion (as X)
    if (ts.isAsExpression(parent) && parent.type === current) return true;

    // Type assertion (X as unknown)
    if (ts.isTypeAssertionExpression(parent) && parent.type === current) return true;

    current = parent;
  }

  return false;
}

/**
 * Check if identifier is a property name (not a reference).
 */
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;

  // Property access expression where this is the property name (not the object)
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
    return true;
  }

  // Property assignment name
  if (ts.isPropertyAssignment(parent) && parent.name === node) {
    return true;
  }

  // Method declaration name
  if (ts.isMethodDeclaration(parent) && parent.name === node) {
    return true;
  }

  // Property declaration name (class properties)
  if (ts.isPropertyDeclaration(parent) && parent.name === node) {
    return true;
  }

  // Property signature name (interface properties like `Date: DateConstructor`)
  if (ts.isPropertySignature(parent) && parent.name === node) {
    return true;
  }

  // Method signature name (interface methods)
  if (ts.isMethodSignature(parent) && parent.name === node) {
    return true;
  }

  // Binding element in destructuring (e.g., `const { Date: DateCtor } = deps`)
  if (ts.isBindingElement(parent) && parent.propertyName === node) {
    return true;
  }

  // Shorthand property assignment where value is a local reference
  if (ts.isShorthandPropertyAssignment(parent)) {
    return true;
  }

  return false;
}

/**
 * Check if identifier is part of import/export specifier.
 */
function isImportOrExportSpecifier(node: ts.Identifier): boolean {
  const parent = node.parent;
  return ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent);
}

/**
 * Check for globalThis.X / window.X / global.X / self.X patterns.
 * Returns the accessed global name if found, null otherwise.
 */
function getGlobalThisAccess(
  node: ts.PropertyAccessExpression,
  blockedGlobals: Set<string>
): string | null {
  const prop = node.name.text;

  if (!blockedGlobals.has(prop)) return null;

  const obj = node.expression;
  if (ts.isIdentifier(obj)) {
    const globalObjects = ['globalThis', 'window', 'global', 'self'];
    if (globalObjects.includes(obj.text)) {
      return prop;
    }
  }

  return null;
}
