/**
 * Composition Root (Simplified)
 *
 * Minimal dependency wiring for the harness.
 * Loads environment variables from .env files before Agent SDK runs.
 */

import { join } from 'node:path';
import type { Env } from '@conveaux/contract-env';
import type { Logger } from '@conveaux/contract-logger';
import {
  createDotEnvSource,
  createEnv,
  createShellEnvSource,
  createStaticEnvSource,
} from '@conveaux/port-env';
import { createNodeFileReader } from '@conveaux/port-file-reader';
import { createColorEnvironment, createLogger, createPrettyFormatter } from '@conveaux/port-logger';
import { createOutChannel } from '@conveaux/port-outchannel';

/**
 * Runtime dependencies wired at composition time.
 */
export interface RuntimeDeps {
  /** Structured logger for all output */
  readonly logger: Logger;
  /** Project root directory */
  readonly projectRoot: string;
  /** Environment variable resolver */
  readonly env: Env;
}

/**
 * Options for creating the composition root.
 */
export interface CompositionOptions {
  /** Project root directory */
  readonly projectRoot: string;
  /** Minimum log level (default: 'info') */
  readonly logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Enable colors in output (default: auto-detect) */
  readonly colors?: boolean;
}

/**
 * Load environment from .env files and merge into process.env.
 *
 * Priority (highest wins):
 * 1. Shell environment (process.env)
 * 2. .env.local (local overrides, git-ignored)
 * 3. .env (shared defaults)
 */
async function loadEnv(projectRoot: string): Promise<Env> {
  const fileReader = createNodeFileReader();

  // Create sources with appropriate priorities
  const shellSource = createShellEnvSource(
    { getEnv: (name) => process.env[name] },
    { name: 'shell', priority: 100 }
  );

  // .env.local takes priority over .env (like Next.js/Vite)
  const dotEnvLocalSource = await createDotEnvSource(
    { fileReader },
    { path: join(projectRoot, '.env.local'), name: 'dotenv:local', priority: 50 }
  );

  const dotEnvSource = await createDotEnvSource(
    { fileReader },
    { path: join(projectRoot, '.env'), name: 'dotenv', priority: 40 }
  );

  // Defaults for required vars
  const defaultsSource = createStaticEnvSource(
    {
      LOG_LEVEL: 'info',
    },
    { name: 'defaults', priority: 0 }
  );

  const env = createEnv({
    sources: [shellSource, dotEnvLocalSource, dotEnvSource, defaultsSource],
  });

  // Merge .env values into process.env so Agent SDK can see them
  // (Agent SDK reads ANTHROPIC_API_KEY directly from process.env)
  const apiKey = env.get('ANTHROPIC_API_KEY');
  if (apiKey && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = apiKey;
  }

  return env;
}

/**
 * Create runtime dependencies.
 *
 * @param options - Configuration options
 * @returns Runtime dependencies (logger + projectRoot + env)
 */
export async function createRuntimeDeps(options: CompositionOptions): Promise<RuntimeDeps> {
  const { projectRoot, logLevel = 'info', colors } = options;

  // Load environment first (merges .env files into process.env)
  const env = await loadEnv(projectRoot);

  // Validate required environment variables
  const apiKey = env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not found.\n\n' +
        'Set it via:\n' +
        '  1. Shell: export ANTHROPIC_API_KEY=sk-ant-...\n' +
        '  2. .env.local file: ANTHROPIC_API_KEY=sk-ant-...\n' +
        '  3. .env file: ANTHROPIC_API_KEY=sk-ant-...'
    );
  }

  const channel = createOutChannel(process.stderr);
  const colorEnv = createColorEnvironment({
    getEnv: (name) => process.env[name],
    isTTY: () => process.stderr.isTTY ?? false,
  });

  const logger = createLogger({
    Date,
    channel,
    clock: { nowMs: () => Date.now() },
    options: {
      minLevel: logLevel,
      formatter: createPrettyFormatter({ colors, colorEnv }),
    },
  });

  return { logger, projectRoot, env };
}
