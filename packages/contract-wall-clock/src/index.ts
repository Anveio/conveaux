/**
 * @conveaux/contract-wall-clock
 *
 * Wall clock contract for absolute timestamps.
 * Use for logging, IDs, and human-readable time.
 */

/**
 * A wall clock that provides absolute timestamps.
 *
 * This abstraction enables:
 * - Deterministic testing with injectable time
 * - Consistent timestamp format across the application
 *
 * Note: Wall clock time can jump (NTP sync, DST, etc.).
 * For duration measurement, use NanosecondTimestamp instead.
 */
export interface WallClock {
  /**
   * Returns the current wall-clock time in milliseconds since Unix epoch.
   *
   * Equivalent to Date.now() but injectable for testing.
   *
   * @returns Milliseconds since January 1, 1970 00:00:00 UTC
   */
  nowMs(): number;
}
