/**
 * @conveaux/port-probabilistic-rate-limiter
 *
 * Pure functions for operating on probabilistic rate limiters.
 * Platform agnostic - composes bloom filter and sliding window.
 *
 * All functions are pure: they take a limiter and return a new limiter.
 * The original limiter is never mutated.
 *
 * Design:
 * - Bloom filter for fast negative checks (O(k) hash operations)
 * - Sliding window for exact counting of suspected violators
 * - Memory-efficient: no per-key storage for well-behaved keys
 */

import type {
  BloomFilterState,
  ProbabilisticRateLimiter,
  ProbabilisticRateLimiterOptions,
  ProbabilisticRateLimiterValidationError,
  ProbabilisticRateLimiterValidationResult,
  RateLimitCheckResult,
  SlidingWindowState,
} from '@conveaux/contract-probabilistic-rate-limiter';
import {
  createBloomFilter,
  createBooleanArrayStorageFactory,
  createSimpleStringHashFactory,
} from '@conveaux/port-bloom-filter';
import {
  createSlidingWindow,
  add as windowAdd,
  count as windowCount,
} from '@conveaux/port-sliding-window';

// Re-export contract types for convenience
export type {
  BloomFilterState,
  ProbabilisticRateLimiter,
  ProbabilisticRateLimiterOptions,
  ProbabilisticRateLimiterValidationError,
  ProbabilisticRateLimiterValidationResult,
  RateLimitCheckResult,
  RateLimitRequest,
  SlidingWindowState,
  WallClock,
} from '@conveaux/contract-probabilistic-rate-limiter';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new probabilistic rate limiter.
 *
 * @param options - Configuration for the rate limiter
 * @returns A new ProbabilisticRateLimiter
 * @throws Error if options are invalid
 *
 * @example
 * ```typescript
 * import { createProbabilisticRateLimiter } from '@conveaux/port-probabilistic-rate-limiter';
 *
 * const limiter = createProbabilisticRateLimiter({
 *   windowMs: 60000,      // 1 minute window
 *   maxRequests: 100,     // Max 100 requests per window
 *   expectedKeys: 10000,  // Expected unique keys
 *   wallClock: systemWallClock
 * });
 * ```
 */
export function createProbabilisticRateLimiter(
  options: ProbabilisticRateLimiterOptions
): ProbabilisticRateLimiter {
  const { windowMs, maxRequests, expectedKeys, falsePositiveRate = 0.01, wallClock } = options;

  if (windowMs <= 0 || !Number.isFinite(windowMs)) {
    throw new Error(`windowMs must be a positive number, got: ${windowMs}`);
  }

  if (maxRequests <= 0 || !Number.isInteger(maxRequests)) {
    throw new Error(`maxRequests must be a positive integer, got: ${maxRequests}`);
  }

  if (expectedKeys <= 0 || !Number.isInteger(expectedKeys)) {
    throw new Error(`expectedKeys must be a positive integer, got: ${expectedKeys}`);
  }

  if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
    throw new Error(
      `falsePositiveRate must be between 0 and 1 (exclusive), got: ${falsePositiveRate}`
    );
  }

  // Create bloom filter for fast negative checks
  const hashFactory = createSimpleStringHashFactory();
  const storageFactory = createBooleanArrayStorageFactory();
  const bloomFilter = createBloomFilter(hashFactory, storageFactory, {
    expectedItems: expectedKeys,
    falsePositiveRate,
  });

  // Convert bloom filter to internal state representation
  const bloomFilterState: BloomFilterState = {
    bits: Array.from({ length: bloomFilter.bitArraySize }, (_, i) =>
      bloomFilter.storage.get(i) ? 1 : 0
    ),
    hashCount: bloomFilter.numHashFunctions,
    size: bloomFilter.bitArraySize,
    windowStart: wallClock.nowMs(),
  };

  return {
    windowMs,
    maxRequests,
    bloomFilter: bloomFilterState,
    slidingWindows: new Map(),
    wallClock,
    // Store for reset purposes
    _expectedKeys: expectedKeys,
    _falsePositiveRate: falsePositiveRate,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Check if a request should be allowed for the given key.
 *
 * This performs a two-stage check:
 * 1. Bloom filter quick check - if not in bloom filter, definitely allowed
 * 2. Sliding window exact check - if in bloom filter, check exact count
 *
 * @param limiter - The probabilistic rate limiter
 * @param key - The key to check (e.g., IP address, user ID)
 * @returns Check result with allowed status and metadata
 *
 * @example
 * ```typescript
 * const result = shouldAllow(limiter, 'user123');
 * if (result.allowed) {
 *   console.log(`Allowed. Remaining: ${result.remaining}`);
 * } else {
 *   console.log(`Rate limited. Retry in ${result.resetIn}ms`);
 * }
 * ```
 */
export function shouldAllow(limiter: ProbabilisticRateLimiter, key: string): RateLimitCheckResult {
  const now = limiter.wallClock.nowMs();
  const resetIn = Math.max(0, limiter.bloomFilter.windowStart + limiter.windowMs - now);

  // Quick check: if not in bloom filter, definitely allowed
  if (!isInBloomFilter(limiter.bloomFilter, key)) {
    return {
      allowed: true,
      currentCount: 0,
      remaining: limiter.maxRequests,
      resetIn,
    };
  }

  // In bloom filter (or false positive), check sliding window for exact count
  const window = limiter.slidingWindows.get(key);
  if (!window) {
    // False positive in bloom filter, but no actual requests
    return {
      allowed: true,
      currentCount: 0,
      remaining: limiter.maxRequests,
      resetIn,
    };
  }

  // Count active requests in the time window
  const slidingWindow = createSlidingWindow<number>({
    windowType: 'time',
    windowSize: limiter.windowMs,
  });
  const reconstituted = {
    ...slidingWindow,
    entries: window.requests.map((ts) => ({ item: 1, timestamp: ts })),
  };

  const currentCount = windowCount(reconstituted, limiter.wallClock);
  const allowed = currentCount < limiter.maxRequests;
  const remaining = Math.max(0, limiter.maxRequests - currentCount);

  return {
    allowed,
    currentCount,
    remaining,
    resetIn,
  };
}

/**
 * Record a request for the given key.
 *
 * This updates both the bloom filter and sliding window state.
 * Should be called after shouldAllow returns true.
 *
 * @param limiter - The probabilistic rate limiter
 * @param key - The key to record the request for
 * @returns A new limiter with the request recorded
 *
 * @example
 * ```typescript
 * if (shouldAllow(limiter, 'user123').allowed) {
 *   limiter = recordRequest(limiter, 'user123');
 *   // Process request...
 * }
 * ```
 */
export function recordRequest(
  limiter: ProbabilisticRateLimiter,
  key: string
): ProbabilisticRateLimiter {
  const now = limiter.wallClock.nowMs();

  // Check if window has reset (reset when beyond the window, not at the boundary)
  const shouldReset = now > limiter.bloomFilter.windowStart + limiter.windowMs;
  if (shouldReset) {
    // Reset bloom filter and all windows
    const hashFactory = createSimpleStringHashFactory();
    const storageFactory = createBooleanArrayStorageFactory();
    const newBloomFilter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: (limiter as any)._expectedKeys || 1000,
      falsePositiveRate: (limiter as any)._falsePositiveRate || 0.01,
    });

    const newBloomFilterState: BloomFilterState = {
      bits: Array.from({ length: newBloomFilter.bitArraySize }, () => 0),
      hashCount: newBloomFilter.numHashFunctions,
      size: newBloomFilter.bitArraySize,
      windowStart: now,
    };

    // After reset, need to record the new request
    const resetLimiter = {
      ...limiter,
      bloomFilter: newBloomFilterState,
      slidingWindows: new Map(),
    };

    // Now record the current request in the reset limiter
    const bloomWithKey = addToBloomFilter(resetLimiter.bloomFilter, key);
    const slidingWindow = createSlidingWindow<number>({
      windowType: 'time',
      windowSize: limiter.windowMs,
    });
    const updatedWindow = windowAdd(slidingWindow, 1, limiter.wallClock);
    const newWindowState: SlidingWindowState = {
      requests: updatedWindow.entries.map((e) => e.timestamp),
      count: updatedWindow.entries.length,
    };

    const newWindows = new Map<string, SlidingWindowState>();
    newWindows.set(key, newWindowState);

    return {
      ...resetLimiter,
      bloomFilter: bloomWithKey,
      slidingWindows: newWindows,
    };
  }

  // Add to bloom filter
  const newBloomFilterState = addToBloomFilter(limiter.bloomFilter, key);

  // Add to or update sliding window
  const existingWindow = limiter.slidingWindows.get(key);
  const slidingWindow = createSlidingWindow<number>({
    windowType: 'time',
    windowSize: limiter.windowMs,
  });

  let updatedWindow = existingWindow
    ? {
        ...slidingWindow,
        entries: existingWindow.requests.map((ts) => ({ item: 1, timestamp: ts })),
      }
    : slidingWindow;

  updatedWindow = windowAdd(updatedWindow, 1, limiter.wallClock);

  const newWindowState: SlidingWindowState = {
    requests: updatedWindow.entries.map((e) => e.timestamp),
    count: updatedWindow.entries.length,
  };

  const newWindows = new Map(limiter.slidingWindows);
  newWindows.set(key, newWindowState);

  return {
    ...limiter,
    bloomFilter: newBloomFilterState,
    slidingWindows: newWindows,
  };
}

/**
 * Reset the rate limiter to its initial state.
 *
 * Clears all bloom filter bits and sliding windows.
 *
 * @param limiter - The probabilistic rate limiter
 * @returns A new limiter in the initial state
 *
 * @example
 * ```typescript
 * const resetLimiter = reset(limiter);
 * ```
 */
export function reset(limiter: ProbabilisticRateLimiter): ProbabilisticRateLimiter {
  const hashFactory = createSimpleStringHashFactory();
  const storageFactory = createBooleanArrayStorageFactory();
  const newBloomFilter = createBloomFilter(hashFactory, storageFactory, {
    expectedItems: (limiter as any)._expectedKeys || 1000,
    falsePositiveRate: (limiter as any)._falsePositiveRate || 0.01,
  });

  const newBloomFilterState: BloomFilterState = {
    bits: Array.from({ length: newBloomFilter.bitArraySize }, () => 0),
    hashCount: newBloomFilter.numHashFunctions,
    size: newBloomFilter.bitArraySize,
    windowStart: limiter.wallClock.nowMs(),
  };

  return {
    ...limiter,
    bloomFilter: newBloomFilterState,
    slidingWindows: new Map(),
  };
}

/**
 * Get statistics about the rate limiter.
 *
 * @param limiter - The probabilistic rate limiter
 * @returns Statistics object
 */
export function getStats(limiter: ProbabilisticRateLimiter): {
  readonly trackedKeys: number;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly timeUntilReset: number;
} {
  const now = limiter.wallClock.nowMs();
  return {
    trackedKeys: limiter.slidingWindows.size,
    windowStart: limiter.bloomFilter.windowStart,
    windowEnd: limiter.bloomFilter.windowStart + limiter.windowMs,
    timeUntilReset: Math.max(0, limiter.bloomFilter.windowStart + limiter.windowMs - now),
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a probabilistic rate limiter's internal consistency.
 *
 * @param limiter - The probabilistic rate limiter to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateProbabilisticRateLimiter(limiter);
 * if (!result.valid) {
 *   console.error('Invalid limiter:', result.errors);
 * }
 * ```
 */
export function validateProbabilisticRateLimiter(
  limiter: ProbabilisticRateLimiter
): ProbabilisticRateLimiterValidationResult {
  const errors: ProbabilisticRateLimiterValidationError[] = [];

  // Check window size
  if (limiter.windowMs <= 0 || !Number.isFinite(limiter.windowMs)) {
    errors.push({
      type: 'invalid_window_ms',
      details: `windowMs must be a positive number, got: ${limiter.windowMs}`,
    });
  }

  // Check max requests
  if (limiter.maxRequests <= 0 || !Number.isInteger(limiter.maxRequests)) {
    errors.push({
      type: 'invalid_max_requests',
      details: `maxRequests must be a positive integer, got: ${limiter.maxRequests}`,
    });
  }

  // Check bloom filter size
  if (limiter.bloomFilter.size <= 0 || !Number.isInteger(limiter.bloomFilter.size)) {
    errors.push({
      type: 'invalid_bloom_filter_size',
      details: `Bloom filter size must be a positive integer, got: ${limiter.bloomFilter.size}`,
    });
  }

  // Check hash count
  if (limiter.bloomFilter.hashCount <= 0 || !Number.isInteger(limiter.bloomFilter.hashCount)) {
    errors.push({
      type: 'invalid_hash_count',
      details: `Hash count must be a positive integer, got: ${limiter.bloomFilter.hashCount}`,
    });
  }

  // Check if window has expired
  const now = limiter.wallClock.nowMs();
  if (now > limiter.bloomFilter.windowStart + limiter.windowMs * 2) {
    errors.push({
      type: 'window_expired',
      details: `Window has been expired for too long. Started at ${limiter.bloomFilter.windowStart}, now is ${now}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if a key is in the bloom filter.
 *
 * @internal
 */
function isInBloomFilter(bloomFilter: BloomFilterState, key: string): boolean {
  const hashFactory = createSimpleStringHashFactory();

  for (let i = 0; i < bloomFilter.hashCount; i++) {
    const hashFn = hashFactory.create(i);
    const hash = hashFn.hash(key);
    const index = Math.abs(hash) % bloomFilter.size;

    if (bloomFilter.bits[index] === 0) {
      return false; // Definitely not in set
    }
  }

  return true; // Probably in set
}

/**
 * Add a key to the bloom filter.
 *
 * @internal
 */
function addToBloomFilter(bloomFilter: BloomFilterState, key: string): BloomFilterState {
  const hashFactory = createSimpleStringHashFactory();
  const newBits = [...bloomFilter.bits];

  for (let i = 0; i < bloomFilter.hashCount; i++) {
    const hashFn = hashFactory.create(i);
    const hash = hashFn.hash(key);
    const index = Math.abs(hash) % bloomFilter.size;
    newBits[index] = 1;
  }

  return {
    ...bloomFilter,
    bits: newBits,
  };
}
