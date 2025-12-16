import type { Env } from '@conveaux/contract-env';
import type { EphemeralScheduler } from '@conveaux/contract-ephemeral-scheduler';
import type { Logger } from '@conveaux/contract-logger';
import type { WallClock } from '@conveaux/contract-wall-clock';
import { createEnv, createShellEnvSource, createStaticEnvSource } from '@conveaux/port-env';
import { createEphemeralScheduler } from '@conveaux/port-ephemeral-scheduler';
import { createJsonFormatter, createLogger, createPrettyFormatter } from '@conveaux/port-logger';
import { createOutChannel } from '@conveaux/port-outchannel';
import { createWallClock } from '@conveaux/port-wall-clock';

// ============================================================================
// Runtime Dependencies
// ============================================================================

export interface RuntimeDeps {
  readonly logger: Logger;
  readonly clock: WallClock;
  readonly env: Env;
  readonly scheduler: EphemeralScheduler;
}

export interface RuntimeOptions {
  /** Output logs as JSON (for agents/programmatic consumption) */
  readonly json?: boolean;
  /** Enable debug-level logging */
  readonly verbose?: boolean;
}

// ============================================================================
// Dependency Factory
// ============================================================================

/**
 * Create runtime dependencies for the PR approval checker.
 *
 * This is the composition root - all platform globals are injected here.
 */
export function createRuntimeDeps(options: RuntimeOptions = {}): RuntimeDeps {
  // Clock (injectable Date for testing)
  const clock = createWallClock({ Date });

  // Scheduler (injectable timers for testing)
  const scheduler = createEphemeralScheduler({
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  });

  // Output channel (stderr for logs, stdout for JSON result)
  const logChannel = createOutChannel(process.stderr);

  // Logger with appropriate formatter based on options
  const formatter = options.json
    ? createJsonFormatter()
    : createPrettyFormatter({ colors: process.stderr.isTTY ?? false });

  const logger = createLogger({
    Date,
    channel: logChannel,
    clock,
    options: {
      formatter,
      minLevel: options.verbose ? 'debug' : 'info',
    },
  });

  // Environment with defaults and shell overrides
  const env = createEnv({
    sources: [
      // Shell environment has highest priority (can override defaults)
      createShellEnvSource(
        { getEnv: (name) => process.env[name] },
        { name: 'shell', priority: 100 }
      ),
      // Defaults have lowest priority
      createStaticEnvSource(
        {
          PR_CHECKER_BOT: 'chatgpt-codex-connector[bot]',
          PR_CHECKER_TIMEOUT: '10',
          PR_CHECKER_INTERVAL: '30',
        },
        { name: 'defaults', priority: 0 }
      ),
    ],
  });

  return { logger, clock, env, scheduler };
}
