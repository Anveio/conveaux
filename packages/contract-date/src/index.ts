/**
 * @conveaux/contract-date
 *
 * Date contract for timestamp formatting and parsing.
 * Provides an injectable DateConstructor interface that matches the global Date API.
 *
 * Usage:
 * - Inject the global Date constructor at composition time
 * - Use DateConstructor for creating, formatting, and parsing timestamps
 * - Use WallClock contract for getting current time (Date.now equivalent)
 */

/**
 * A Date constructor interface for creating Date objects.
 *
 * This abstraction enables:
 * - Deterministic testing with mock Date implementations
 * - Runtime-agnostic code that works in Node.js and browsers
 *
 * Note: For getting current time, use WallClock.nowMs() instead of Date.now().
 * This contract focuses on Date construction, formatting, and parsing.
 *
 * The constructor returns full Date objects because:
 * - Consumer code often needs full Date functionality
 * - At composition time, the real Date constructor is injected
 * - Mocks can return real Date objects with controlled values
 *
 * @example
 * ```typescript
 * // Inject the global Date at composition time
 * const deps = { Date };
 *
 * // Use in functions
 * function formatTimestamp(ms: number, DateCtor: DateConstructor): string {
 *   return new DateCtor(ms).toISOString();
 * }
 * ```
 */
export interface DateConstructor {
  /**
   * Creates a Date from milliseconds since epoch.
   *
   * @param value - Milliseconds since January 1, 1970 00:00:00 UTC
   */
  new (value: number): Date;

  /**
   * Creates a Date by parsing a date string (typically ISO 8601).
   *
   * @param value - A date string to parse
   */
  new (value: string): Date;

  /**
   * Returns the current time in milliseconds since epoch.
   *
   * Equivalent to Date.now().
   *
   * Note: For most use cases, prefer WallClock.nowMs() which provides
   * the same functionality with a clearer contract. Use this only when
   * you need a DateConstructor but also need current time.
   */
  now(): number;
}
