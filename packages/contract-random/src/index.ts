/**
 * @conveaux/contract-random
 *
 * Random bytes contract for cryptographically secure random byte generation.
 * Enables injectable randomness for deterministic testing and platform abstraction.
 */

/**
 * A source of cryptographically secure random bytes.
 *
 * This abstraction enables:
 * - Deterministic testing with seeded/mock random generators
 * - Platform portability (Node.js crypto, Web Crypto API, etc.)
 * - Consistent interface for all random byte needs
 *
 * @example
 * ```typescript
 * // Production usage
 * const random = createRandom();
 * const bytes = random.bytes(16); // 128 bits of randomness
 *
 * // Testing with deterministic values
 * const mockRandom = createRandom({
 *   bytesFn: (size) => new Uint8Array(size).fill(0x42),
 * });
 * ```
 */
export interface Random {
  /**
   * Generate cryptographically secure random bytes.
   *
   * @param size - Number of random bytes to generate (must be non-negative)
   * @returns Uint8Array of random bytes
   *
   * @example
   * ```typescript
   * const bytes = random.bytes(16); // 128 bits
   * const idBytes = random.bytes(21); // For nanoid-style IDs
   * ```
   */
  bytes(size: number): Uint8Array;
}
