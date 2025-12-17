/**
 * @conveaux/contract-sliding-window
 *
 * Pure types for sliding windows (time-based or count-based).
 * No runtime code - all operations are pure functions in @conveaux/port-sliding-window.
 *
 * Design principle (following DAG pattern): A sliding window is data, not a capability.
 * - Contract: pure types (SlidingWindow, WindowEntry)
 * - Port: pure functions (add, getWindow, count, clear, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of window state
 * - Time-travel debugging
 * - Testing without mocks
 * - Platform-agnostic implementations
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * Configuration for window type.
 */
export type WindowType = 'count' | 'time';

/**
 * Options for creating a sliding window.
 */
export interface SlidingWindowOptions {
  /**
   * Type of sliding window.
   * - 'count': Fixed number of most recent items
   * - 'time': Items within a time duration from now
   */
  readonly windowType: WindowType;

  /**
   * Size of the window.
   * - For 'count': Maximum number of items to keep
   * - For 'time': Duration in milliseconds
   */
  readonly windowSize: number;
}

/**
 * An entry in the sliding window with timestamp.
 *
 * @template T - The type of the item stored
 */
export interface WindowEntry<T> {
  /** The stored item */
  readonly item: T;

  /** Timestamp when the item was added (milliseconds since Unix epoch) */
  readonly timestamp: number;
}

/**
 * A sliding window is pure data - a collection of timestamped entries.
 *
 * All operations on the sliding window are pure functions in the port.
 * The window is immutable; operations return new window instances.
 *
 * @template T - The type of elements stored
 *
 * @example
 * ```typescript
 * import { createSlidingWindow, add, getWindow } from '@conveaux/port-sliding-window';
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * const clock = createWallClock();
 * const window = createSlidingWindow<number>(clock, { windowType: 'count', windowSize: 5 });
 * const w1 = add(window, 1);
 * const w2 = add(w1, 2);
 * console.log(getWindow(w2)); // [1, 2]
 * ```
 */
export interface SlidingWindow<T> {
  /** Configuration options for the window */
  readonly options: SlidingWindowOptions;

  /**
   * Entries in the window, ordered from oldest to newest.
   * For time-based windows, this may contain expired entries that haven't been pruned yet.
   */
  readonly entries: readonly WindowEntry<T>[];
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type SlidingWindowValidationErrorType =
  | 'invalid_window_size'
  | 'invalid_window_type'
  | 'entries_not_sorted'
  | 'count_window_overflow';

/**
 * A validation error found in a sliding window.
 */
export interface SlidingWindowValidationError {
  readonly type: SlidingWindowValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a sliding window.
 */
export interface SlidingWindowValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SlidingWindowValidationError[];
}
