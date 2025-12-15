/**
 * @conveaux/port-wall-clock
 *
 * Wall clock implementation for absolute timestamps.
 * Use for logging, IDs, and human-readable time.
 */

import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export contract type for convenience
export type { WallClock } from '@conveaux/contract-wall-clock';

/**
 * Options for creating a wall clock.
 */
export type WallClockOptions = {
  /**
   * Optional: custom time source.
   * Defaults to Date.now.
   */
  readonly nowMs?: () => number;
};

/**
 * Creates a wall clock for absolute timestamps.
 *
 * @param options - Optional configuration
 * @returns A WallClock instance
 *
 * @example
 * ```typescript
 * // Default usage - uses Date.now
 * const clock = createWallClock();
 * console.log(clock.nowMs()); // 1702648800000
 *
 * // Test usage - injectable time
 * let time = 1702648800000;
 * const clock = createWallClock({ nowMs: () => time });
 * time += 1000; // Advance 1 second
 * console.log(clock.nowMs()); // 1702648801000
 * ```
 */
export function createWallClock(options: WallClockOptions = {}): WallClock {
  const nowMs = options.nowMs ?? Date.now;

  return {
    nowMs: () => nowMs(),
  };
}
