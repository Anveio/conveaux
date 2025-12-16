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
 * Creates a wall clock for absolute timestamps.
 *
 * @param deps - Required dependencies (DateConstructor)
 * @returns A WallClock instance
 *
 * @example
 * ```typescript
 * // Production usage - inject global Date
 * const clock = createWallClock({ Date });
 * console.log(clock.nowMs()); // 1702648800000
 *
 * // Test usage - inject controllable Date mock
 * let time = 1702648800000;
 * const mockDate = { now: () => time } as DateConstructor;
 * const clock = createWallClock({ Date: mockDate });
 * time += 1000; // Advance 1 second
 * console.log(clock.nowMs()); // 1702648801000
 * ```
 */
export function createWallClock(deps: WallClockDependencies): WallClock {
  return {
    nowMs: () => deps.Date.now(),
  };
}
