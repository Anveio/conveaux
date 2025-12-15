/**
 * @conveaux/contract-high-resolution-clock
 *
 * High-resolution monotonic clock contract with wall-clock access.
 * Follows the firedrill pattern for hermetic primitive ports.
 */

/**
 * A high-resolution monotonic clock instance with wall-clock access.
 *
 * This abstraction enables:
 * - Deterministic testing with injectable time sources
 * - High-resolution timing for benchmarks (nanosecond precision)
 * - Monotonic guarantees (clock never goes backward)
 * - Wall-clock access for timestamps
 */
export interface HighResolutionClock {
  /**
   * Monotonic milliseconds since clock origin.
   * Guaranteed non-decreasing even if the underlying source regresses.
   * Use for durations, ordering, and benchmarks.
   *
   * @returns Milliseconds elapsed since clock creation
   */
  now(): number;

  /**
   * High-resolution time in nanoseconds.
   * Returns bigint from process.hrtime.bigint() when available,
   * or derived from milliseconds otherwise.
   *
   * @returns Nanoseconds for high-precision timing
   */
  hrtime(): bigint;

  /**
   * Wall-clock milliseconds since Unix epoch.
   * Use for timestamps that need absolute time (e.g., logging).
   * Unlike now(), this is NOT guaranteed monotonic.
   *
   * @returns Unix epoch milliseconds (same as Date.now())
   */
  wallClockMs(): number;
}
