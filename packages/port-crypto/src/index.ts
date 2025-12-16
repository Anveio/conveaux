/**
 * @conveaux/port-crypto
 *
 * Cryptographic hashing implementation.
 * Follows the hermetic primitive port pattern for platform abstraction.
 */

import * as nodeCrypto from 'node:crypto';

import type { Crypto, HashAlgorithm, HashInput, HashOptions } from '@conveaux/contract-crypto';
import type { TextEncoderConstructor } from '@conveaux/contract-encoding';

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
// Dependencies
// =============================================================================

/**
 * Required dependencies for creating a Crypto instance.
 * These must be injected at composition time.
 */
export type CryptoDependencies = {
  /**
   * TextEncoder constructor for string-to-bytes conversion.
   * Inject the global TextEncoder from the host environment.
   */
  readonly TextEncoder: TextEncoderConstructor;
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
 * Options for creating a crypto instance.
 */
export type CryptoOptions = {
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
 * @param deps - Required dependencies (TextEncoder)
 * @param options - Optional configuration
 * @returns A Crypto instance
 *
 * @example
 * ```typescript
 * // Default usage - uses Node.js crypto
 * const crypto = createCrypto({ TextEncoder });
 * const hash = crypto.hash('sha256', 'hello world');
 *
 * // Custom crypto backend
 * const customCrypto = createCrypto({ TextEncoder }, {
 *   environment: { crypto: myCustomCryptoImpl },
 * });
 *
 * // Test usage - inject mock crypto
 * const mockCryptoImpl = {
 *   createHash: () => ({
 *     update: () => mockCryptoImpl.createHash(),
 *     digest: () => 'mock-hash-result',
 *   }),
 * };
 * const testCrypto = createCrypto({ TextEncoder }, {
 *   environment: { crypto: mockCryptoImpl },
 * });
 * ```
 */
export function createCrypto(deps: CryptoDependencies, options: CryptoOptions = {}): Crypto {
  const { TextEncoder: TextEncoderCtor } = deps;
  const environment = resolveEnvironment(options.environment);

  const toUint8Array = (data: HashInput): Uint8Array => {
    if (typeof data === 'string') {
      return new TextEncoderCtor().encode(data);
    }
    return data;
  };

  const hash = (algorithm: HashAlgorithm, data: HashInput, hashOptions?: HashOptions): string => {
    if (!isValidAlgorithm(algorithm)) {
      throw new Error(
        `Unsupported hash algorithm: ${algorithm}. Supported: ${SUPPORTED_ALGORITHMS.join(', ')}`
      );
    }

    if (!environment.crypto) {
      throw new Error(
        'No crypto implementation available. Provide a crypto override or run in Node.js.'
      );
    }

    const encoding = hashOptions?.encoding ?? 'hex';
    const bytes = toUint8Array(data);

    const hashObj = environment.crypto.createHash(algorithm);
    hashObj.update(bytes);
    return hashObj.digest(encoding);
  };

  return { hash };
}
