/**
 * @conveaux/port-object-pool
 *
 * Pure functions for operating on object pools.
 * Platform agnostic - host provides factory and optional validator.
 *
 * All functions are pure: they take a pool and return a new pool.
 * The original pool is never mutated.
 */

import type {
  AcquireResult,
  ObjectFactory,
  ObjectPool,
  ObjectPoolOptions,
  ObjectPoolValidationError,
  ObjectPoolValidationResult,
  ObjectValidator,
} from '@conveaux/contract-object-pool';

// Re-export contract types for convenience
export type {
  AcquireResult,
  ObjectFactory,
  ObjectPool,
  ObjectPoolOptions,
  ObjectPoolValidationError,
  ObjectPoolValidationResult,
  ObjectValidator,
} from '@conveaux/contract-object-pool';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new object pool with the specified options.
 *
 * The pool will be initialized with minSize objects.
 *
 * @param factory - Factory for creating new objects
 * @param options - Pool configuration (minSize, maxSize)
 * @param validator - Optional validator for objects before reuse
 * @returns A promise that resolves to a new ObjectPool
 * @throws Error if minSize or maxSize are invalid
 *
 * @example
 * ```typescript
 * const pool = await createObjectPool(
 *   { create: async () => ({ id: Math.random() }) },
 *   { minSize: 2, maxSize: 10 }
 * );
 * ```
 */
export async function createObjectPool<T>(
  factory: ObjectFactory<T>,
  options: ObjectPoolOptions,
  validator?: ObjectValidator<T>
): Promise<ObjectPool<T>> {
  if (options.minSize < 0 || !Number.isInteger(options.minSize)) {
    throw new Error(`minSize must be a non-negative integer, got: ${options.minSize}`);
  }

  if (options.maxSize < 1 || !Number.isInteger(options.maxSize)) {
    throw new Error(`maxSize must be a positive integer, got: ${options.maxSize}`);
  }

  if (options.minSize > options.maxSize) {
    throw new Error(
      `minSize (${options.minSize}) cannot be greater than maxSize (${options.maxSize})`
    );
  }

  // Initialize pool with minSize objects
  const available: T[] = [];
  for (let i = 0; i < options.minSize; i++) {
    available.push(await factory.create());
  }

  return {
    available,
    inUse: [],
    minSize: options.minSize,
    maxSize: options.maxSize,
    factory,
    validator,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Acquire an object from the pool.
 *
 * If available objects exist, returns the first valid one.
 * If no objects are available and pool is under maxSize, creates a new one.
 * If pool is at maxSize and all objects are in use, waits or throws.
 *
 * @param pool - The object pool
 * @returns A promise that resolves to an AcquireResult with the object and new pool state
 * @throws Error if pool is at maxSize and no objects are available
 *
 * @example
 * ```typescript
 * const { item, pool: newPool } = await acquire(pool);
 * // Use item...
 * ```
 */
export async function acquire<T>(pool: ObjectPool<T>): Promise<AcquireResult<T>> {
  // Try to find a valid object from available
  for (let i = 0; i < pool.available.length; i++) {
    const obj = pool.available[i]!;

    // Validate if validator exists
    if (pool.validator) {
      const isValid = await pool.validator.validate(obj);
      if (!isValid) {
        // Remove invalid object and try next
        continue;
      }
    }

    // Found a valid object
    return {
      item: obj,
      pool: {
        ...pool,
        available: pool.available.filter((_, idx) => idx !== i),
        inUse: [...pool.inUse, obj],
      },
    };
  }

  // No valid available objects, check if we can create new one
  const totalSize = pool.available.length + pool.inUse.length;
  if (totalSize >= pool.maxSize) {
    // Pool is at or over maxSize and all objects are in use or invalid
    throw new Error(
      `Pool exhausted: all ${pool.maxSize} objects are in use and no valid objects are available`
    );
  }

  // Can create new object
  const newObj = await pool.factory.create();
  return {
    item: newObj,
    pool: {
      ...pool,
      available: pool.available, // Keep invalid ones for now
      inUse: [...pool.inUse, newObj],
    },
  };
}

/**
 * Release an object back to the pool.
 *
 * The object is moved from inUse to available.
 *
 * @param pool - The object pool
 * @param item - The object to release
 * @returns The new pool state with the object released
 * @throws Error if the object is not currently in use
 *
 * @example
 * ```typescript
 * const newPool = release(pool, item);
 * ```
 */
export function release<T>(pool: ObjectPool<T>, item: T): ObjectPool<T> {
  const inUseIndex = pool.inUse.indexOf(item);

  if (inUseIndex === -1) {
    throw new Error('Cannot release object that is not in use');
  }

  return {
    ...pool,
    available: [...pool.available, item],
    inUse: pool.inUse.filter((_, idx) => idx !== inUseIndex),
  };
}

/**
 * Get the total number of objects in the pool (available + in use).
 *
 * @param pool - The object pool
 * @returns The total number of objects
 */
export function size<T>(pool: ObjectPool<T>): number {
  return pool.available.length + pool.inUse.length;
}

/**
 * Get the number of available objects.
 *
 * @param pool - The object pool
 * @returns The number of available objects
 */
export function available<T>(pool: ObjectPool<T>): number {
  return pool.available.length;
}

/**
 * Get the number of objects currently in use.
 *
 * @param pool - The object pool
 * @returns The number of objects in use
 */
export function inUse<T>(pool: ObjectPool<T>): number {
  return pool.inUse.length;
}

/**
 * Drain the pool, removing all invalid objects and ensuring minSize valid objects.
 *
 * This is useful for maintenance - removes invalid objects and replenishes to minSize.
 *
 * @param pool - The object pool
 * @returns A promise that resolves to the new pool state
 *
 * @example
 * ```typescript
 * const cleanedPool = await drain(pool);
 * ```
 */
export async function drain<T>(pool: ObjectPool<T>): Promise<ObjectPool<T>> {
  // Filter available objects to keep only valid ones
  const validAvailable: T[] = [];

  if (pool.validator) {
    for (const obj of pool.available) {
      const isValid = await pool.validator.validate(obj);
      if (isValid) {
        validAvailable.push(obj);
      }
    }
  } else {
    // No validator, all are considered valid
    validAvailable.push(...pool.available);
  }

  // Calculate how many we need to create to reach minSize
  const currentTotal = validAvailable.length + pool.inUse.length;
  const needed = Math.max(0, pool.minSize - currentTotal);

  // Create new objects if needed
  for (let i = 0; i < needed; i++) {
    validAvailable.push(await pool.factory.create());
  }

  return {
    ...pool,
    available: validAvailable,
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate an object pool's internal consistency.
 *
 * @param pool - The object pool to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateObjectPool(pool);
 * if (!result.valid) {
 *   console.error('Invalid pool:', result.errors);
 * }
 * ```
 */
export function validateObjectPool<T>(pool: ObjectPool<T>): ObjectPoolValidationResult {
  const errors: ObjectPoolValidationError[] = [];

  // Check size configuration
  if (pool.minSize < 0 || !Number.isInteger(pool.minSize)) {
    errors.push({
      type: 'invalid_size_config',
      details: `minSize must be a non-negative integer, got: ${pool.minSize}`,
    });
  }

  if (pool.maxSize < 1 || !Number.isInteger(pool.maxSize)) {
    errors.push({
      type: 'invalid_size_config',
      details: `maxSize must be a positive integer, got: ${pool.maxSize}`,
    });
  }

  if (pool.minSize > pool.maxSize) {
    errors.push({
      type: 'invalid_size_config',
      details: `minSize (${pool.minSize}) cannot be greater than maxSize (${pool.maxSize})`,
    });
  }

  // Check size constraints
  const totalSize = pool.available.length + pool.inUse.length;
  if (totalSize > pool.maxSize) {
    errors.push({
      type: 'size_constraint_violation',
      details: `Total objects (${totalSize}) exceeds maxSize (${pool.maxSize})`,
    });
  }

  // Check for duplicate objects (same reference in both available and inUse)
  for (const obj of pool.available) {
    if (pool.inUse.includes(obj)) {
      errors.push({
        type: 'duplicate_object',
        details: 'Object appears in both available and inUse arrays',
      });
      break; // Only report once
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
