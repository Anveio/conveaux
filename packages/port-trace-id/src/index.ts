/**
 * @conveaux/port-trace-id
 *
 * W3C Trace Context compliant ID generation using crypto.randomBytes.
 * Follows the hermetic primitive port pattern for platform abstraction.
 *
 * @see https://www.w3.org/TR/trace-context/
 */

import * as nodeCrypto from 'node:crypto';

import type { SpanId, TraceId, TraceIdGenerator } from '@conveaux/contract-trace-id';

// Re-export contract types for convenience
export type { SpanId, TraceId, TraceIdGenerator } from '@conveaux/contract-trace-id';

// =============================================================================
// Constants
// =============================================================================

const TRACE_ID_BYTES = 16; // 128 bits -> 32 hex chars
const SPAN_ID_BYTES = 8; // 64 bits -> 16 hex chars

// =============================================================================
// Duck-Typed Platform Interfaces
// =============================================================================

/**
 * Duck-typed random bytes function.
 * Matches Node.js crypto.randomBytes signature.
 */
type RandomBytesLike = (size: number) => Uint8Array;

/**
 * Duck-typed crypto interface for random byte generation.
 */
type CryptoLike = {
  randomBytes: RandomBytesLike;
};

// =============================================================================
// Environment Types
// =============================================================================

/**
 * Resolved trace ID environment with concrete values (no undefined).
 */
type TraceIdEnvironment = {
  readonly crypto: CryptoLike | null;
};

/**
 * Environment overrides for crypto sources.
 *
 * Semantics:
 * - `undefined`: Use host default (Node.js crypto.randomBytes)
 * - `null`: Explicitly disable (will throw on use)
 * - `value`: Use override instead of host
 */
export type TraceIdEnvironmentOverrides = {
  readonly crypto?: CryptoLike | null;
};

// =============================================================================
// Options Types
// =============================================================================

/**
 * Options for creating a trace ID generator.
 */
export type TraceIdGeneratorOptions = {
  /**
   * Direct override for random bytes generation.
   * Takes precedence over environment resolution.
   * Useful for deterministic testing.
   */
  readonly randomBytesFn?: RandomBytesLike;

  /**
   * Environment overrides for platform dependencies.
   */
  readonly environment?: TraceIdEnvironmentOverrides;
};

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Convert Uint8Array to lowercase hex string.
 */
const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Check if bytes are all zeros (invalid per W3C).
 */
const isAllZeros = (bytes: Uint8Array): boolean => {
  return bytes.every((b) => b === 0);
};

type OverrideKey = keyof TraceIdEnvironmentOverrides;

/**
 * Reads an override value, distinguishing between "not provided" and "provided as undefined/null".
 * Uses Object.hasOwn to detect explicit key presence.
 */
const readOverride = <Key extends OverrideKey>(
  overrides: TraceIdEnvironmentOverrides | undefined,
  key: Key
): TraceIdEnvironmentOverrides[Key] | undefined => {
  if (!overrides) {
    return undefined;
  }
  return Object.hasOwn(overrides, key) ? overrides[key] : undefined;
};

/**
 * Returns the Node.js crypto module as a CryptoLike.
 */
const getNodeCrypto = (): CryptoLike => {
  return {
    randomBytes: (size: number): Uint8Array => {
      const buffer = nodeCrypto.randomBytes(size);
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    },
  };
};

/**
 * Resolves the crypto environment from overrides.
 * Precedence: override → Node.js crypto → null (disabled)
 */
const resolveEnvironment = (overrides?: TraceIdEnvironmentOverrides): TraceIdEnvironment => {
  const overrideCrypto = readOverride(overrides, 'crypto');
  const crypto = overrideCrypto !== undefined ? (overrideCrypto ?? null) : getNodeCrypto();
  return { crypto };
};

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a W3C Trace Context compliant ID generator.
 *
 * @param options - Optional configuration
 * @returns A TraceIdGenerator instance
 *
 * @example
 * ```typescript
 * // Default usage - uses Node.js crypto.randomBytes
 * const generator = createTraceIdGenerator();
 * const traceId = generator.traceId();
 * const spanId = generator.spanId();
 *
 * // Test usage - deterministic mock
 * let counter = 0;
 * const mockGenerator = createTraceIdGenerator({
 *   randomBytesFn: (size) => new Uint8Array(size).fill(++counter),
 * });
 *
 * // Integration with port-instrumentation
 * const instrumenter = createInstrumenter({
 *   logger, clock,
 *   generateId: () => generator.spanId(),
 * });
 * ```
 */
export function createTraceIdGenerator(options: TraceIdGeneratorOptions = {}): TraceIdGenerator {
  const environment = resolveEnvironment(options.environment);

  const getRandomBytes = (size: number): Uint8Array => {
    if (options.randomBytesFn) {
      return options.randomBytesFn(size);
    }

    if (!environment.crypto) {
      throw new Error(
        'No crypto implementation available. Provide a randomBytesFn override or run in Node.js.'
      );
    }

    return environment.crypto.randomBytes(size);
  };

  /**
   * Generate random bytes, retrying if all zeros (extremely rare).
   * W3C spec: all-zero IDs are invalid.
   * Probability of all zeros with crypto.randomBytes is 1/2^(size*8).
   * For 16 bytes: 1/2^128 - effectively impossible.
   * Still handle for correctness.
   */
  const generateNonZeroBytes = (size: number): Uint8Array => {
    let bytes = getRandomBytes(size);
    while (isAllZeros(bytes)) {
      bytes = getRandomBytes(size);
    }
    return bytes;
  };

  return {
    traceId(): TraceId {
      const bytes = generateNonZeroBytes(TRACE_ID_BYTES);
      return bytesToHex(bytes) as TraceId;
    },

    spanId(): SpanId {
      const bytes = generateNonZeroBytes(SPAN_ID_BYTES);
      return bytesToHex(bytes) as SpanId;
    },
  };
}
