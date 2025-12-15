/**
 * @conveaux/contract-clock
 *
 * Clock contract - interface for time operations.
 * Abstracts Date for testable, deterministic time handling.
 */

/**
 * A clock for time operations.
 *
 * Implementations provide the current time. This abstraction allows
 * ports to be testable with controllable/deterministic time.
 */
export interface Clock {
  /**
   * Get the current date/time.
   */
  now(): Date;

  /**
   * Get the current time as an ISO 8601 timestamp string.
   * Example: "2024-12-15T10:30:00.000Z"
   */
  timestamp(): string;

  /**
   * Get the current time as milliseconds since Unix epoch.
   */
  epochMs(): number;
}
