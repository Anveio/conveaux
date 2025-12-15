/**
 * Type guards for runtime type safety.
 *
 * These utilities eliminate unsafe type assertions throughout the codebase,
 * providing runtime validation for unknown values from external sources
 * (API responses, tool inputs, catch blocks).
 */

/**
 * Check if a value is a non-null object (Record-like).
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Check if a value is an Error instance.
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if a value has an error-like message property.
 */
export function hasErrorMessage(value: unknown): value is { message: string } {
  return isRecord(value) && typeof value.message === 'string';
}

/**
 * Extract error message from unknown caught value.
 *
 * Handles:
 * - Error instances
 * - Objects with message property
 * - String values
 * - Falls back to 'Unknown error'
 */
export function getErrorMessage(value: unknown): string {
  if (isError(value)) return value.message;
  if (hasErrorMessage(value)) return value.message;
  if (typeof value === 'string') return value;
  return 'Unknown error';
}

/**
 * Check if a value is a string.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Safely get a string property from a record.
 * Returns undefined if the key doesn't exist or value is not a string.
 */
export function getStringProperty(
  record: Record<string, unknown>,
  key: string
): string | undefined {
  const value = record[key];
  return isString(value) ? value : undefined;
}

/**
 * Check if an exec error indicates "no matches" from grep.
 * grep exits with code 1 when no matches found (expected behavior).
 */
export function isGrepNoMatchError(error: unknown): boolean {
  if (!isRecord(error)) return false;
  // grep returns exit code 1 for no matches, with empty stderr
  return (
    typeof error.code === 'number' &&
    error.code === 1 &&
    (!error.stderr || error.stderr === '')
  );
}
