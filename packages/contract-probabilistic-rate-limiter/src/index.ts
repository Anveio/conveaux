/**
 * @conveaux/contract-probabilistic-rate-limiter
 *
 * Pure types for memory-efficient rate limiting.
 * Composes Bloom Filter + Sliding Window for fast negative checks.
 *
 * Design principle: Use probabilistic data structures for fast path
 * rejection of known-good keys, with exact counting only for suspected
 * violators.
 * - Contract: pure types (ProbabilisticRateLimiter, RateLimiterOptions)
 * - Port: pure functions (create, shouldAllow, recordRequest, etc.)
 *
 * This composition:
 * - O(k) bloom filter checks for fast path
 * - Sliding window for accurate rate tracking
 * - Memory-efficient at scale (no per-key storage for good actors)
 */

import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export dependency types for convenience
export type { WallClock } from '@conveaux/contract-wall-clock';

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * A request record for rate limiting.
 */
export interface RateLimitRequest {
  /** The key being rate limited (e.g., IP, user ID) */
  readonly key: string;

  /** Timestamp of the request (ms since epoch) */
  readonly timestamp: number;
}

/**
 * A probabilistic rate limiter.
 *
 * Uses a bloom filter for fast rejection of known-good keys,
 * with sliding window tracking for suspected violators.
 *
 * @example
 * ```typescript
 * import {
 *   createProbabilisticRateLimiter,
 *   shouldAllow,
 *   recordRequest
 * } from '@conveaux/port-probabilistic-rate-limiter';
 *
 * const limiter = createProbabilisticRateLimiter({
 *   windowMs: 60000,      // 1 minute window
 *   maxRequests: 100,     // Max 100 requests per window
 *   expectedKeys: 10000,  // Expected unique keys
 *   wallClock: systemWallClock
 * });
 *
 * if (shouldAllow(limiter, 'user123')) {
 *   const updated = recordRequest(limiter, 'user123');
 *   // Process request...
 * }
 * ```
 */
export interface ProbabilisticRateLimiter {
  /** Time window in milliseconds */
  readonly windowMs: number;

  /** Maximum requests allowed per window */
  readonly maxRequests: number;

  /** Bloom filter state for quick negative checks */
  readonly bloomFilter: BloomFilterState;

  /** Per-key sliding windows for suspected violators */
  readonly slidingWindows: ReadonlyMap<string, SlidingWindowState>;

  /** Injectable time source */
  readonly wallClock: WallClock;

  /** Internal: Expected number of keys (for reset) */
  readonly _expectedKeys?: number;

  /** Internal: False positive rate (for reset) */
  readonly _falsePositiveRate?: number;
}

/**
 * Internal bloom filter state.
 * Tracks which keys have been seen in the current window.
 */
export interface BloomFilterState {
  /** The bit array */
  readonly bits: readonly number[];

  /** Number of hash functions */
  readonly hashCount: number;

  /** Size of the bit array */
  readonly size: number;

  /** Window start timestamp for reset detection */
  readonly windowStart: number;
}

/**
 * Internal sliding window state for a single key.
 */
export interface SlidingWindowState {
  /** Timestamps of requests in the window */
  readonly requests: readonly number[];

  /** Current count of requests in the active window */
  readonly count: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating a probabilistic rate limiter.
 */
export interface ProbabilisticRateLimiterOptions {
  /** Time window in milliseconds */
  readonly windowMs: number;

  /** Maximum requests allowed per window */
  readonly maxRequests: number;

  /** Expected number of unique keys (for bloom filter sizing) */
  readonly expectedKeys: number;

  /** Desired false positive rate for bloom filter (default: 0.01) */
  readonly falsePositiveRate?: number;

  /** Injectable time source */
  readonly wallClock: WallClock;
}

// =============================================================================
// Result Types
// =============================================================================

/**
 * Result of checking if a request should be allowed.
 */
export interface RateLimitCheckResult {
  /** Whether the request should be allowed */
  readonly allowed: boolean;

  /** Current request count for this key in the window */
  readonly currentCount: number;

  /** Remaining requests allowed in the window */
  readonly remaining: number;

  /** Time until the window resets (ms) */
  readonly resetIn: number;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type ProbabilisticRateLimiterValidationErrorType =
  | 'invalid_window_ms'
  | 'invalid_max_requests'
  | 'invalid_bloom_filter_size'
  | 'invalid_hash_count'
  | 'window_expired';

/**
 * A validation error found in a probabilistic rate limiter.
 */
export interface ProbabilisticRateLimiterValidationError {
  readonly type: ProbabilisticRateLimiterValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a probabilistic rate limiter.
 */
export interface ProbabilisticRateLimiterValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ProbabilisticRateLimiterValidationError[];
}
