/**
 * Type definitions for the hermetic verification stage.
 */

/**
 * A detected violation of hermetic principles.
 */
export interface HermeticViolation {
  /** Absolute path to the file containing the violation */
  filePath: string;
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
  /** Name of the disallowed global */
  globalName: string;
}

/**
 * Scope context built from parsing a source file.
 * Used to determine if an identifier is a global reference.
 */
export interface ScanContext {
  /** All imported identifiers (both value and type imports) */
  importedNames: Set<string>;
  /** Locally declared identifiers (variables, functions, classes, etc.) */
  localDeclarations: Set<string>;
}
