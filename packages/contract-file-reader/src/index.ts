/**
 * @conveaux/contract-file-reader
 *
 * Platform-agnostic file reading contract.
 * Uses Result<T, E> from contract-control-flow for error handling.
 *
 * Implementations:
 * - Node.js: fs.promises.readFile
 * - Bun: Bun.file().text() or Node compat
 * - Browser: fetch() for URLs
 */

import type { Result } from '@conveaux/contract-control-flow';

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error returned when file reading fails.
 * Includes path context for debugging.
 */
export interface FileReadError {
  /** The path or URL that failed to read */
  readonly path: string;
  /** Human-readable error message */
  readonly message: string;
}

// =============================================================================
// FileReader Contract
// =============================================================================

/**
 * Asynchronous text file reader.
 *
 * Abstracts platform-specific file reading APIs behind a common interface.
 * All implementations must return a Result to enable explicit error handling.
 *
 * @example Node.js usage
 * ```typescript
 * const reader = createNodeFileReader();
 * const result = await reader.readText('/path/to/file.txt');
 * if (result.ok) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 *
 * @example Browser usage
 * ```typescript
 * const reader = createFetchFileReader({ fetch: globalThis.fetch });
 * const result = await reader.readText('https://example.com/config.txt');
 * ```
 */
export interface FileReader {
  /**
   * Read file content as UTF-8 text.
   *
   * @param path - File path (Node/Bun) or URL (browser)
   * @returns Promise resolving to Result with content string or FileReadError
   */
  readText(path: string): Promise<Result<string, FileReadError>>;
}
