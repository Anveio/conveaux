/**
 * @conveaux/contract-sorted-set
 *
 * Pure types for sorted sets - ordered collections by score.
 * No runtime code - all operations are pure functions in @conveaux/port-sorted-set.
 *
 * Design principle: A sorted set is data, not a capability.
 * - Contract: pure types (SortedSet, SortedSetEntry)
 * - Port: pure functions (add, remove, rank, range, score, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of sorted set state
 * - Time-travel debugging
 * - Structural sharing for efficient immutable updates
 * - Testing without mocks
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * An entry in the sorted set.
 *
 * @template T - The type of items stored
 */
export interface SortedSetEntry<T> {
  /** The item */
  readonly item: T;

  /** The score associated with this item */
  readonly score: number;
}

/**
 * A sorted set is pure data - a collection of items ordered by score.
 *
 * All operations on the sorted set are pure functions in the port.
 * The sorted set is immutable; operations return new sorted set instances.
 *
 * @template T - The type of items stored
 *
 * @example
 * ```typescript
 * import { createSortedSet, add, rank, range } from '@conveaux/port-sorted-set';
 *
 * const empty = createSortedSet<string>(numberComparator);
 * const set1 = add(empty, 'alice', 100);
 * const set2 = add(set1, 'bob', 200);
 * console.log(rank(set2, 'alice')); // 0 (lowest score is rank 0)
 * console.log(range(set2, 0, 1)); // ['alice', 'bob']
 * ```
 */
export interface SortedSet<T> {
  /** The entries in the sorted set, ordered by score */
  readonly entries: readonly SortedSetEntry<T>[];

  /** Comparator for comparing scores */
  readonly comparator: Comparator<number>;
}

/**
 * Comparator function for ordering values.
 *
 * @template T - The type of values to compare
 * @param a - First value
 * @param b - Second value
 * @returns Negative if a < b, zero if a === b, positive if a > b
 */
export type Comparator<T> = (a: T, b: T) => number;

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type SortedSetValidationErrorType =
  | 'invalid_comparator'
  | 'invalid_order'
  | 'duplicate_items';

/**
 * A validation error found in a sorted set.
 */
export interface SortedSetValidationError {
  readonly type: SortedSetValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a sorted set.
 */
export interface SortedSetValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SortedSetValidationError[];
}
