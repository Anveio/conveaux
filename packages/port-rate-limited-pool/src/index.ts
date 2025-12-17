/**
 * @conveaux/port-rate-limited-pool
 *
 * Implementation of rate-limited resource pooling.
 * Composes ObjectPool + Semaphore for controlled resource access.
 *
 * Key design:
 * - Semaphore limits concurrent acquisitions (prevents thundering herd)
 * - ObjectPool manages resource lifecycle and reuse
 * - FIFO queue ensures fair scheduling under contention
 *
 * Note: Unlike the pure object pool, this implementation uses mutable state
 * due to the async nature of semaphore coordination. The RateLimitedPool
 * interface is a snapshot view of the internal state.
 */

import type {
  ObjectFactory,
  ObjectValidator,
  RateLimitedPool,
  RateLimitedPoolOptions,
  RateLimitedAcquireResult,
  RateLimitedPoolValidationError,
  RateLimitedPoolValidationResult,
} from '@conveaux/contract-rate-limited-pool';
import {
  createObjectPool,
  acquire as poolAcquire,
  release as poolRelease,
} from '@conveaux/port-object-pool';
import type { ObjectPool } from '@conveaux/port-object-pool';
import { createSemaphore } from '@conveaux/port-semaphore';
import type { Semaphore } from '@conveaux/port-semaphore';

// Re-export contract types for convenience
export type {
  ObjectFactory,
  ObjectValidator,
  RateLimitedPool,
  RateLimitedPoolOptions,
  RateLimitedAcquireResult,
  RateLimitedPoolValidationError,
  RateLimitedPoolValidationResult,
} from '@conveaux/contract-rate-limited-pool';

// =============================================================================
// Internal Implementation
// =============================================================================

/**
 * Internal mutable state for the rate-limited pool.
 * @internal
 */
class RateLimitedPoolImpl<T> {
  private objectPool: ObjectPool<T>;
  private readonly semaphore: Semaphore;
  private queuedWaiters = 0;
  private readonly maxConcurrent: number;
  private readonly poolSize: number;
  private readonly factory: ObjectFactory<T>;
  private readonly validator?: ObjectValidator<T>;

  constructor(
    objectPool: ObjectPool<T>,
    semaphore: Semaphore,
    maxConcurrent: number,
    poolSize: number,
    factory: ObjectFactory<T>,
    validator?: ObjectValidator<T>
  ) {
    this.objectPool = objectPool;
    this.semaphore = semaphore;
    this.maxConcurrent = maxConcurrent;
    this.poolSize = poolSize;
    this.factory = factory;
    this.validator = validator;
  }

  async acquire(): Promise<T> {
    this.queuedWaiters++;

    try {
      // Wait for semaphore permit (rate limiting)
      await this.semaphore.acquire();

      // Decrement queued waiters after acquiring permit
      this.queuedWaiters--;

      // Acquire resource from object pool
      const { item, pool: newObjectPool } = await poolAcquire(this.objectPool);

      // Update internal object pool state
      this.objectPool = newObjectPool;

      return item;
    } catch (error) {
      // On error, decrement queued waiters and release semaphore permit
      this.queuedWaiters--;
      this.semaphore.release();
      throw error;
    }
  }

  release(resource: T): void {
    // Release resource back to object pool
    this.objectPool = poolRelease(this.objectPool, resource);

    // Release semaphore permit (allows next waiter to proceed)
    this.semaphore.release();
  }

  getSnapshot(): RateLimitedPool<T> {
    return {
      available: this.objectPool.available,
      inUse: this.objectPool.inUse,
      maxConcurrent: this.maxConcurrent,
      poolSize: this.poolSize,
      factory: this.factory,
      validator: this.validator,
      queuedWaiters: this.queuedWaiters,
      availablePermits: this.semaphore.availablePermits,
    };
  }
}

/**
 * WeakMap to store mutable implementation state.
 * @internal
 */
const poolImplMap = new WeakMap<RateLimitedPool<any>, RateLimitedPoolImpl<any>>();

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new rate-limited pool with the specified options.
 *
 * The pool combines an object pool (for resource management) with a semaphore
 * (for concurrency control) to prevent burst acquisition and ensure fair scheduling.
 *
 * @param options - Configuration options for the rate-limited pool
 * @returns A promise that resolves to a new RateLimitedPool
 * @throws Error if maxConcurrent or poolSize are invalid
 *
 * @example
 * ```typescript
 * const pool = await createRateLimitedPool({
 *   factory: { create: async () => new Connection() },
 *   maxConcurrent: 5,
 *   poolSize: 10
 * });
 * ```
 */
export async function createRateLimitedPool<T>(
  options: RateLimitedPoolOptions<T>
): Promise<RateLimitedPool<T>> {
  const { factory, maxConcurrent, poolSize, validator } = options;

  // Validate configuration
  if (maxConcurrent < 1 || !Number.isInteger(maxConcurrent)) {
    throw new Error(`maxConcurrent must be a positive integer, got: ${maxConcurrent}`);
  }

  if (poolSize < 1 || !Number.isInteger(poolSize)) {
    throw new Error(`poolSize must be a positive integer, got: ${poolSize}`);
  }

  if (maxConcurrent > poolSize) {
    throw new Error(
      `maxConcurrent (${maxConcurrent}) cannot be greater than poolSize (${poolSize})`
    );
  }

  // Create the object pool with minSize=0, maxSize=poolSize
  const objectPool = await createObjectPool<T>(factory, { minSize: 0, maxSize: poolSize }, validator);

  // Create the semaphore to limit concurrent acquisitions
  const semaphore = createSemaphore({ permits: maxConcurrent });

  // Create internal implementation
  const impl = new RateLimitedPoolImpl(objectPool, semaphore, maxConcurrent, poolSize, factory, validator);

  // Get snapshot and store mapping
  const pool = impl.getSnapshot();
  poolImplMap.set(pool, impl);

  return pool;
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Acquire a resource from the rate-limited pool.
 *
 * This operation:
 * 1. Waits for a semaphore permit (rate limiting)
 * 2. Acquires a resource from the object pool
 * 3. Returns both the resource and updated pool state
 *
 * If the pool is exhausted or at max concurrent usage, this will wait in a FIFO queue.
 *
 * @param pool - The rate-limited pool
 * @returns A promise that resolves to the acquired resource and new pool state
 *
 * @example
 * ```typescript
 * const { resource, pool: newPool } = await acquire(pool);
 * try {
 *   // Use resource...
 * } finally {
 *   release(newPool, resource);
 * }
 * ```
 */
export async function acquire<T>(pool: RateLimitedPool<T>): Promise<RateLimitedAcquireResult<T>> {
  const impl = poolImplMap.get(pool);
  if (!impl) {
    throw new Error('Invalid pool: no implementation found. Pool may have been created incorrectly.');
  }

  const resource = await impl.acquire();

  const newPool = impl.getSnapshot();
  poolImplMap.set(newPool, impl);

  return {
    resource,
    pool: newPool,
  };
}

/**
 * Release a resource back to the rate-limited pool.
 *
 * This operation:
 * 1. Returns the resource to the object pool
 * 2. Releases the semaphore permit (allowing next waiter to proceed)
 *
 * @param pool - The rate-limited pool
 * @param resource - The resource to release
 * @returns The new pool state with the resource released
 * @throws Error if the resource is not currently in use
 *
 * @example
 * ```typescript
 * const newPool = release(pool, resource);
 * ```
 */
export function release<T>(pool: RateLimitedPool<T>, resource: T): RateLimitedPool<T> {
  const impl = poolImplMap.get(pool);
  if (!impl) {
    throw new Error('Invalid pool: no implementation found. Pool may have been created incorrectly.');
  }

  impl.release(resource);

  const newPool = impl.getSnapshot();
  poolImplMap.set(newPool, impl);

  return newPool;
}

/**
 * Get the number of resources currently available for immediate acquisition.
 *
 * @param pool - The rate-limited pool
 * @returns The number of available resources
 */
export function available<T>(pool: RateLimitedPool<T>): number {
  return pool.available.length;
}

/**
 * Get the number of resources currently in use.
 *
 * @param pool - The rate-limited pool
 * @returns The number of resources in use
 */
export function inUse<T>(pool: RateLimitedPool<T>): number {
  return pool.inUse.length;
}

/**
 * Get the total number of resources in the pool (available + in use).
 *
 * @param pool - The rate-limited pool
 * @returns The total number of resources
 */
export function size<T>(pool: RateLimitedPool<T>): number {
  return pool.available.length + pool.inUse.length;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a rate-limited pool's internal consistency.
 *
 * @param pool - The rate-limited pool to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateRateLimitedPool(pool);
 * if (!result.valid) {
 *   console.error('Invalid pool:', result.errors);
 * }
 * ```
 */
export function validateRateLimitedPool<T>(pool: RateLimitedPool<T>): RateLimitedPoolValidationResult {
  const errors: RateLimitedPoolValidationError[] = [];

  // Check maxConcurrent configuration
  if (pool.maxConcurrent < 1 || !Number.isInteger(pool.maxConcurrent)) {
    errors.push({
      type: 'invalid_concurrent_limit',
      details: `maxConcurrent must be a positive integer, got: ${pool.maxConcurrent}`,
    });
  }

  // Check poolSize configuration
  if (pool.poolSize < 1 || !Number.isInteger(pool.poolSize)) {
    errors.push({
      type: 'invalid_pool_size',
      details: `poolSize must be a positive integer, got: ${pool.poolSize}`,
    });
  }

  // Check that maxConcurrent doesn't exceed poolSize
  if (pool.maxConcurrent > pool.poolSize) {
    errors.push({
      type: 'concurrent_exceeds_pool_size',
      details: `maxConcurrent (${pool.maxConcurrent}) cannot be greater than poolSize (${pool.poolSize})`,
    });
  }

  // Check that in-use count doesn't exceed maxConcurrent
  if (pool.inUse.length > pool.maxConcurrent) {
    errors.push({
      type: 'in_use_exceeds_concurrent',
      details: `in-use count (${pool.inUse.length}) exceeds maxConcurrent (${pool.maxConcurrent})`,
    });
  }

  // Check that available permits are within valid range
  if (pool.availablePermits < 0 || pool.availablePermits > pool.maxConcurrent) {
    errors.push({
      type: 'invalid_permit_count',
      details: `availablePermits (${pool.availablePermits}) must be between 0 and maxConcurrent (${pool.maxConcurrent})`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
