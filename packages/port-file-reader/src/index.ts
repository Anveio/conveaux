/**
 * @conveaux/port-file-reader
 *
 * Platform-specific implementations of the FileReader contract.
 *
 * Provides:
 * - createNodeFileReader: Node.js/Bun file system implementation
 * - createFetchFileReader: Browser/edge fetch-based implementation
 */

import { readFile } from 'node:fs/promises';
import type { FileReadError, FileReader } from '@conveaux/contract-file-reader';
import { fromPromise } from '@conveaux/port-control-flow';

// Re-export contract types for convenience
export type { FileReader, FileReadError } from '@conveaux/contract-file-reader';

// =============================================================================
// Node.js / Bun Implementation
// =============================================================================

/**
 * Creates a FileReader using Node.js fs.promises.readFile.
 *
 * Works with both Node.js and Bun (which provides Node compatibility).
 *
 * @returns FileReader implementation for Node.js/Bun environments
 *
 * @example
 * ```typescript
 * const reader = createNodeFileReader();
 * const result = await reader.readText('./config.env');
 * if (result.ok) {
 *   console.log('Content:', result.value);
 * }
 * ```
 */
export function createNodeFileReader(): FileReader {
  return {
    async readText(path: string) {
      return fromPromise(
        readFile(path, 'utf-8'),
        (error): FileReadError => ({
          path,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    },
  };
}

// =============================================================================
// Fetch Implementation (Browser / Edge)
// =============================================================================

/**
 * Dependencies for the fetch-based FileReader.
 */
export interface FetchFileReaderDeps {
  /** Fetch function - inject for testability */
  readonly fetch: typeof globalThis.fetch;
}

/**
 * Creates a FileReader using the Fetch API.
 *
 * Suitable for browser environments or edge runtimes.
 * Reads content from URLs rather than file paths.
 *
 * @param deps - Injected dependencies (fetch function)
 * @returns FileReader implementation for fetch-capable environments
 *
 * @example
 * ```typescript
 * const reader = createFetchFileReader({ fetch: globalThis.fetch });
 * const result = await reader.readText('https://example.com/config.txt');
 * if (result.ok) {
 *   console.log('Content:', result.value);
 * }
 * ```
 */
export function createFetchFileReader(deps: FetchFileReaderDeps): FileReader {
  return {
    async readText(url: string) {
      return fromPromise(
        deps.fetch(url).then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.text();
        }),
        (error): FileReadError => ({
          path: url,
          message: error instanceof Error ? error.message : String(error),
        })
      );
    },
  };
}
