/**
 * @conveaux/port-outchannel
 *
 * Output channel implementations for stdout and stderr.
 */

import type { OutChannel } from '@conveaux/contract-outchannel';

/**
 * Creates an OutChannel that writes to stderr.
 *
 * Use this for CLI tools that output JSON/data to stdout,
 * keeping logs on stderr to avoid interfering.
 */
export function createStderrChannel(): OutChannel {
  return {
    write(data: string): void {
      process.stderr.write(data);
    },
  };
}

/**
 * Creates an OutChannel that writes to stdout.
 */
export function createStdoutChannel(): OutChannel {
  return {
    write(data: string): void {
      process.stdout.write(data);
    },
  };
}
