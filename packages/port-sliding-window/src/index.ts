/**
 * @conveaux/port-sliding-window
 *
 * Pure functions for operating on sliding windows.
 * Platform agnostic - host provides wall clock for time-based windows.
 *
 * All functions are pure: they take a window and return a new window.
 * The original window is never mutated.
 */

import type {
  SlidingWindow,
  SlidingWindowOptions,
  SlidingWindowValidationError,
  SlidingWindowValidationResult,
  WindowEntry,
} from '@conveaux/contract-sliding-window';
import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export contract types for convenience
export type {
  SlidingWindow,
  SlidingWindowOptions,
  SlidingWindowValidationError,
  SlidingWindowValidationResult,
  WindowEntry,
  WindowType,
} from '@conveaux/contract-sliding-window';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty sliding window with the specified options.
 *
 * @param options - Configuration for the window type and size
 * @returns A new empty SlidingWindow
 * @throws Error if windowSize is not a positive number
 * @throws Error if windowType is not 'count' or 'time'
 *
 * @example
 * ```typescript
 * // Count-based window: keep last 5 items
 * const countWindow = createSlidingWindow({ windowType: 'count', windowSize: 5 });
 *
 * // Time-based window: keep items from last 60 seconds
 * const timeWindow = createSlidingWindow({ windowType: 'time', windowSize: 60000 });
 * ```
 */
export function createSlidingWindow<T>(options: SlidingWindowOptions): SlidingWindow<T> {
  if (options.windowSize <= 0 || !Number.isFinite(options.windowSize)) {
    throw new Error(`Window size must be a positive number, got: ${options.windowSize}`);
  }

  if (options.windowType !== 'count' && options.windowType !== 'time') {
    throw new Error(`Window type must be 'count' or 'time', got: ${options.windowType}`);
  }

  return {
    options,
    entries: [],
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Add an item to the sliding window with an optional timestamp.
 * For time-based windows, old entries are automatically pruned.
 * For count-based windows, oldest entries are dropped when size exceeds windowSize.
 *
 * @param window - The sliding window
 * @param item - The element to add
 * @param clock - Wall clock for getting current time (required for time-based windows)
 * @param timestamp - Optional explicit timestamp (defaults to clock.nowMs())
 * @returns A new window with the element added
 *
 * @example
 * ```typescript
 * const clock = createWallClock();
 * const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
 * const w1 = add(window, 1, clock);
 * const w2 = add(w1, 2, clock);
 * console.log(getWindow(w2)); // [1, 2]
 * ```
 */
export function add<T>(
  window: SlidingWindow<T>,
  item: T,
  clock: WallClock,
  timestamp?: number
): SlidingWindow<T> {
  const now = timestamp ?? clock.nowMs();

  const newEntry: WindowEntry<T> = {
    item,
    timestamp: now,
  };

  // Add the new entry
  const entriesWithNew = [...window.entries, newEntry];

  // Prune based on window type
  if (window.options.windowType === 'count') {
    // Keep only the last N entries
    const startIndex = Math.max(0, entriesWithNew.length - window.options.windowSize);
    return {
      options: window.options,
      entries: entriesWithNew.slice(startIndex),
    };
  }
  // Time-based: remove entries older than or equal to windowSize milliseconds
  const cutoffTime = now - window.options.windowSize;
  const validEntries = entriesWithNew.filter((entry) => entry.timestamp >= cutoffTime);
  return {
    options: window.options,
    entries: validEntries,
  };
}

/**
 * Get all items currently in the window.
 * For time-based windows, expired entries are automatically filtered out.
 *
 * @param window - The sliding window
 * @param clock - Wall clock for current time (required for time-based windows to filter expired entries)
 * @returns Array of items from oldest to newest
 *
 * @example
 * ```typescript
 * const items = getWindow(window, clock);
 * console.log(items); // [oldest, ..., newest]
 * ```
 */
export function getWindow<T>(window: SlidingWindow<T>, clock: WallClock): readonly T[] {
  const validEntries = getValidEntries(window, clock);
  return validEntries.map((entry) => entry.item);
}

/**
 * Get the number of items currently in the window.
 * For time-based windows, expired entries are excluded from the count.
 *
 * @param window - The sliding window
 * @param clock - Wall clock for current time (required for time-based windows)
 * @returns Number of valid items in the window
 *
 * @example
 * ```typescript
 * const itemCount = count(window, clock);
 * console.log(itemCount); // 5
 * ```
 */
export function count<T>(window: SlidingWindow<T>, clock: WallClock): number {
  return getValidEntries(window, clock).length;
}

/**
 * Create a new empty window with the same options.
 *
 * @param window - The sliding window to clear
 * @returns A new empty window with the same configuration
 *
 * @example
 * ```typescript
 * const cleared = clear(window);
 * console.log(count(cleared, clock)); // 0
 * ```
 */
export function clear<T>(window: SlidingWindow<T>): SlidingWindow<T> {
  return createSlidingWindow(window.options);
}

/**
 * Check if the window is empty.
 * For time-based windows, returns true if all entries have expired.
 *
 * @param window - The sliding window
 * @param clock - Wall clock for current time (required for time-based windows)
 * @returns True if the window contains no valid elements
 *
 * @example
 * ```typescript
 * const empty = isEmpty(window, clock);
 * console.log(empty); // true or false
 * ```
 */
export function isEmpty<T>(window: SlidingWindow<T>, clock: WallClock): boolean {
  return count(window, clock) === 0;
}

/**
 * Prune expired entries from a time-based window.
 * For count-based windows, returns the window unchanged.
 *
 * This is useful for explicitly cleaning up memory in long-running time-based windows,
 * though pruning happens automatically during add() operations.
 *
 * @param window - The sliding window
 * @param clock - Wall clock for current time
 * @returns A new window with expired entries removed
 *
 * @example
 * ```typescript
 * const pruned = prune(window, clock);
 * ```
 */
export function prune<T>(window: SlidingWindow<T>, clock: WallClock): SlidingWindow<T> {
  if (window.options.windowType === 'count') {
    return window; // No pruning needed for count-based windows
  }

  const validEntries = getValidEntries(window, clock);

  // If no entries were removed, return the same window reference
  if (validEntries.length === window.entries.length) {
    return window;
  }

  return {
    options: window.options,
    entries: validEntries,
  };
}

/**
 * Get the oldest item in the window without removing it.
 *
 * @param window - The sliding window
 * @param clock - Wall clock for current time (required for time-based windows)
 * @returns The oldest item, or undefined if window is empty
 *
 * @example
 * ```typescript
 * const oldest = peekFirst(window, clock);
 * if (oldest !== undefined) {
 *   console.log('Oldest item:', oldest);
 * }
 * ```
 */
export function peekFirst<T>(window: SlidingWindow<T>, clock: WallClock): T | undefined {
  const validEntries = getValidEntries(window, clock);
  return validEntries[0]?.item;
}

/**
 * Get the newest item in the window without removing it.
 *
 * @param window - The sliding window
 * @param clock - Wall clock for current time (required for time-based windows)
 * @returns The newest item, or undefined if window is empty
 *
 * @example
 * ```typescript
 * const newest = peekLast(window, clock);
 * if (newest !== undefined) {
 *   console.log('Newest item:', newest);
 * }
 * ```
 */
export function peekLast<T>(window: SlidingWindow<T>, clock: WallClock): T | undefined {
  const validEntries = getValidEntries(window, clock);
  return validEntries[validEntries.length - 1]?.item;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get all valid (non-expired) entries from the window.
 *
 * @internal
 */
function getValidEntries<T>(window: SlidingWindow<T>, clock: WallClock): readonly WindowEntry<T>[] {
  if (window.options.windowType === 'count') {
    return window.entries;
  }

  // Time-based: filter out expired entries
  const now = clock.nowMs();
  const cutoffTime = now - window.options.windowSize;
  return window.entries.filter((entry) => entry.timestamp >= cutoffTime);
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a sliding window's internal consistency.
 *
 * @param window - The sliding window to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateSlidingWindow(window);
 * if (!result.valid) {
 *   console.error('Invalid window:', result.errors);
 * }
 * ```
 */
export function validateSlidingWindow<T>(window: SlidingWindow<T>): SlidingWindowValidationResult {
  const errors: SlidingWindowValidationError[] = [];

  // Check window size
  if (window.options.windowSize <= 0 || !Number.isFinite(window.options.windowSize)) {
    errors.push({
      type: 'invalid_window_size',
      details: `Window size must be a positive number, got: ${window.options.windowSize}`,
    });
  }

  // Check window type
  if (window.options.windowType !== 'count' && window.options.windowType !== 'time') {
    errors.push({
      type: 'invalid_window_type',
      details: `Window type must be 'count' or 'time', got: ${window.options.windowType}`,
    });
  }

  // Check entries are sorted by timestamp
  for (let i = 1; i < window.entries.length; i++) {
    const prev = window.entries[i - 1];
    const curr = window.entries[i];
    if (prev && curr && prev.timestamp > curr.timestamp) {
      errors.push({
        type: 'entries_not_sorted',
        details: `Entries must be sorted by timestamp. Found ${prev.timestamp} > ${curr.timestamp} at index ${i}`,
      });
      break; // Only report the first occurrence
    }
  }

  // Check count-based windows don't exceed size
  if (window.options.windowType === 'count') {
    if (window.entries.length > window.options.windowSize) {
      errors.push({
        type: 'count_window_overflow',
        details: `Count-based window has ${window.entries.length} entries, exceeds size limit of ${window.options.windowSize}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
