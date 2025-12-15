/**
 * Console-based Logger implementation.
 * Uses Node.js console.* methods for output.
 *
 * @deprecated Use `createLogger` from `@conveaux/port-logger` instead.
 * This provides structured JSON logging with better observability.
 *
 * Migration guide:
 * ```typescript
 * // Before
 * import { createConsoleLogger } from '@conveaux/agent-orchestrator/ports';
 * const logger = createConsoleLogger();
 *
 * // After
 * import { createLogger } from '@conveaux/port-logger';
 * import { createStderrChannel } from '@conveaux/port-outchannel';
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * const logger = createLogger({
 *   channel: createStderrChannel(),
 *   clock: createWallClock(),
 * });
 * ```
 *
 * @module
 */

import type { Logger } from '@conveaux/agent-contracts';

/**
 * Creates a Logger that writes to console.
 *
 * @deprecated Use `createLogger` from `@conveaux/port-logger` instead.
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
