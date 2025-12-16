/**
 * Environment variable composition root for claude-code-works.
 *
 * Creates a fully configured Env instance with priority-based sources:
 * 1. Shell environment (priority 100) - CI/production
 * 2. .env.local (priority 50) - Personal developer overrides
 * 3. .env (priority 40) - Shared development defaults
 */

import { join } from 'node:path';
import { type Env, createDotEnvSource, createEnv, createShellEnvSource } from '@conveaux/port-env';
import { createNodeFileReader } from '@conveaux/port-file-reader';

/**
 * Create the application's environment configuration.
 *
 * @param projectRoot - Root directory for .env file resolution
 * @returns Configured Env instance
 */
export async function createAppEnv(projectRoot: string = process.cwd()): Promise<Env> {
  // Create FileReader port implementation
  const fileReader = createNodeFileReader();

  // Inject FileReader into dotenv sources
  return createEnv({
    sources: [
      // Shell environment (CI, production) - highest priority
      createShellEnvSource(
        { getEnv: (name) => process.env[name] },
        { name: 'shell', priority: 100 }
      ),

      // .env.local - personal developer overrides (gitignored)
      await createDotEnvSource(
        { fileReader },
        { path: join(projectRoot, '.env.local'), priority: 50 }
      ),

      // .env - shared development defaults (gitignored, but .env.example committed)
      await createDotEnvSource({ fileReader }, { path: join(projectRoot, '.env'), priority: 40 }),
    ],
  });
}

// Lazy async singleton
let appEnvPromise: Promise<Env> | undefined;

/**
 * Get the application environment (singleton).
 * Initialized lazily on first access.
 */
export function getAppEnv(): Promise<Env> {
  if (appEnvPromise === undefined) {
    appEnvPromise = createAppEnv();
  }
  return appEnvPromise;
}
