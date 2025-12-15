/**
 * System Clock implementation.
 * Uses JavaScript Date for time operations.
 */

import type { Clock } from '@conveaux/agent-contracts';

/**
 * Creates a Clock that uses the system time.
 */
export function createSystemClock(): Clock {
  return {
    now(): Date {
      return new Date();
    },

    timestamp(): string {
      return new Date().toISOString();
    },

    epochMs(): number {
      return Date.now();
    },
  };
}
