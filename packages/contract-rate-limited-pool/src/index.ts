/**
 * @conveaux/contract-rate-limited-pool
 *
 * Pure types for rate-limited resource pooling.
 * Composes ObjectPool + Semaphore patterns for controlled resource access.
 *
 * Design principle: Rate-limited pools combine object pooling with
 * concurrency limiting to prevent burst acquisition.
 * - Contract: pure types (RateLimitedPool, RateLimitedPoolOptions)
 * - Port: implementation functions (create, acquire, release)
 *
 * This composition:
 * - Prevents thundering herd on resource pools
 * - Ensures fair scheduling under contention
 * - Provides backpressure for resource exhaustion
 */

import type { ObjectFactory, ObjectValidator } from '@conveaux/contract-object-pool';

// Re-export dependency types for convenience
export type { ObjectFactory, ObjectValidator } from '@conveaux/contract-object-pool';

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * A rate-limited resource pool.
 *
 * Combines an object pool with a semaphore to limit concurrent acquisitions.
 * When permits are exhausted, waiters queue until permits become available.
 *
 * @template T - The type of resources in the pool
 *
 * @example
 * ```typescript
 * import { createRateLimitedPool, acquire, release } from '@conveaux/port-rate-limited-pool';
 *
 * const pool = createRateLimitedPool({
 *   factory: connectionFactory,
 *   maxConcurrent: 5,
 *   poolSize: 10
 * });
 *
 * const conn = await acquire(pool);
 * // Use connection...
 * release(pool, conn);
 * ```
 */
export interface RateLimitedPool<T> {
  /** Resources available for immediate acquisition */
  readonly available: readonly T[];

  /** Resources currently in use */
  readonly inUse: readonly T[];

  /** Maximum concurrent acquisitions allowed (semaphore permits) */
  readonly maxConcurrent: number;

  /** Maximum number of resources the pool can manage */
  readonly poolSize: number;

  /** Factory for creating new resources */
  readonly factory: ObjectFactory<T>;

  /** Optional validator for resources before reuse */
  readonly validator?: ObjectValidator<T>;

  /** Number of waiters queued for permits */
  readonly queuedWaiters: number;

  /** Current number of permits available */
  readonly availablePermits: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating a rate-limited pool.
 *
 * @template T - The type of resources in the pool
 */
export interface RateLimitedPoolOptions<T> {
  /** Factory for creating new resources */
  readonly factory: ObjectFactory<T>;

  /** Maximum concurrent acquisitions allowed */
  readonly maxConcurrent: number;

  /** Maximum number of resources to maintain in the pool */
  readonly poolSize: number;

  /** Optional validator for resources before reuse */
  readonly validator?: ObjectValidator<T>;
}

// =============================================================================
// Operation Result Types
// =============================================================================

/**
 * Result of an acquire operation on a rate-limited pool.
 *
 * @template T - The type of resource acquired
 */
export interface RateLimitedAcquireResult<T> {
  /** The acquired resource */
  readonly resource: T;

  /** The updated pool state after acquisition */
  readonly pool: RateLimitedPool<T>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type RateLimitedPoolValidationErrorType =
  | 'invalid_concurrent_limit'
  | 'invalid_pool_size'
  | 'concurrent_exceeds_pool_size'
  | 'in_use_exceeds_concurrent'
  | 'invalid_permit_count';

/**
 * A validation error found in a rate-limited pool.
 */
export interface RateLimitedPoolValidationError {
  readonly type: RateLimitedPoolValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a rate-limited pool.
 */
export interface RateLimitedPoolValidationResult {
  readonly valid: boolean;
  readonly errors: readonly RateLimitedPoolValidationError[];
}
