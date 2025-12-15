/**
 * @conveaux/port-outchannel
 *
 * Platform-agnostic output channel implementation.
 * The underlying write target is injected as a dependency.
 */

import type { OutChannel, WritableTarget } from '@conveaux/contract-outchannel';

// Re-export contract types for convenience
export type { OutChannel, WritableTarget } from '@conveaux/contract-outchannel';

/**
 * Creates an OutChannel that writes to the provided target.
 *
 * This is the only factory function - inject your platform-specific
 * write target at the composition root.
 *
 * @param target - Any object with a write(data: string) method
 * @returns OutChannel implementation
 *
 * @example Node.js
 * ```typescript
 * import { createOutChannel } from '@conveaux/port-outchannel';
 *
 * // At composition root
 * const stderr = createOutChannel(process.stderr);
 * const stdout = createOutChannel(process.stdout);
 * ```
 *
 * @example Testing
 * ```typescript
 * const captured: string[] = [];
 * const channel = createOutChannel({ write: (d) => captured.push(d) });
 *
 * channel.write('hello');
 * expect(captured).toEqual(['hello']);
 * ```
 */
export function createOutChannel(target: WritableTarget): OutChannel {
  return {
    write(data: string): void {
      target.write(data);
    },
  };
}
