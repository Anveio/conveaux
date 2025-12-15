/**
 * @conveaux/port-id
 *
 * ID generation implementations with injectable dependencies.
 * Follows the hermetic primitive port pattern for platform abstraction.
 *
 * Provides:
 * - RandomIdGenerator: Cryptographically random IDs
 * - TimeOrderedIdGenerator: Database-friendly time-sorted IDs
 * - TraceIdGenerator: W3C Trace Context compliant IDs
 * - IdGenerator: Unified generator combining all categories
 */

import * as nodeCrypto from 'node:crypto';

import type {
  IdGenerator,
  RandomId,
  RandomIdConfig,
  RandomIdEncoding,
  RandomIdGenerator,
  SpanId,
  TimeOrderedId,
  TimeOrderedIdConfig,
  TimeOrderedIdEncoding,
  TimeOrderedIdGenerator,
  TraceId,
  TraceIdGenerator,
} from '@conveaux/contract-id';
import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export all contract types for convenience
export type {
  IdGenerator,
  RandomId,
  RandomIdConfig,
  RandomIdEncoding,
  RandomIdGenerator,
  SpanId,
  TimeOrderedId,
  TimeOrderedIdConfig,
  TimeOrderedIdEncoding,
  TimeOrderedIdGenerator,
  TraceId,
  TraceIdGenerator,
} from '@conveaux/contract-id';

import {
  bytesToHex,
  decodeCrockfordBase32,
  decodeTimestamp48,
  encodeBase64,
  encodeBase64url,
  encodeCrockfordBase32,
  encodeTimestamp48,
} from './encoding.js';

// =============================================================================
// Constants
// =============================================================================

const TRACE_ID_BYTES = 16; // 128 bits -> 32 hex chars
const SPAN_ID_BYTES = 8; // 64 bits -> 16 hex chars
const DEFAULT_RANDOM_ID_BYTES = 16; // 128 bits
const DEFAULT_TIME_ORDERED_SUFFIX_BYTES = 10; // 80 bits

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
 * Resolved ID environment with concrete values (no undefined).
 */
type IdEnvironment = {
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
export type IdEnvironmentOverrides = {
  readonly crypto?: CryptoLike | null;
};

// =============================================================================
// Internal Helpers
// =============================================================================

type OverrideKey = keyof IdEnvironmentOverrides;

/**
 * Reads an override value, distinguishing between "not provided" and "provided as undefined/null".
 */
const readOverride = <Key extends OverrideKey>(
  overrides: IdEnvironmentOverrides | undefined,
  key: Key
): IdEnvironmentOverrides[Key] | undefined => {
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
 */
const resolveEnvironment = (overrides?: IdEnvironmentOverrides): IdEnvironment => {
  const overrideCrypto = readOverride(overrides, 'crypto');
  const crypto = overrideCrypto !== undefined ? (overrideCrypto ?? null) : getNodeCrypto();
  return { crypto };
};

/**
 * Check if bytes are all zeros (invalid per W3C).
 */
const isAllZeros = (bytes: Uint8Array): boolean => {
  return bytes.every((b) => b === 0);
};

/**
 * Encode bytes based on encoding type.
 */
const encodeBytes = (
  bytes: Uint8Array,
  encoding: RandomIdEncoding | TimeOrderedIdEncoding
): string => {
  switch (encoding) {
    case 'hex':
      return bytesToHex(bytes);
    case 'base32':
      return encodeCrockfordBase32(bytes);
    case 'base64':
      return encodeBase64(bytes);
    case 'base64url':
      return encodeBase64url(bytes);
    default: {
      const _exhaustive: never = encoding;
      throw new Error(`Unknown encoding: ${_exhaustive}`);
    }
  }
};

// =============================================================================
// Random ID Generator
// =============================================================================

/**
 * Options for creating a random ID generator.
 */
export type RandomIdGeneratorOptions = {
  /**
   * Direct override for the generate function.
   * If provided, config is ignored.
   * Useful for injecting external libraries (uuid.v4, nanoid, etc.).
   */
  readonly generate?: () => string;

  /**
   * Configuration for the default implementation.
   */
  readonly config?: RandomIdConfig;

  /**
   * Environment overrides for platform dependencies.
   */
  readonly environment?: IdEnvironmentOverrides;
};

/**
 * Creates a random ID generator.
 *
 * Default: hex-encoded crypto.randomBytes (16 bytes = 32 chars).
 * Override with: uuid.v4, nanoid, custom entropy source.
 *
 * @param options - Optional configuration
 * @returns A RandomIdGenerator instance
 *
 * @example
 * ```typescript
 * // Default: 16 bytes hex (32 chars)
 * const gen = createRandomIdGenerator();
 * const id = gen.randomId();
 *
 * // Custom size and encoding
 * const gen21 = createRandomIdGenerator({
 *   config: { sizeBytes: 21, encoding: 'base64url' }
 * });
 *
 * // Inject uuid.v4
 * const genUuid = createRandomIdGenerator({
 *   generate: () => uuid.v4().replace(/-/g, '')
 * });
 *
 * // Inject nanoid
 * const genNano = createRandomIdGenerator({
 *   generate: () => nanoid()
 * });
 * ```
 */
export function createRandomIdGenerator(options: RandomIdGeneratorOptions = {}): RandomIdGenerator {
  const { generate, config = {}, environment } = options;
  const { sizeBytes = DEFAULT_RANDOM_ID_BYTES, encoding = 'hex' } = config;

  // If generate is provided, use it directly
  if (generate) {
    return {
      randomId: () => generate() as RandomId,
    };
  }

  // Otherwise, use default implementation with crypto.randomBytes
  const env = resolveEnvironment(environment);

  return {
    randomId(): RandomId {
      if (!env.crypto) {
        throw new Error(
          'No crypto implementation available. Provide a generate override or run in Node.js.'
        );
      }
      const bytes = env.crypto.randomBytes(sizeBytes);
      return encodeBytes(bytes, encoding) as RandomId;
    },
  };
}

// =============================================================================
// Time-Ordered ID Generator
// =============================================================================

/**
 * Dependencies for creating a time-ordered ID generator.
 */
export type TimeOrderedIdGeneratorDependencies = {
  /**
   * Wall clock for timestamps.
   */
  readonly clock: WallClock;
};

/**
 * Options for creating a time-ordered ID generator.
 */
export type TimeOrderedIdGeneratorOptions = {
  /**
   * Direct override for the generate function.
   * Receives timestamp in milliseconds, returns ID string.
   * If provided, config is ignored.
   */
  readonly generate?: (timestampMs: number) => string;

  /**
   * Direct override for timestamp extraction.
   * Receives ID string, returns milliseconds or undefined.
   */
  readonly extractTimestamp?: (id: string) => number | undefined;

  /**
   * Configuration for the default implementation.
   */
  readonly config?: TimeOrderedIdConfig;

  /**
   * Environment overrides for platform dependencies.
   */
  readonly environment?: IdEnvironmentOverrides;
};

/**
 * Creates a time-ordered ID generator.
 *
 * Default format: 48-bit timestamp (ms) + 80-bit random = 128 bits total.
 * Encoded as 26 Crockford Base32 characters (lexicographically sortable).
 *
 * Override with: ULID, UUIDv7, KSUID, Snowflake.
 *
 * @param deps - Required dependencies (clock)
 * @param options - Optional configuration
 * @returns A TimeOrderedIdGenerator instance
 *
 * @example
 * ```typescript
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * // Default implementation
 * const gen = createTimeOrderedIdGenerator({
 *   clock: createWallClock()
 * });
 * const id = gen.timeOrderedId();
 * const ts = gen.extractTimestamp(id);
 *
 * // Inject ULID
 * import { ulid, decodeTime } from 'ulid';
 * const genUlid = createTimeOrderedIdGenerator(
 *   { clock: createWallClock() },
 *   {
 *     generate: (ts) => ulid(ts),
 *     extractTimestamp: (id) => decodeTime(id)
 *   }
 * );
 * ```
 */
export function createTimeOrderedIdGenerator(
  deps: TimeOrderedIdGeneratorDependencies,
  options: TimeOrderedIdGeneratorOptions = {}
): TimeOrderedIdGenerator {
  const { clock } = deps;
  const { generate, extractTimestamp: extractFn, config = {}, environment } = options;
  const { randomSuffixBytes = DEFAULT_TIME_ORDERED_SUFFIX_BYTES, encoding = 'base32' } = config;

  // If generate is provided, use it
  if (generate) {
    return {
      timeOrderedId(): TimeOrderedId {
        const ts = clock.nowMs();
        return generate(ts) as TimeOrderedId;
      },
      extractTimestamp(id: TimeOrderedId): number | undefined {
        return extractFn?.(id);
      },
    };
  }

  // Default implementation
  const env = resolveEnvironment(environment);

  return {
    timeOrderedId(): TimeOrderedId {
      if (!env.crypto) {
        throw new Error(
          'No crypto implementation available. Provide a generate override or run in Node.js.'
        );
      }

      const ts = clock.nowMs();
      const tsBytes = encodeTimestamp48(ts);
      const randomBytes = env.crypto.randomBytes(randomSuffixBytes);

      // Combine timestamp + random bytes
      const combined = new Uint8Array(6 + randomSuffixBytes);
      combined.set(tsBytes, 0);
      combined.set(randomBytes, 6);

      return encodeBytes(combined, encoding) as TimeOrderedId;
    },

    extractTimestamp(id: TimeOrderedId): number | undefined {
      try {
        // Decode based on encoding
        let bytes: Uint8Array;
        if (encoding === 'base32') {
          bytes = decodeCrockfordBase32(id);
        } else {
          // For hex, first 12 chars = 6 bytes = timestamp
          bytes = new Uint8Array(6);
          for (let i = 0; i < 6; i++) {
            bytes[i] = Number.parseInt(id.slice(i * 2, i * 2 + 2), 16);
          }
        }
        return decodeTimestamp48(bytes.slice(0, 6));
      } catch {
        return undefined;
      }
    },
  };
}

// =============================================================================
// Trace ID Generator (W3C Trace Context - fixed format)
// =============================================================================

/**
 * Options for creating a trace ID generator.
 */
export type TraceIdGeneratorOptions = {
  /**
   * Direct override for random bytes generation.
   * Useful for deterministic testing.
   */
  readonly randomBytesFn?: RandomBytesLike;

  /**
   * Environment overrides for platform dependencies.
   */
  readonly environment?: IdEnvironmentOverrides;
};

/**
 * Creates a W3C Trace Context compliant ID generator.
 *
 * NOTE: This is NOT injectable. The format is fixed by the W3C spec.
 * Only the entropy source can be overridden (for testing).
 *
 * @param options - Optional configuration
 * @returns A TraceIdGenerator instance
 *
 * @example
 * ```typescript
 * const gen = createTraceIdGenerator();
 * const traceId = gen.traceId(); // 32 hex chars
 * const spanId = gen.spanId();   // 16 hex chars
 *
 * // For testing with deterministic values
 * const testGen = createTraceIdGenerator({
 *   randomBytesFn: (size) => new Uint8Array(size).fill(0x42)
 * });
 * ```
 */
export function createTraceIdGenerator(options: TraceIdGeneratorOptions = {}): TraceIdGenerator {
  const { randomBytesFn, environment } = options;
  const env = resolveEnvironment(environment);

  const getRandomBytes = (size: number): Uint8Array => {
    if (randomBytesFn) {
      return randomBytesFn(size);
    }

    if (!env.crypto) {
      throw new Error(
        'No crypto implementation available. Provide a randomBytesFn override or run in Node.js.'
      );
    }

    return env.crypto.randomBytes(size);
  };

  /**
   * Generate random bytes, retrying if all zeros (extremely rare).
   * W3C spec: all-zero IDs are invalid.
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

// =============================================================================
// Unified ID Generator (composition)
// =============================================================================

/**
 * Dependencies for creating a unified ID generator.
 */
export type IdGeneratorDependencies = {
  /**
   * Wall clock for time-ordered IDs.
   */
  readonly clock: WallClock;
};

/**
 * Options for creating a unified ID generator.
 */
export type IdGeneratorOptions = {
  /**
   * Options for random ID generation.
   */
  readonly random?: Omit<RandomIdGeneratorOptions, 'environment'>;

  /**
   * Options for time-ordered ID generation.
   */
  readonly timeOrdered?: Omit<TimeOrderedIdGeneratorOptions, 'environment'>;

  /**
   * Options for trace ID generation.
   */
  readonly trace?: Omit<TraceIdGeneratorOptions, 'environment'>;

  /**
   * Shared environment overrides for all generators.
   */
  readonly environment?: IdEnvironmentOverrides;
};

/**
 * Creates a unified ID generator with all categories.
 *
 * @param deps - Required dependencies (clock)
 * @param options - Optional configuration for each category
 * @returns An IdGenerator instance
 *
 * @example
 * ```typescript
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * const ids = createIdGenerator({
 *   clock: createWallClock()
 * });
 *
 * ids.randomId();      // Session tokens
 * ids.timeOrderedId(); // Database primary keys
 * ids.traceId();       // Distributed tracing
 * ids.spanId();        // Span identification
 *
 * // With custom implementations
 * const customIds = createIdGenerator(
 *   { clock: createWallClock() },
 *   {
 *     random: { generate: () => nanoid() },
 *     timeOrdered: {
 *       generate: (ts) => ulid(ts),
 *       extractTimestamp: (id) => decodeTime(id)
 *     }
 *   }
 * );
 * ```
 */
export function createIdGenerator(
  deps: IdGeneratorDependencies,
  options: IdGeneratorOptions = {}
): IdGenerator {
  const { clock } = deps;
  const { random = {}, timeOrdered = {}, trace = {}, environment } = options;

  const randomGen = createRandomIdGenerator({
    ...random,
    environment,
  });

  const timeOrderedGen = createTimeOrderedIdGenerator(
    { clock },
    {
      ...timeOrdered,
      environment,
    }
  );

  const traceGen = createTraceIdGenerator({
    ...trace,
    environment,
  });

  return {
    randomId: randomGen.randomId.bind(randomGen),
    timeOrderedId: timeOrderedGen.timeOrderedId.bind(timeOrderedGen),
    extractTimestamp: timeOrderedGen.extractTimestamp.bind(timeOrderedGen),
    traceId: traceGen.traceId.bind(traceGen),
    spanId: traceGen.spanId.bind(traceGen),
  };
}
