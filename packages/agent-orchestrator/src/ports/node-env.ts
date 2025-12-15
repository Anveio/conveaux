/**
 * Node.js Environment implementation.
 * Uses process.env and process.cwd() for environment access.
 */

import type { Environment } from '@conveaux/agent-contracts';

/**
 * Creates an Environment that reads from Node.js process.
 */
export function createNodeEnv(): Environment {
  return {
    get(key: string): string | undefined {
      return process.env[key];
    },

    require(key: string): string {
      const value = process.env[key];
      if (value === undefined) {
        throw new Error(`Required environment variable not set: ${key}`);
      }
      return value;
    },

    cwd(): string {
      return process.cwd();
    },
  };
}
