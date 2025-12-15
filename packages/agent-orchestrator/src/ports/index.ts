/**
 * Port implementations and factory functions.
 */

import type { Ports } from '@conveaux/agent-contracts';
import { createLogger } from '@conveaux/port-logger';
import { createStderrChannel } from '@conveaux/port-outchannel';
import { createWallClock as createWallClockFromPort } from '@conveaux/port-wall-clock';
import { createCryptoRandom } from './crypto-random.js';
import { createNodeEnv } from './node-env.js';
import { createWallClock } from './system-clock.js';

// Re-export individual creators
/** @deprecated Use createLogger from @conveaux/port-logger instead */
export { createConsoleLogger } from './console-logger.js';
export { createWallClock } from './system-clock.js';
export { createCryptoRandom } from './crypto-random.js';
export { createNodeEnv } from './node-env.js';

/**
 * Creates a default Ports bundle using Node.js implementations.
 *
 * Note: Logger now uses structured JSON output via @conveaux/port-logger.
 * For the legacy console-based logger, use createConsoleLogger() directly.
 */
export function createDefaultPorts(): Ports {
  const clock = createWallClockFromPort();
  const channel = createStderrChannel();
  const logger = createLogger({
    channel,
    clock,
    options: { minLevel: 'debug' }, // Default to debug to match previous behavior
  });

  return {
    logger,
    clock: createWallClock(),
    random: createCryptoRandom(),
    env: createNodeEnv(),
  };
}
