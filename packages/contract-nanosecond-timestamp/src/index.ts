/**
 * @conveaux/contract-nanosecond-timestamp
 *
 * Platform-agnostic high-resolution timestamp contract.
 * Implementations provide nanosecond timestamps from platform-specific sources.
 */

/**
 * A high-resolution timestamp source that provides nanosecond precision.
 *
 * This abstraction enables:
 * - Platform-agnostic duration measurement
 * - Deterministic testing with injectable time sources
 * - High-precision benchmarking
 *
 * Implementations:
 * - Node.js: process.hrtime.bigint()
 * - Browser: performance.now() converted to nanoseconds
 * - Fallback: Date.now() converted to nanoseconds
 */
export interface NanosecondTimestamp {
  /**
   * Returns the current high-resolution time in nanoseconds.
   *
   * The epoch (starting point) is implementation-defined:
   * - process.hrtime.bigint() uses an arbitrary epoch
   * - performance.now() uses navigation start
   * - Date.now() uses Unix epoch
   *
   * Callers should only rely on monotonicity and precision,
   * not the absolute value. Use for duration measurement, not timestamps.
   *
   * @returns Current time in nanoseconds as bigint
   */
  nowNs(): bigint;
}
