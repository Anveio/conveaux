/**
 * @conveaux/contract-object-pool
 *
 * Pure types for object pooling.
 * No runtime code - all operations are pure functions in @conveaux/port-object-pool.
 *
 * Design principle: An object pool manages reusable resources.
 * - Contract: pure types (ObjectPool, ObjectFactory, ObjectValidator)
 * - Port: pure functions (acquire, release, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of pool state
 * - Testability without mocks
 * - Platform-agnostic resource management
 * - Injectable factory and validation logic
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * An object pool manages a collection of reusable objects.
 *
 * The pool maintains a set of available objects and tracks which are in use.
 * Objects are acquired from the pool and released back when no longer needed.
 *
 * @template T - The type of objects in the pool
 *
 * @example
 * ```typescript
 * import { createObjectPool, acquire, release } from '@conveaux/port-object-pool';
 *
 * const pool = createObjectPool(factory, { minSize: 2, maxSize: 5 });
 * const obj = await acquire(pool);
 * // Use obj...
 * const newPool = release(pool, obj);
 * ```
 */
export interface ObjectPool<T> {
  /** Objects available for acquisition */
  readonly available: readonly T[];

  /** Objects currently in use */
  readonly inUse: readonly T[];

  /** Minimum number of objects to maintain */
  readonly minSize: number;

  /** Maximum number of objects allowed */
  readonly maxSize: number;

  /** Factory for creating new objects */
  readonly factory: ObjectFactory<T>;

  /** Optional validator for objects before reuse */
  readonly validator?: ObjectValidator<T>;
}

/**
 * Factory for creating pooled objects.
 *
 * Injected by the host to provide object creation logic.
 *
 * @template T - The type of objects to create
 */
export interface ObjectFactory<T> {
  /**
   * Create a new object instance.
   *
   * @returns A promise that resolves to the created object
   */
  create(): Promise<T>;
}

/**
 * Validator for pooled objects before reuse.
 *
 * Optionally injected to verify objects are still valid before reuse.
 *
 * @template T - The type of objects to validate
 */
export interface ObjectValidator<T> {
  /**
   * Validate whether an object is still usable.
   *
   * @param obj - The object to validate
   * @returns A promise that resolves to true if valid, false otherwise
   */
  validate(obj: T): Promise<boolean>;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating an object pool.
 */
export interface ObjectPoolOptions {
  /** Minimum number of objects to maintain in the pool */
  readonly minSize: number;

  /** Maximum number of objects the pool can create */
  readonly maxSize: number;
}

// =============================================================================
// Operation Result Types
// =============================================================================

/**
 * Result of an acquire operation.
 *
 * @template T - The type of object acquired
 */
export interface AcquireResult<T> {
  /** The acquired object */
  readonly item: T;

  /** The new pool state after acquisition */
  readonly pool: ObjectPool<T>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type ObjectPoolValidationErrorType =
  | 'invalid_size_config'
  | 'size_constraint_violation'
  | 'duplicate_object';

/**
 * A validation error found in an object pool.
 */
export interface ObjectPoolValidationError {
  readonly type: ObjectPoolValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating an object pool.
 */
export interface ObjectPoolValidationResult {
  readonly valid: boolean;
  readonly errors: readonly ObjectPoolValidationError[];
}
