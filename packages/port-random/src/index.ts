/**
 * @conveaux/port-random
 *
 * Random bytes implementation.
 * Follows the hermetic primitive port pattern - requires bytes function injection.
 */

import type { Random } from '@conveaux/contract-random';

// Re-export contract types for convenience
export type { Random } from '@conveaux/contract-random';

/**
 * Dependencies for creating a Random instance.
 */
export type RandomDependencies = {
  /**
   * Function that generates random bytes.
   * Inject the platform's random bytes source at composition time.
   *
   * @example
   * ```typescript
   * // Node.js
   * import * as crypto from 'node:crypto';
   * const deps = {
   *   randomBytes: (size) => {
   *     const buffer = crypto.randomBytes(size);
   *     return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
   *   }
   * };
   *
   * // Web Crypto API
   * const deps = {
   *   randomBytes: (size) => crypto.getRandomValues(new Uint8Array(size))
   * };
   * ```
   */
  readonly randomBytes: (size: number) => Uint8Array;
};

/**
 * Options for creating a Random instance.
 */
export type RandomOptions = {
  /**
   * Optional: custom bytes override.
   * If provided, takes precedence over deps.randomBytes.
   * Useful for deterministic testing.
   */
  readonly bytes?: (size: number) => Uint8Array;
};

/**
 * Creates a Random instance for random byte generation.
 *
 * @param deps - Required dependencies (randomBytes function)
 * @param options - Optional configuration
 * @returns A Random instance
 *
 * @example
 * ```typescript
 * import * as crypto from 'node:crypto';
 *
 * // Production usage - inject platform random
 * const random = createRandom({
 *   randomBytes: (size) => {
 *     const buffer = crypto.randomBytes(size);
 *     return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
 *   }
 * });
 * const bytes = random.bytes(16);
 *
 * // Test usage - deterministic values
 * const mockRandom = createRandom(
 *   { randomBytes: () => new Uint8Array(0) }, // unused
 *   { bytes: (size) => new Uint8Array(size).fill(0x42) }
 * );
 * ```
 */
export function createRandom(deps: RandomDependencies, options: RandomOptions = {}): Random {
  const bytes = options.bytes ?? deps.randomBytes;

  return {
    bytes: (size: number): Uint8Array => bytes(size),
  };
}
