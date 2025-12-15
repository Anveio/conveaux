/**
 * @conveaux/port-clock
 *
 * System clock implementation using JavaScript Date.
 */

import type { Clock } from '@conveaux/contract-clock';

// Re-export the contract type for convenience
export type { Clock } from '@conveaux/contract-clock';

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
