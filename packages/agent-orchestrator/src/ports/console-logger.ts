/**
 * Console-based Logger implementation.
 * Uses Node.js console.* methods for output.
 */

import type { Logger } from '@conveaux/agent-contracts';

/**
 * Creates a Logger that writes to console.
 */
export function createConsoleLogger(): Logger {
  return {
    debug(message: string, context?: Record<string, unknown>): void {
      if (context) {
        console.debug(message, context);
      } else {
        console.debug(message);
      }
    },

    info(message: string, context?: Record<string, unknown>): void {
      if (context) {
        console.info(message, context);
      } else {
        console.info(message);
      }
    },

    warn(message: string, context?: Record<string, unknown>): void {
      if (context) {
        console.warn(message, context);
      } else {
        console.warn(message);
      }
    },

    error(message: string, context?: Record<string, unknown>): void {
      if (context) {
        console.error(message, context);
      } else {
        console.error(message);
      }
    },
  };
}
