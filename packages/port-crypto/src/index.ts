/**
 * @conveaux/port-crypto
 *
 * Cryptographic hashing implementation.
 * Follows the hermetic primitive port pattern for platform abstraction.
 */

import * as nodeCrypto from 'node:crypto';

import type {
  Crypto,
  HashAlgorithm,
  HashEncoding,
  HashInput,
  HashOptions,
} from '@conveaux/contract-crypto';

// Re-export contract types for convenience
export type {
  Crypto,
  HashAlgorithm,
  HashEncoding,
  HashInput,
  HashOptions,
} from '@conveaux/contract-crypto';

// =============================================================================
// Duck-Typed Platform Interfaces
// =============================================================================

/**
 * Duck-typed Hash interface.
 * Matches Node.js crypto.Hash without importing node:crypto types.
 */
type HashLike = {
  update(data: string | Uint8Array): HashLike;
  digest(encoding: 'hex' | 'base64'): string;
};

/**
 * Duck-typed Crypto interface for platform abstraction.
 * Matches the subset of Node.js crypto module we need.
 */
type CryptoLike = {
  createHash(algorithm: string): HashLike;
};

// =============================================================================
// Environment Types
// =============================================================================

/**
 * Resolved crypto environment with concrete values (no undefined).
 */
type CryptoEnvironment = {
  readonly crypto: CryptoLike | null;
};

/**
 * Environment overrides for configuring crypto sources.
 *
 * Semantics:
 * - `undefined`: Use host default (Node.js crypto module)
 * - `null`: Explicitly disable this source (will throw on use)
 * - `value`: Use this override instead of host
 */
export type CryptoEnvironmentOverrides = {
  readonly crypto?: CryptoLike | null;
};

// =============================================================================
// Options Types
// =============================================================================

/**
 * Hash function signature for direct override.
 * Allows complete control over hashing for tests or alternative implementations.
 */
type HashFn = (algorithm: HashAlgorithm, data: Uint8Array, encoding: HashEncoding) => string;

/**
 * Options for creating a crypto instance.
 */
export type CryptoOptions = {
  /**
   * Direct override for the hash function.
   * Takes precedence over environment resolution.
   * Useful for testing with deterministic mocks.
   */
  readonly hashFn?: HashFn;

  /**
   * Overrides the host environment used to resolve crypto.
   * Provide `null` to explicitly disable host crypto.
   */
  readonly environment?: CryptoEnvironmentOverrides;
};

// =============================================================================
// Internal Helpers
// =============================================================================

const SUPPORTED_ALGORITHMS: readonly HashAlgorithm[] = ['sha256', 'sha512'];

const isValidAlgorithm = (algorithm: string): algorithm is HashAlgorithm => {
  return SUPPORTED_ALGORITHMS.includes(algorithm as HashAlgorithm);
};

const toUint8Array = (data: HashInput): Uint8Array => {
  if (typeof data === 'string') {
    return new TextEncoder().encode(data);
  }
  return data;
};

type OverrideKey = keyof CryptoEnvironmentOverrides;

/**
 * Reads an override value, distinguishing between "not provided" and "provided as undefined/null".
 * Uses Object.hasOwn to detect explicit key presence.
 */
const readOverride = <Key extends OverrideKey>(
  overrides: CryptoEnvironmentOverrides | undefined,
  key: Key
): CryptoEnvironmentOverrides[Key] | undefined => {
  if (!overrides) {
    return undefined;
  }
  return Object.hasOwn(overrides, key) ? overrides[key] : undefined;
};

/**
 * Returns the Node.js crypto module as a CryptoLike.
 * The module is imported at the top level for ESM compatibility.
 */
const getNodeCrypto = (): CryptoLike => {
  return nodeCrypto as unknown as CryptoLike;
};

/**
 * Resolves the crypto environment by merging overrides with host crypto.
 * Precedence: override → Node.js crypto → null (disabled)
 */
const resolveEnvironment = (overrides?: CryptoEnvironmentOverrides): CryptoEnvironment => {
  const overrideCrypto = readOverride(overrides, 'crypto');

  const crypto = overrideCrypto !== undefined ? (overrideCrypto ?? null) : getNodeCrypto();

  return { crypto };
};

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a Crypto instance for hashing operations.
 *
 * @param options - Optional configuration
 * @returns A Crypto instance
 *
 * @example
 * ```typescript
 * // Default usage - uses Node.js crypto
 * const crypto = createCrypto();
 * const hash = crypto.hash('sha256', 'hello world');
 *
 * // Test usage - inject mock hash function
 * const mockCrypto = createCrypto({
 *   hashFn: () => 'mock-hash-result',
 * });
 *
 * // Disable host crypto (will throw on use)
 * const disabledCrypto = createCrypto({
 *   environment: { crypto: null },
 * });
 * ```
 */
export function createCrypto(options: CryptoOptions = {}): Crypto {
  const environment = resolveEnvironment(options.environment);

  const hashWithPlatform = (
    algorithm: HashAlgorithm,
    data: Uint8Array,
    encoding: HashEncoding
  ): string => {
    if (!environment.crypto) {
      throw new Error(
        'No crypto implementation available. Provide a crypto override or run in Node.js.'
      );
    }

    const hash = environment.crypto.createHash(algorithm);
    hash.update(data);
    return hash.digest(encoding);
  };

  const hashFn = options.hashFn ?? hashWithPlatform;

  const hash = (algorithm: HashAlgorithm, data: HashInput, hashOptions?: HashOptions): string => {
    if (!isValidAlgorithm(algorithm)) {
      throw new Error(
        `Unsupported hash algorithm: ${algorithm}. Supported: ${SUPPORTED_ALGORITHMS.join(', ')}`
      );
    }

    const encoding = hashOptions?.encoding ?? 'hex';
    const bytes = toUint8Array(data);

    return hashFn(algorithm, bytes, encoding);
  };

  return { hash };
}
