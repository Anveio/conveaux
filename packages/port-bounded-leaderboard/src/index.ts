/**
 * @conveaux/port-bounded-leaderboard
 *
 * Pure functions for operating on bounded leaderboards.
 * Platform agnostic - composes sorted set and ring buffer.
 *
 * All functions are pure: they take a leaderboard and return a new leaderboard.
 * The original leaderboard is never mutated.
 */

import type {
  BoundedLeaderboard,
  BoundedLeaderboardOptions,
  BoundedLeaderboardValidationError,
  BoundedLeaderboardValidationResult,
  LeaderboardEntry,
  ScoreChange,
} from '@conveaux/contract-bounded-leaderboard';

import {
  createSortedSet,
  reverseNumberComparator,
  add as sortedSetAdd,
  has as sortedSetHas,
  range as sortedSetRange,
  rank as sortedSetRank,
  remove as sortedSetRemove,
  score as sortedSetScore,
  size as sortedSetSize,
  toArray as sortedSetToArray,
} from '@conveaux/port-sorted-set';

import {
  createArrayStorageFactory,
  createRingBuffer,
  push as ringBufferPush,
  toArray as ringBufferToArray,
} from '@conveaux/port-ring-buffer';

// Re-export contract types for convenience
export type {
  BoundedLeaderboard,
  BoundedLeaderboardOptions,
  BoundedLeaderboardValidationError,
  BoundedLeaderboardValidationResult,
  HistoryBuffer,
  LeaderboardEntry,
  ScoreChange,
  SortedSetData,
} from '@conveaux/contract-bounded-leaderboard';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty bounded leaderboard.
 *
 * @param options - Configuration for the leaderboard
 * @returns A new empty BoundedLeaderboard
 * @throws Error if maxEntries or historySize is negative
 *
 * @example
 * ```typescript
 * const board = createBoundedLeaderboard<string>({
 *   maxEntries: 100,
 *   historySize: 50
 * });
 * ```
 */
export function createBoundedLeaderboard<T>(
  options: BoundedLeaderboardOptions
): BoundedLeaderboard<T> {
  if (options.maxEntries < 0) {
    throw new Error(`maxEntries must be non-negative, got: ${options.maxEntries}`);
  }

  if (options.historySize < 1) {
    throw new Error(`historySize must be positive, got: ${options.historySize}`);
  }

  // Use reverse comparator for descending order (highest scores first)
  const _sortedSet = createSortedSet<T>(reverseNumberComparator);

  // Create ring buffer for score change history
  const historyBuffer = createRingBuffer<ScoreChange<T>>(
    createArrayStorageFactory<ScoreChange<T>>(),
    options.historySize
  );

  return {
    maxEntries: options.maxEntries,
    size: 0,
    sortedSetData: {
      scores: new Map(),
      sorted: [],
    },
    historyBuffer: {
      changes: [],
      head: historyBuffer.head,
      count: historyBuffer.size,
      capacity: historyBuffer.capacity,
    },
    historySize: options.historySize,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Update the score for an item in the leaderboard.
 * If the item doesn't exist, adds it. If it exists, updates the score.
 * Records the change in history.
 *
 * When maxEntries > 0 and the leaderboard is full, adding a new item
 * will remove the lowest-scoring item if the new score is higher.
 *
 * @param board - The bounded leaderboard
 * @param item - The item to update
 * @param newScore - The new score
 * @param timestamp - Optional timestamp (defaults to Date.now())
 * @returns A new leaderboard with the score updated
 *
 * @example
 * ```typescript
 * let board = createBoundedLeaderboard<string>({ maxEntries: 10, historySize: 20 });
 * board = updateScore(board, 'player1', 1500);
 * board = updateScore(board, 'player1', 1600); // Updates existing score
 * ```
 */
export function updateScore<T>(
  board: BoundedLeaderboard<T>,
  item: T,
  newScore: number,
  timestamp?: number
): BoundedLeaderboard<T> {
  const actualTimestamp = timestamp ?? Date.now();

  // Get old score if item exists
  const scores = internalSortedSetFromData(board.sortedSetData);
  const oldScore = sortedSetScore(scores, item);

  // Update sorted set
  let updatedSet = sortedSetAdd(scores, item, newScore);

  // Handle maxEntries limit
  let _itemToRemove: T | undefined = undefined;
  if (board.maxEntries > 0 && sortedSetSize(updatedSet) > board.maxEntries) {
    // Get lowest scoring item (last in descending order)
    const allItems = sortedSetToArray(updatedSet);
    const lastItem = allItems[allItems.length - 1];
    if (lastItem !== undefined && lastItem !== item) {
      _itemToRemove = lastItem;
      const removeResult = sortedSetRemove(updatedSet, lastItem);
      updatedSet = removeResult.set;
    }
  }

  // Create score change record
  const change: ScoreChange<T> = {
    item,
    oldScore,
    newScore,
    timestamp: actualTimestamp,
  };

  // Add change to history
  const historyRingBuffer = internalRingBufferFromData(board.historyBuffer);
  const updatedHistory = ringBufferPush(historyRingBuffer, change);

  return {
    maxEntries: board.maxEntries,
    size: sortedSetSize(updatedSet),
    sortedSetData: internalDataFromSortedSet(updatedSet),
    historyBuffer: internalDataFromRingBuffer(updatedHistory),
    historySize: board.historySize,
  };
}

/**
 * Remove an item from the leaderboard.
 * Records the removal in history.
 *
 * @param board - The bounded leaderboard
 * @param item - The item to remove
 * @param timestamp - Optional timestamp (defaults to Date.now())
 * @returns A new leaderboard with the item removed, and a boolean indicating if it was found
 *
 * @example
 * ```typescript
 * const { board: newBoard, removed } = removeItem(board, 'player1');
 * if (removed) {
 *   console.log('Player removed');
 * }
 * ```
 */
export function removeItem<T>(
  board: BoundedLeaderboard<T>,
  item: T,
  timestamp?: number
): { board: BoundedLeaderboard<T>; removed: boolean } {
  const actualTimestamp = timestamp ?? Date.now();

  const scores = internalSortedSetFromData(board.sortedSetData);
  const oldScore = sortedSetScore(scores, item);

  const removeResult = sortedSetRemove(scores, item);

  if (!removeResult.removed) {
    return { board, removed: false };
  }

  // Record removal in history (newScore can be the old score or 0)
  const change: ScoreChange<T> = {
    item,
    oldScore,
    newScore: 0, // Convention: 0 indicates removal
    timestamp: actualTimestamp,
  };

  const historyRingBuffer = internalRingBufferFromData(board.historyBuffer);
  const updatedHistory = ringBufferPush(historyRingBuffer, change);

  return {
    board: {
      maxEntries: board.maxEntries,
      size: sortedSetSize(removeResult.set),
      sortedSetData: internalDataFromSortedSet(removeResult.set),
      historyBuffer: internalDataFromRingBuffer(updatedHistory),
      historySize: board.historySize,
    },
    removed: true,
  };
}

/**
 * Get the rank (position) of an item in the leaderboard.
 * Rank 0 is the highest scoring item.
 *
 * @param board - The bounded leaderboard
 * @param item - The item to find
 * @returns The rank (0-based index) or undefined if not found
 *
 * @example
 * ```typescript
 * const position = getRank(board, 'player1');
 * if (position !== undefined) {
 *   console.log(`Player is rank ${position + 1}`); // +1 for 1-based display
 * }
 * ```
 */
export function getRank<T>(board: BoundedLeaderboard<T>, item: T): number | undefined {
  const scores = internalSortedSetFromData(board.sortedSetData);
  return sortedSetRank(scores, item);
}

/**
 * Get the top N items from the leaderboard.
 * Returns items ordered from highest to lowest score.
 *
 * @param board - The bounded leaderboard
 * @param n - Number of top items to retrieve
 * @returns Array of top N leaderboard entries
 *
 * @example
 * ```typescript
 * const top10 = getTopN(board, 10);
 * top10.forEach((entry, i) => {
 *   console.log(`${i + 1}. ${entry.item}: ${entry.score}`);
 * });
 * ```
 */
export function getTopN<T>(
  board: BoundedLeaderboard<T>,
  n: number
): readonly LeaderboardEntry<T>[] {
  const scores = internalSortedSetFromData(board.sortedSetData);
  const topItems = sortedSetRange(scores, 0, n);

  return topItems.map((item) => ({
    item,
    score: sortedSetScore(scores, item) ?? 0,
  }));
}

/**
 * Get the score for an item.
 *
 * @param board - The bounded leaderboard
 * @param item - The item to look up
 * @returns The score or undefined if not found
 *
 * @example
 * ```typescript
 * const score = getScore(board, 'player1');
 * if (score !== undefined) {
 *   console.log(`Score: ${score}`);
 * }
 * ```
 */
export function getScore<T>(board: BoundedLeaderboard<T>, item: T): number | undefined {
  const scores = internalSortedSetFromData(board.sortedSetData);
  return sortedSetScore(scores, item);
}

/**
 * Check if an item exists in the leaderboard.
 *
 * @param board - The bounded leaderboard
 * @param item - The item to check
 * @returns True if the item exists
 *
 * @example
 * ```typescript
 * if (hasItem(board, 'player1')) {
 *   console.log('Player is on the leaderboard');
 * }
 * ```
 */
export function hasItem<T>(board: BoundedLeaderboard<T>, item: T): boolean {
  const scores = internalSortedSetFromData(board.sortedSetData);
  return sortedSetHas(scores, item);
}

/**
 * Get all items as leaderboard entries, ordered from highest to lowest score.
 *
 * @param board - The bounded leaderboard
 * @returns Array of all leaderboard entries
 *
 * @example
 * ```typescript
 * const allEntries = getAllEntries(board);
 * ```
 */
export function getAllEntries<T>(board: BoundedLeaderboard<T>): readonly LeaderboardEntry<T>[] {
  const scores = internalSortedSetFromData(board.sortedSetData);
  const allItems = sortedSetToArray(scores);

  return allItems.map((item) => ({
    item,
    score: sortedSetScore(scores, item) ?? 0,
  }));
}

/**
 * Get recent score changes from the history buffer.
 * Returns changes ordered from oldest to newest.
 *
 * @param board - The bounded leaderboard
 * @returns Array of recent score changes
 *
 * @example
 * ```typescript
 * const history = getRecentChanges(board);
 * history.forEach(change => {
 *   console.log(`${change.item}: ${change.oldScore} -> ${change.newScore}`);
 * });
 * ```
 */
export function getRecentChanges<T>(board: BoundedLeaderboard<T>): readonly ScoreChange<T>[] {
  const historyRingBuffer = internalRingBufferFromData(board.historyBuffer);
  return ringBufferToArray(historyRingBuffer);
}

/**
 * Get the number of items in the leaderboard.
 *
 * @param board - The bounded leaderboard
 * @returns The number of items
 */
export function size<T>(board: BoundedLeaderboard<T>): number {
  return board.size;
}

/**
 * Check if the leaderboard is empty.
 *
 * @param board - The bounded leaderboard
 * @returns True if the leaderboard contains no items
 */
export function isEmpty<T>(board: BoundedLeaderboard<T>): boolean {
  return board.size === 0;
}

/**
 * Check if the leaderboard is at capacity.
 *
 * @param board - The bounded leaderboard
 * @returns True if maxEntries > 0 and size >= maxEntries
 */
export function isFull<T>(board: BoundedLeaderboard<T>): boolean {
  return board.maxEntries > 0 && board.size >= board.maxEntries;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a bounded leaderboard's internal consistency.
 *
 * @param board - The bounded leaderboard to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateBoundedLeaderboard(board);
 * if (!result.valid) {
 *   console.error('Invalid leaderboard:', result.errors);
 * }
 * ```
 */
export function validateBoundedLeaderboard<T>(
  board: BoundedLeaderboard<T>
): BoundedLeaderboardValidationResult {
  const errors: BoundedLeaderboardValidationError[] = [];

  // Check maxEntries
  if (board.maxEntries < 0) {
    errors.push({
      type: 'invalid_max_entries',
      details: `maxEntries must be non-negative, got: ${board.maxEntries}`,
    });
  }

  // Check historySize
  if (board.historySize < 1) {
    errors.push({
      type: 'invalid_history_size',
      details: `historySize must be positive, got: ${board.historySize}`,
    });
  }

  // Check size doesn't exceed maxEntries
  if (board.maxEntries > 0 && board.size > board.maxEntries) {
    errors.push({
      type: 'size_exceeds_max',
      details: `size ${board.size} exceeds maxEntries ${board.maxEntries}`,
    });
  }

  // Check sorted set size matches board size
  if (board.sortedSetData.scores.size !== board.size) {
    errors.push({
      type: 'sorted_size_mismatch',
      details: `sorted set size ${board.sortedSetData.scores.size} does not match board size ${board.size}`,
    });
  }

  // Check history buffer consistency
  if (board.historyBuffer.count > board.historyBuffer.capacity) {
    errors.push({
      type: 'history_size_mismatch',
      details: `history count ${board.historyBuffer.count} exceeds capacity ${board.historyBuffer.capacity}`,
    });
  }

  if (board.historyBuffer.head < 0 || board.historyBuffer.head >= board.historyBuffer.capacity) {
    errors.push({
      type: 'invalid_history_head',
      details: `history head ${board.historyBuffer.head} is out of bounds [0, ${board.historyBuffer.capacity - 1}]`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Internal Conversion Helpers
// =============================================================================

/**
 * Convert internal sorted set data to a SortedSet for use with port functions.
 * @internal
 */
function internalSortedSetFromData<T>(data: BoundedLeaderboard<T>['sortedSetData']) {
  let set = createSortedSet<T>(reverseNumberComparator, {
    initialCapacity: data.scores.size,
  });

  // Rebuild the sorted set from stored data
  for (const [item, score] of data.scores) {
    set = sortedSetAdd(set, item, score);
  }

  return set;
}

/**
 * Convert a SortedSet to internal data representation.
 * @internal
 */
function internalDataFromSortedSet<T>(set: ReturnType<typeof createSortedSet<T>>) {
  const scores = new Map<T, number>();
  const sorted: T[] = [];

  set.entries.forEach((entry) => {
    scores.set(entry.item, entry.score);
    sorted.push(entry.item);
  });

  return {
    scores,
    sorted,
  };
}

/**
 * Convert internal ring buffer data to a RingBuffer for use with port functions.
 * @internal
 */
function internalRingBufferFromData<T>(data: BoundedLeaderboard<T>['historyBuffer']) {
  let buffer = createRingBuffer<ScoreChange<T>>(
    createArrayStorageFactory<ScoreChange<T>>(),
    data.capacity
  );

  // Rebuild the ring buffer from stored data
  for (const change of data.changes) {
    buffer = ringBufferPush(buffer, change);
  }

  return buffer;
}

/**
 * Convert a RingBuffer to internal data representation.
 * @internal
 */
function internalDataFromRingBuffer<T>(
  buffer: ReturnType<typeof createRingBuffer<ScoreChange<T>>>
) {
  return {
    changes: ringBufferToArray(buffer),
    head: buffer.head,
    count: buffer.size,
    capacity: buffer.capacity,
  };
}
