/**
 * @conveaux/port-wall-clock
 *
 * Wall clock implementation for absolute timestamps.
 * Use for logging, IDs, and human-readable time.
 *
 * Follows the hermetic primitive port pattern - requires DateConstructor injection.
 */

import type { DateConstructor } from '@conveaux/contract-date';
import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export contract types for convenience
export type { DateConstructor } from '@conveaux/contract-date';
export type { WallClock } from '@conveaux/contract-wall-clock';

/**
 * Dependencies for creating a wall clock.
 */
export type WallClockDependencies = {
  /**
   * The Date constructor to use for getting current time.
   * Inject the global Date at composition time.
   */
  readonly Date: DateConstructor;
};

/**
 * Options for creating a wall clock.
 */
export type WallClockOptions = {
  /**
   * Optional: custom time source override.
   * If provided, takes precedence over Date.now().
   */
  readonly nowMs?: () => number;
};

/**
 * Creates a wall clock for absolute timestamps.
 *
 * @param deps - Required dependencies (DateConstructor)
 * @param options - Optional configuration
 * @returns A WallClock instance
 *
 * @example
 * ```typescript
 * // Production usage - inject global Date
 * const clock = createWallClock({ Date });
 * console.log(clock.nowMs()); // 1702648800000
 *
 * // Test usage - injectable time
 * let time = 1702648800000;
 * const clock = createWallClock({ Date }, { nowMs: () => time });
 * time += 1000; // Advance 1 second
 * console.log(clock.nowMs()); // 1702648801000
 * ```
 */
export function createWallClock(
  deps: WallClockDependencies,
  options: WallClockOptions = {}
): WallClock {
  const nowMs = options.nowMs ?? (() => deps.Date.now());

  return {
    nowMs: () => nowMs(),
  };
}
