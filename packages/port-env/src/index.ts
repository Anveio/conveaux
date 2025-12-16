/**
 * @conveaux/port-env
 *
 * Environment variable management implementation.
 * All sources are injected - no direct process.env access.
 *
 * Provides:
 * - createShellEnvSource: Wraps shell environment (process.env)
 * - createStaticEnvSource: Fixed key-value mapping
 * - createOverrideEnvSource: Three-state override semantics
 * - createEnv: Main resolver with priority-based conflict resolution
 */

import type {
  Env,
  EnvOverrides,
  EnvSource,
  SourcePriority,
  StaticEnvVars,
} from '@conveaux/contract-env';

// Re-export all contract types for convenience
export type {
  Env,
  EnvOverrides,
  EnvSource,
  SourcePriority,
  StaticEnvVars,
} from '@conveaux/contract-env';

// =============================================================================
// Source Factory Dependencies
// =============================================================================

/**
 * Dependencies for creating a shell environment source.
 * Follows ColorEnvironmentDeps pattern from port-logger.
 */
export interface ShellEnvSourceDeps {
  /** Function to get environment variable value (e.g., process.env[name]) */
  readonly getEnv: (name: string) => string | undefined;
}

// =============================================================================
// Source Factory Options
// =============================================================================

/**
 * Options for creating a shell environment source.
 */
export interface ShellEnvSourceOptions {
  /** Source name for debugging (default: 'shell') */
  readonly name?: string;
  /** Source priority (default: 10) */
  readonly priority?: SourcePriority;
}

/**
 * Options for creating a static environment source.
 */
export interface StaticEnvSourceOptions {
  /** Source name for debugging (default: 'static') */
  readonly name?: string;
  /** Source priority (default: 0) */
  readonly priority?: SourcePriority;
}

/**
 * Options for creating an override environment source.
 * Supports three-state semantics (undefined/null/string).
 */
export interface OverrideEnvSourceOptions {
  /** Source name for debugging (default: 'override') */
  readonly name?: string;
  /** Source priority (default: 100) */
  readonly priority?: SourcePriority;
}

// =============================================================================
// Env Factory Options
// =============================================================================

/**
 * Options for creating the main Env resolver.
 */
export interface EnvOptions {
  /**
   * Pre-configured sources to register.
   * Will be sorted by priority (highest first) at creation time.
   */
  readonly sources: readonly EnvSource[];
}

// =============================================================================
// Source Factories
// =============================================================================

/**
 * Creates a source that reads from shell environment.
 *
 * @param deps - Shell environment dependencies
 * @param options - Optional configuration
 * @returns An EnvSource wrapping shell environment
 *
 * @example
 * ```typescript
 * const shellSource = createShellEnvSource(
 *   { getEnv: (name) => process.env[name] },
 *   { priority: 10 }
 * );
 * ```
 */
export function createShellEnvSource(
  deps: ShellEnvSourceDeps,
  options: ShellEnvSourceOptions = {}
): EnvSource {
  const { name = 'shell', priority = 10 } = options;

  return {
    name,
    priority,
    get: (key: string): string | undefined => deps.getEnv(key),
  };
}

/**
 * Creates a source from a static key-value mapping.
 *
 * @param vars - Static environment variables
 * @param options - Optional configuration
 * @returns An EnvSource with fixed values
 *
 * @example
 * ```typescript
 * const defaults = createStaticEnvSource(
 *   { AWS_REGION: 'us-east-1', LOG_LEVEL: 'info' },
 *   { name: 'defaults', priority: 0 }
 * );
 * ```
 */
export function createStaticEnvSource(
  vars: StaticEnvVars,
  options: StaticEnvSourceOptions = {}
): EnvSource {
  const { name = 'static', priority = 0 } = options;

  return {
    name,
    priority,
    get: (key: string): string | undefined => vars[key],
  };
}

/**
 * Creates a source with three-state override semantics.
 *
 * Supports explicit "unset" via null values, which shadows
 * all lower-priority sources for that key.
 *
 * @param overrides - Three-state override mapping
 * @param options - Optional configuration
 * @returns An EnvSource with override semantics
 *
 * @example
 * ```typescript
 * const cliFlags = createOverrideEnvSource(
 *   {
 *     AWS_REGION: 'eu-west-1',     // Override to eu-west-1
 *     AWS_PROFILE: null,            // Explicitly unset
 *     // LOG_LEVEL: undefined       // Not provided (fall through)
 *   },
 *   { name: 'cli', priority: 100 }
 * );
 * ```
 */
export function createOverrideEnvSource(
  overrides: EnvOverrides,
  options: OverrideEnvSourceOptions = {}
): EnvSource {
  const { name = 'override', priority = 100 } = options;

  return {
    name,
    priority,
    get: (key: string): string | undefined => {
      // Only check if key exists in overrides object
      if (!Object.hasOwn(overrides, key)) {
        return undefined; // Not provided - fall through
      }

      const value = overrides[key];
      if (value === null) {
        // Explicitly unset - return empty string to "claim" this key
        // The Env resolver will see this as defined and stop searching
        return '';
      }

      return value;
    },
  };
}

// =============================================================================
// Env Factory
// =============================================================================

/**
 * Creates an environment variable resolver with priority-based conflict resolution.
 *
 * Sources are queried in descending priority order.
 * First source to return a defined value wins.
 *
 * @param options - Configuration with sources
 * @returns An Env resolver
 *
 * @example AWS CLI tool use case
 * ```typescript
 * const env = createEnv({
 *   sources: [
 *     createOverrideEnvSource(cliFlags, { name: 'cli', priority: 100 }),
 *     createStaticEnvSource(awsProfileConfig, { name: 'profile', priority: 50 }),
 *     createShellEnvSource({ getEnv: k => process.env[k] }, { priority: 10 }),
 *     createStaticEnvSource(defaults, { name: 'defaults', priority: 0 }),
 *   ],
 * });
 *
 * const region = env.get('AWS_REGION'); // Resolved from highest priority source
 * ```
 */
export function createEnv(options: EnvOptions): Env {
  // Sort sources by priority (descending) at creation time
  const sortedSources = [...options.sources].sort((a, b) => b.priority - a.priority);

  return {
    get(key: string): string | undefined {
      for (const source of sortedSources) {
        const value = source.get(key);
        if (value !== undefined) {
          return value;
        }
      }
      return undefined;
    },
  };
}
