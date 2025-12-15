/**
 * @conveaux/port-high-resolution-clock
 *
 * High-resolution monotonic clock implementation.
 * Accepts a platform-injected Timestamper for nanosecond time source.
 */

import type { HighResolutionClock } from '@conveaux/contract-high-resolution-clock';
import type { Timestamper } from '@conveaux/contract-timestamper';

// Re-export contract types for convenience
export type { HighResolutionClock } from '@conveaux/contract-high-resolution-clock';
export type { Timestamper } from '@conveaux/contract-timestamper';

// =============================================================================
// Constants
// =============================================================================

const NS_PER_MS = 1_000_000n;

// =============================================================================
// Options Types
// =============================================================================

/**
 * Options for creating a high-resolution clock.
 */
export type HighResolutionClockOptions = {
  /**
   * Required: the nanosecond time source.
   * Use createNodeTimestamper(), createBrowserTimestamper(), or createDateTimestamper()
   * for platform-specific implementations.
   */
  readonly timestamper: Timestamper;

  /**
   * Optional: wall-clock source for timestamps.
   * Defaults to Date.now.
   */
  readonly wallClock?: () => number;

  /**
   * Optional: custom origin in nanoseconds.
   * Defaults to current timestamper value at creation time.
   */
  readonly originNs?: bigint;
};

// =============================================================================
// Platform Timestamper Factories
// =============================================================================

/**
 * Creates a Node.js timestamper using process.hrtime.bigint().
 * Provides nanosecond precision with an arbitrary epoch.
 */
export function createNodeTimestamper(): Timestamper {
  return {
    nowNs: () => process.hrtime.bigint(),
  };
}

/**
 * Creates a browser timestamper using performance.now().
 * Converts milliseconds to nanoseconds (microsecond precision).
 */
export function createBrowserTimestamper(): Timestamper {
  return {
    nowNs: () => BigInt(Math.round(performance.now() * 1_000_000)),
  };
}

/**
 * Creates a fallback timestamper using Date.now().
 * Provides millisecond precision only.
 */
export function createDateTimestamper(): Timestamper {
  return {
    nowNs: () => BigInt(Date.now()) * NS_PER_MS,
  };
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a high-resolution monotonic clock.
 *
 * @param options - Configuration including required timestamper
 * @returns A HighResolutionClock instance
 *
 * @example
 * ```typescript
 * // Node.js usage
 * const clock = createHighResolutionClock({
 *   timestamper: createNodeTimestamper(),
 * });
 *
 * // Browser usage
 * const clock = createHighResolutionClock({
 *   timestamper: createBrowserTimestamper(),
 * });
 *
 * // Test usage with mock
 * let time = 0n;
 * const clock = createHighResolutionClock({
 *   timestamper: { nowNs: () => time },
 * });
 * time = 1_000_000n; // Advance 1ms
 * console.log(clock.now()); // 1
 * ```
 */
export function createHighResolutionClock(
  options: HighResolutionClockOptions
): HighResolutionClock {
  const { timestamper, wallClock = Date.now } = options;
  const originNs = options.originNs ?? timestamper.nowNs();
  let lastNs = 0n;

  const nowNs = (): bigint => {
    const raw = timestamper.nowNs() - originNs;
    if (raw < lastNs) {
      // Guarantee monotonic non-decreasing clock even if underlying source regresses
      lastNs += 1n;
      return lastNs;
    }
    lastNs = raw;
    return raw;
  };

  const now = (): number => {
    return Number(nowNs()) / Number(NS_PER_MS);
  };

  const hrtime = (): bigint => {
    return timestamper.nowNs();
  };

  const wallClockMs = (): number => {
    return wallClock();
  };

  return {
    now,
    hrtime,
    nowNs,
    wallClockMs,
  };
}
