/**
 * Crypto-based Random implementation.
 * Uses Math.random() for numbers and crypto.randomUUID() for UUIDs.
 */

import { randomUUID } from 'node:crypto';
import type { Random } from '@conveaux/agent-contracts';

/**
 * Creates a Random that uses system randomness.
 */
export function createCryptoRandom(): Random {
  return {
    number(): number {
      return Math.random();
    },

    uuid(): string {
      return randomUUID();
    },

    choice<T>(items: T[]): T {
      if (items.length === 0) {
        throw new Error('Cannot choose from empty array');
      }
      const index = Math.floor(Math.random() * items.length);
      return items[index];
    },
  };
}
