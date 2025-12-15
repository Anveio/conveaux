/**
 * @conveaux/contract-crypto
 *
 * Cryptographic operations contract - interface for hashing operations.
 * Follows the hermetic primitive port pattern for platform abstraction.
 */

/**
 * Supported hash algorithms.
 * Constrained to well-known, secure algorithms.
 */
export type HashAlgorithm = 'sha256' | 'sha512';

/**
 * Hash input - supports both string and binary data.
 * String inputs are UTF-8 encoded before hashing.
 */
export type HashInput = string | Uint8Array;

/**
 * Hash output encoding format.
 */
export type HashEncoding = 'hex' | 'base64';

/**
 * Options for hash operations.
 */
export interface HashOptions {
  /**
   * Output encoding format.
   * @default 'hex'
   */
  readonly encoding?: HashEncoding;
}

/**
 * Crypto interface for hashing operations.
 *
 * This abstraction enables:
 * - Deterministic testing with injectable hash implementations
 * - Platform portability (Node.js, browsers, edge runtimes)
 * - Algorithm constraints at the type level
 *
 * @example
 * ```typescript
 * const crypto = createCrypto();
 * const hash = crypto.hash('sha256', 'hello world');
 * // => 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9'
 * ```
 */
export interface Crypto {
  /**
   * Compute a cryptographic hash of the input data.
   *
   * @param algorithm - Hash algorithm to use (sha256 or sha512)
   * @param data - Data to hash (string or Uint8Array)
   * @param options - Optional configuration (encoding)
   * @returns Hashed value as string in the specified encoding
   *
   * @example
   * ```typescript
   * // SHA-256 with default hex encoding
   * const hash = crypto.hash('sha256', 'hello world');
   *
   * // SHA-512 with base64 encoding
   * const b64Hash = crypto.hash('sha512', 'hello', { encoding: 'base64' });
   * ```
   */
  hash(algorithm: HashAlgorithm, data: HashInput, options?: HashOptions): string;
}
