/**
 * @conveaux/contract-timestamper
 *
 * Platform-agnostic high-resolution timestamper contract.
 * Implementations provide nanosecond timestamps from platform-specific sources.
 */

/**
 * A high-resolution timestamper that provides nanosecond timestamps.
 *
 * This abstraction enables:
 * - Platform-agnostic clock implementations
 * - Deterministic testing with injectable time sources
 * - Clean separation between time source and clock logic
 *
 * Implementations:
 * - Node.js: process.hrtime.bigint()
 * - Browser: performance.now() converted to nanoseconds
 * - Fallback: Date.now() converted to nanoseconds
 */
export interface Timestamper {
  /**
   * Returns the current high-resolution time in nanoseconds.
   *
   * The epoch (starting point) is implementation-defined:
   * - process.hrtime.bigint() uses an arbitrary epoch
   * - performance.now() uses navigation start
   * - Date.now() uses Unix epoch
   *
   * Callers should only rely on monotonicity and precision,
   * not the absolute value.
   *
   * @returns Current time in nanoseconds as bigint
   */
  nowNs(): bigint;
}
