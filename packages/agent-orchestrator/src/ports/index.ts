/**
 * Port implementations and factory functions.
 */

import type { Ports } from '@conveaux/agent-contracts';
import { createConsoleLogger } from './console-logger.js';
import { createCryptoRandom } from './crypto-random.js';
import { createNodeEnv } from './node-env.js';
import { createSystemClock } from './system-clock.js';

// Re-export individual creators
export { createConsoleLogger } from './console-logger.js';
export { createSystemClock } from './system-clock.js';
export { createCryptoRandom } from './crypto-random.js';
export { createNodeEnv } from './node-env.js';

/**
 * Creates a default Ports bundle using Node.js implementations.
 */
export function createDefaultPorts(): Ports {
  return {
    logger: createConsoleLogger(),
    clock: createSystemClock(),
    random: createCryptoRandom(),
    env: createNodeEnv(),
  };
}
