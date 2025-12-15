/**
 * @conveaux/contract-outchannel
 *
 * Output channel contract - interface for writing output to a destination.
 * Abstracts stdout, stderr, file, or any other output destination.
 */

/**
 * A channel for writing output.
 *
 * Implementations may write to stdout, stderr, files, network, etc.
 * This abstraction allows ports to be testable without depending on
 * process.stdout/stderr directly.
 */
export interface OutChannel {
  /**
   * Write data to the output channel.
   * @param data - The string data to write
   */
  write(data: string): void;
}

/**
 * Duck-typed interface for any writable target.
 *
 * This is the dependency that gets injected into the outchannel factory.
 * Compatible with Node.js process.stdout/stderr, custom writers, test mocks, etc.
 *
 * @example Node.js
 * // process.stdout and process.stderr satisfy this interface
 * const target: WritableTarget = process.stderr;
 *
 * @example Testing
 * const captured: string[] = [];
 * const target: WritableTarget = { write: (d) => captured.push(d) };
 */
export interface WritableTarget {
  /**
   * Write data to the underlying target.
   * @param data - The string data to write
   */
  write(data: string): void;
}
