/**
 * @conveaux/contract-bounded-leaderboard
 *
 * Pure types for bounded leaderboards with score history.
 * Composes Sorted Set + Ring Buffer for ranked scores with change tracking.
 *
 * Design principle: A bounded leaderboard maintains ranked scores
 * while keeping a circular history of recent score changes.
 * - Contract: pure types (BoundedLeaderboard, ScoreChange, etc.)
 * - Port: pure functions (create, updateScore, getTopN, getRank, etc.)
 *
 * This composition:
 * - O(log n) score operations via sorted set
 * - O(1) history operations via ring buffer
 * - Memory-bounded history tracking
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * A record of a score change in the leaderboard.
 *
 * @template T - The type of items in the leaderboard
 */
export interface ScoreChange<T> {
  /** The item whose score changed */
  readonly item: T;

  /** Previous score (undefined if new entry) */
  readonly oldScore: number | undefined;

  /** New score after the change */
  readonly newScore: number;

  /** Timestamp when the change occurred (ms since epoch) */
  readonly timestamp: number;
}

/**
 * An entry in the leaderboard with item and score.
 *
 * @template T - The type of items in the leaderboard
 */
export interface LeaderboardEntry<T> {
  readonly item: T;
  readonly score: number;
}

/**
 * A bounded leaderboard with score history tracking.
 *
 * Maintains ranked items by score and keeps a circular buffer
 * of recent score changes for auditing or replay.
 *
 * @template T - The type of items in the leaderboard
 *
 * @example
 * ```typescript
 * import { createBoundedLeaderboard, updateScore, getTopN } from '@conveaux/port-bounded-leaderboard';
 *
 * const board = createBoundedLeaderboard<string>({
 *   maxEntries: 100,
 *   historySize: 50
 * });
 *
 * const updated = updateScore(board, 'player1', 1500);
 * const top10 = getTopN(updated, 10);
 * const history = getRecentChanges(updated);
 * ```
 */
export interface BoundedLeaderboard<T> {
  /** Maximum number of entries to keep in the leaderboard */
  readonly maxEntries: number;

  /** Number of items currently in the leaderboard */
  readonly size: number;

  /** Underlying sorted set data (internal representation) */
  readonly sortedSetData: SortedSetData<T>;

  /** Ring buffer of recent score changes */
  readonly historyBuffer: HistoryBuffer<T>;

  /** Maximum number of changes to keep in history */
  readonly historySize: number;
}

/**
 * Internal sorted set data structure.
 * Maps items to their scores and maintains sorted order.
 *
 * @template T - The type of items
 */
export interface SortedSetData<T> {
  /** Map from item to score */
  readonly scores: ReadonlyMap<T, number>;

  /** Items sorted by score descending */
  readonly sorted: readonly T[];
}

/**
 * Internal ring buffer for score change history.
 *
 * @template T - The type of items
 */
export interface HistoryBuffer<T> {
  /** The circular buffer of changes */
  readonly changes: readonly ScoreChange<T>[];

  /** Index of the oldest change (head) */
  readonly head: number;

  /** Number of changes currently stored */
  readonly count: number;

  /** Maximum capacity */
  readonly capacity: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating a bounded leaderboard.
 */
export interface BoundedLeaderboardOptions {
  /** Maximum number of entries in the leaderboard (0 = unlimited) */
  readonly maxEntries: number;

  /** Number of score changes to keep in history */
  readonly historySize: number;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type BoundedLeaderboardValidationErrorType =
  | 'invalid_max_entries'
  | 'invalid_history_size'
  | 'size_exceeds_max'
  | 'sorted_size_mismatch'
  | 'history_size_mismatch'
  | 'invalid_history_head';

/**
 * A validation error found in a bounded leaderboard.
 */
export interface BoundedLeaderboardValidationError {
  readonly type: BoundedLeaderboardValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a bounded leaderboard.
 */
export interface BoundedLeaderboardValidationResult {
  readonly valid: boolean;
  readonly errors: readonly BoundedLeaderboardValidationError[];
}
