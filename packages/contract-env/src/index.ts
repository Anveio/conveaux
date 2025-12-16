/**
 * @conveaux/contract-env
 *
 * Environment variable management contract - interfaces for priority-based
 * environment variable resolution with pluggable sources.
 *
 * Design Philosophy:
 * - Sources are prioritized buckets (higher priority wins)
 * - Simple string access only (get returns string | undefined)
 * - Fully extensible - consumers register arbitrary sources
 * - Testable - all dependencies injectable
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Priority value for environment sources.
 * Higher values take precedence over lower values.
 *
 * Convention:
 * - 0: Defaults
 * - 10: Shell environment (process.env)
 * - 50: Config files (AWS profiles, .env files)
 * - 100: CLI flags / programmatic overrides
 */
export type SourcePriority = number;

/**
 * A named source of environment variables with a priority.
 *
 * Sources are queried in priority order (highest first).
 * First source to return a defined value wins.
 */
export interface EnvSource {
  /** Human-readable name for debugging/logging */
  readonly name: string;

  /** Priority - higher values take precedence */
  readonly priority: SourcePriority;

  /**
   * Get an environment variable value.
   * @param key - The variable name
   * @returns The value if set, undefined if not present in this source
   */
  get(key: string): string | undefined;
}

/**
 * Environment variable resolver with priority-based conflict resolution.
 *
 * Queries registered sources in priority order.
 * First defined value wins.
 */
export interface Env {
  /**
   * Get an environment variable value.
   *
   * Resolution order:
   * 1. Query sources in descending priority order
   * 2. Return first defined (non-undefined) value
   * 3. Return undefined if no source has the variable
   *
   * @param key - The variable name (e.g., 'AWS_REGION')
   * @returns The resolved value or undefined
   */
  get(key: string): string | undefined;
}

// =============================================================================
// Source Configuration Types
// =============================================================================

/**
 * Static environment variable mapping.
 * Used for defaults and CLI flag injection.
 */
export type StaticEnvVars = Readonly<Record<string, string>>;

/**
 * Three-state override pattern for env sources.
 *
 * Semantics:
 * - `undefined`: Key not present in override (fall through)
 * - `null`: Explicitly unset (shadow lower priority sources)
 * - `string`: Override value
 *
 * This allows explicit "unset" semantics distinct from "not provided".
 */
export type EnvOverrides = Readonly<{
  [key: string]: string | null | undefined;
}>;
