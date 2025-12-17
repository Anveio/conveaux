/**
 * @conveaux/port-sorted-set
 *
 * Pure functions for operating on sorted sets.
 * Platform agnostic - host provides comparator.
 *
 * All functions are pure: they take a sorted set and return a new sorted set.
 * The original sorted set is never mutated.
 */

import type {
  Comparator,
  SortedSet,
  SortedSetEntry,
  SortedSetValidationError,
  SortedSetValidationResult,
} from '@conveaux/contract-sorted-set';

// Re-export contract types for convenience
export type {
  Comparator,
  SortedSet,
  SortedSetEntry,
  SortedSetValidationError,
  SortedSetValidationResult,
} from '@conveaux/contract-sorted-set';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty sorted set with the specified comparator.
 *
 * @param comparator - Comparator for ordering scores
 * @param options - Optional configuration
 * @returns A new empty SortedSet
 *
 * @example
 * ```typescript
 * const set = createSortedSet(numberComparator);
 * ```
 */
export function createSortedSet<T>(
  comparator: Comparator<number>,
  options?: { initialCapacity?: number }
): SortedSet<T> {
  return {
    entries: [],
    comparator,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Add an item with a score to the sorted set.
 * If the item already exists, updates its score.
 *
 * @param set - The sorted set
 * @param item - The item to add
 * @param score - The score for this item
 * @returns A new sorted set with the item added
 *
 * @example
 * ```typescript
 * const set1 = createSortedSet<string>(numberComparator);
 * const set2 = add(set1, 'alice', 100);
 * const set3 = add(set2, 'bob', 200);
 * ```
 */
export function add<T>(set: SortedSet<T>, item: T, score: number): SortedSet<T> {
  // Remove existing entry if present
  const filtered = set.entries.filter((entry) => entry.item !== item);

  // Create new entry
  const newEntry: SortedSetEntry<T> = { item, score };

  // Insert in sorted order using binary search
  const insertIndex = findInsertIndex(filtered, score, set.comparator);
  const newEntries = [
    ...filtered.slice(0, insertIndex),
    newEntry,
    ...filtered.slice(insertIndex),
  ];

  return {
    entries: newEntries,
    comparator: set.comparator,
  };
}

/**
 * Remove an item from the sorted set.
 *
 * @param set - The sorted set
 * @param item - The item to remove
 * @returns A new sorted set with the item removed, and a boolean indicating if it was found
 *
 * @example
 * ```typescript
 * const { set: newSet, removed } = remove(set, 'alice');
 * if (removed) {
 *   console.log('Alice was removed');
 * }
 * ```
 */
export function remove<T>(
  set: SortedSet<T>,
  item: T
): { set: SortedSet<T>; removed: boolean } {
  const initialLength = set.entries.length;
  const newEntries = set.entries.filter((entry) => entry.item !== item);

  return {
    set: {
      entries: newEntries,
      comparator: set.comparator,
    },
    removed: newEntries.length < initialLength,
  };
}

/**
 * Get the rank (index) of an item in the sorted set.
 * Rank 0 is the item with the lowest score.
 *
 * @param set - The sorted set
 * @param item - The item to find
 * @returns The rank (0-based index) or undefined if not found
 *
 * @example
 * ```typescript
 * const rank = rank(set, 'alice');
 * if (rank !== undefined) {
 *   console.log(`Alice is at rank ${rank}`);
 * }
 * ```
 */
export function rank<T>(set: SortedSet<T>, item: T): number | undefined {
  const index = set.entries.findIndex((entry) => entry.item === item);
  return index === -1 ? undefined : index;
}

/**
 * Get a range of items by rank.
 * Returns items from start (inclusive) to end (exclusive).
 *
 * @param set - The sorted set
 * @param start - Start rank (inclusive)
 * @param end - End rank (exclusive)
 * @returns Array of items in the specified range
 *
 * @example
 * ```typescript
 * const topThree = range(set, 0, 3); // Get ranks 0, 1, 2
 * const bottomTwo = range(set, -2, undefined); // Get last 2 items
 * ```
 */
export function range<T>(set: SortedSet<T>, start: number, end: number): readonly T[] {
  return set.entries.slice(start, end).map((entry) => entry.item);
}

/**
 * Get the score of an item.
 *
 * @param set - The sorted set
 * @param item - The item to look up
 * @returns The score or undefined if not found
 *
 * @example
 * ```typescript
 * const score = score(set, 'alice');
 * if (score !== undefined) {
 *   console.log(`Alice has score ${score}`);
 * }
 * ```
 */
export function score<T>(set: SortedSet<T>, item: T): number | undefined {
  const entry = set.entries.find((e) => e.item === item);
  return entry?.score;
}

/**
 * Get the number of items in the sorted set.
 *
 * @param set - The sorted set
 * @returns The number of items
 */
export function size<T>(set: SortedSet<T>): number {
  return set.entries.length;
}

/**
 * Check if the sorted set is empty.
 *
 * @param set - The sorted set
 * @returns True if the set contains no items
 */
export function isEmpty<T>(set: SortedSet<T>): boolean {
  return set.entries.length === 0;
}

/**
 * Check if an item exists in the sorted set.
 *
 * @param set - The sorted set
 * @param item - The item to check
 * @returns True if the item exists
 */
export function has<T>(set: SortedSet<T>, item: T): boolean {
  return set.entries.some((entry) => entry.item === item);
}

/**
 * Get all items in order.
 *
 * @param set - The sorted set
 * @returns Array of all items from lowest to highest score
 */
export function toArray<T>(set: SortedSet<T>): readonly T[] {
  return set.entries.map((entry) => entry.item);
}

/**
 * Clear all items from the sorted set.
 *
 * @param set - The sorted set
 * @returns A new empty sorted set with the same comparator
 */
export function clear<T>(set: SortedSet<T>): SortedSet<T> {
  return {
    entries: [],
    comparator: set.comparator,
  };
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a sorted set's internal consistency.
 *
 * @param set - The sorted set to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateSortedSet(set);
 * if (!result.valid) {
 *   console.error('Invalid sorted set:', result.errors);
 * }
 * ```
 */
export function validateSortedSet<T>(set: SortedSet<T>): SortedSetValidationResult {
  const errors: SortedSetValidationError[] = [];

  // Check comparator exists
  if (typeof set.comparator !== 'function') {
    errors.push({
      type: 'invalid_comparator',
      details: 'Comparator must be a function',
    });
  }

  // Check entries are sorted
  for (let i = 1; i < set.entries.length; i++) {
    const prev = set.entries[i - 1]!;
    const curr = set.entries[i]!;
    if (set.comparator(prev.score, curr.score) > 0) {
      errors.push({
        type: 'invalid_order',
        details: `Entry at index ${i} is out of order: ${prev.score} > ${curr.score}`,
      });
    }
  }

  // Check for duplicate items
  const items = new Set<T>();
  for (let i = 0; i < set.entries.length; i++) {
    const item = set.entries[i]!.item;
    if (items.has(item)) {
      errors.push({
        type: 'duplicate_items',
        details: `Duplicate item found at index ${i}`,
      });
    }
    items.add(item);
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
 * Find the insertion index for a score using binary search.
 *
 * @internal
 */
function findInsertIndex<T>(
  entries: readonly SortedSetEntry<T>[],
  score: number,
  comparator: Comparator<number>
): number {
  let left = 0;
  let right = entries.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const midScore = entries[mid]!.score;

    if (comparator(midScore, score) < 0) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left;
}

// =============================================================================
// Common Comparators
// =============================================================================

/**
 * Standard numeric comparator (ascending order).
 *
 * @example
 * ```typescript
 * const set = createSortedSet<string>(numberComparator);
 * ```
 */
export const numberComparator: Comparator<number> = (a, b) => a - b;

/**
 * Reverse numeric comparator (descending order).
 *
 * @example
 * ```typescript
 * const set = createSortedSet<string>(reverseNumberComparator);
 * ```
 */
export const reverseNumberComparator: Comparator<number> = (a, b) => b - a;
