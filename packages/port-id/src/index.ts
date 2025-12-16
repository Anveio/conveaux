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
import type { Random } from '@conveaux/contract-random';
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

export type { Random } from '@conveaux/contract-random';

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
// Internal Helpers
// =============================================================================

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
 * Dependencies for creating a random ID generator.
 */
export type RandomIdGeneratorDependencies = {
  /**
   * Random byte source for ID generation.
   */
  readonly random: Random;
};

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
};

/**
 * Creates a random ID generator.
 *
 * Default: hex-encoded random bytes (16 bytes = 32 chars).
 * Override with: uuid.v4, nanoid, custom entropy source.
 *
 * @param deps - Required dependencies (random)
 * @param options - Optional configuration
 * @returns A RandomIdGenerator instance
 *
 * @example
 * ```typescript
 * import { createRandom } from '@conveaux/port-random';
 *
 * // Default: 16 bytes hex (32 chars)
 * const gen = createRandomIdGenerator({ random: createRandom() });
 * const id = gen.randomId();
 *
 * // Custom size and encoding
 * const gen21 = createRandomIdGenerator(
 *   { random: createRandom() },
 *   { config: { sizeBytes: 21, encoding: 'base64url' } }
 * );
 *
 * // Inject uuid.v4
 * const genUuid = createRandomIdGenerator(
 *   { random: createRandom() },
 *   { generate: () => uuid.v4().replace(/-/g, '') }
 * );
 *
 * // Inject nanoid
 * const genNano = createRandomIdGenerator(
 *   { random: createRandom() },
 *   { generate: () => nanoid() }
 * );
 * ```
 */
export function createRandomIdGenerator(
  deps: RandomIdGeneratorDependencies,
  options: RandomIdGeneratorOptions = {}
): RandomIdGenerator {
  const { random } = deps;
  const { generate, config = {} } = options;
  const { sizeBytes = DEFAULT_RANDOM_ID_BYTES, encoding = 'hex' } = config;

  // If generate is provided, use it directly
  if (generate) {
    return {
      randomId: () => generate() as RandomId,
    };
  }

  return {
    randomId(): RandomId {
      const bytes = random.bytes(sizeBytes);
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

  /**
   * Random byte source for ID suffix.
   */
  readonly random: Random;
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
};

/**
 * Creates a time-ordered ID generator.
 *
 * Default format: 48-bit timestamp (ms) + 80-bit random = 128 bits total.
 * Encoded as 26 Crockford Base32 characters (lexicographically sortable).
 *
 * Override with: ULID, UUIDv7, KSUID, Snowflake.
 *
 * @param deps - Required dependencies (clock, random)
 * @param options - Optional configuration
 * @returns A TimeOrderedIdGenerator instance
 *
 * @example
 * ```typescript
 * import { createWallClock } from '@conveaux/port-wall-clock';
 * import { createRandom } from '@conveaux/port-random';
 *
 * // Default implementation
 * const gen = createTimeOrderedIdGenerator({
 *   clock: createWallClock({ Date }),
 *   random: createRandom(),
 * });
 * const id = gen.timeOrderedId();
 * const ts = gen.extractTimestamp(id);
 *
 * // Inject ULID
 * import { ulid, decodeTime } from 'ulid';
 * const genUlid = createTimeOrderedIdGenerator(
 *   { clock: createWallClock({ Date }), random: createRandom() },
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
  const { clock, random } = deps;
  const { generate, extractTimestamp: extractFn, config = {} } = options;
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

  return {
    timeOrderedId(): TimeOrderedId {
      const ts = clock.nowMs();
      const tsBytes = encodeTimestamp48(ts);
      const randomBytes = random.bytes(randomSuffixBytes);

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
 * Dependencies for creating a trace ID generator.
 */
export type TraceIdGeneratorDependencies = {
  /**
   * Random byte source for ID generation.
   */
  readonly random: Random;
};

/**
 * Options for creating a trace ID generator.
 * Currently empty as the W3C format is fixed, reserved for future use.
 */
export type TraceIdGeneratorOptions = Record<string, never>;

/**
 * Creates a W3C Trace Context compliant ID generator.
 *
 * NOTE: This is NOT injectable. The format is fixed by the W3C spec.
 * Only the entropy source can be overridden (via the random dependency).
 *
 * @param deps - Required dependencies (random)
 * @param _options - Optional configuration (reserved for future use)
 * @returns A TraceIdGenerator instance
 *
 * @example
 * ```typescript
 * import { createRandom } from '@conveaux/port-random';
 *
 * const gen = createTraceIdGenerator({ random: createRandom() });
 * const traceId = gen.traceId(); // 32 hex chars
 * const spanId = gen.spanId();   // 16 hex chars
 *
 * // For testing with deterministic values
 * const mockRandom = createRandom({
 *   bytesFn: (size) => new Uint8Array(size).fill(0x42)
 * });
 * const testGen = createTraceIdGenerator({ random: mockRandom });
 * ```
 */
export function createTraceIdGenerator(
  deps: TraceIdGeneratorDependencies,
  _options: TraceIdGeneratorOptions = {}
): TraceIdGenerator {
  const { random } = deps;

  /**
   * Generate random bytes, retrying if all zeros (extremely rare).
   * W3C spec: all-zero IDs are invalid.
   */
  const generateNonZeroBytes = (size: number): Uint8Array => {
    let bytes = random.bytes(size);
    while (isAllZeros(bytes)) {
      bytes = random.bytes(size);
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

  /**
   * Random byte source for ID generation.
   */
  readonly random: Random;
};

/**
 * Options for creating a unified ID generator.
 */
export type IdGeneratorOptions = {
  /**
   * Options for random ID generation.
   */
  readonly random?: RandomIdGeneratorOptions;

  /**
   * Options for time-ordered ID generation.
   */
  readonly timeOrdered?: TimeOrderedIdGeneratorOptions;

  /**
   * Options for trace ID generation.
   */
  readonly trace?: TraceIdGeneratorOptions;
};

/**
 * Creates a unified ID generator with all categories.
 *
 * @param deps - Required dependencies (clock, random)
 * @param options - Optional configuration for each category
 * @returns An IdGenerator instance
 *
 * @example
 * ```typescript
 * import { createWallClock } from '@conveaux/port-wall-clock';
 * import { createRandom } from '@conveaux/port-random';
 *
 * const ids = createIdGenerator({
 *   clock: createWallClock({ Date }),
 *   random: createRandom(),
 * });
 *
 * ids.randomId();      // Session tokens
 * ids.timeOrderedId(); // Database primary keys
 * ids.traceId();       // Distributed tracing
 * ids.spanId();        // Span identification
 *
 * // With custom implementations
 * const customIds = createIdGenerator(
 *   { clock: createWallClock({ Date }), random: createRandom() },
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
  const { clock, random } = deps;
  const { random: randomOptions = {}, timeOrdered = {}, trace = {} } = options;

  const randomGen = createRandomIdGenerator({ random }, randomOptions);

  const timeOrderedGen = createTimeOrderedIdGenerator({ clock, random }, timeOrdered);

  const traceGen = createTraceIdGenerator({ random }, trace);

  return {
    randomId: randomGen.randomId.bind(randomGen),
    timeOrderedId: timeOrderedGen.timeOrderedId.bind(timeOrderedGen),
    extractTimestamp: timeOrderedGen.extractTimestamp.bind(timeOrderedGen),
    traceId: traceGen.traceId.bind(traceGen),
    spanId: traceGen.spanId.bind(traceGen),
  };
}
