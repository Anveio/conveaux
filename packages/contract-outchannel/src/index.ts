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
