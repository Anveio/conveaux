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
 * - createDotEnvSource: Loads .env files asynchronously
 * - createEnv: Main resolver with priority-based conflict resolution
 * - parseDotEnv: Pure function to parse .env file content
 */

import type {
  Env,
  EnvOverrides,
  EnvSource,
  SourcePriority,
  StaticEnvVars,
} from '@conveaux/contract-env';
import type { FileReader } from '@conveaux/contract-file-reader';
import { isOk } from '@conveaux/port-control-flow';

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

// =============================================================================
// DotEnv Parser
// =============================================================================

/**
 * Parse .env file content into key-value pairs.
 *
 * Supports:
 * - KEY=value (basic assignment)
 * - KEY="quoted value" (double quotes, \n expanded)
 * - KEY='literal value' (single quotes, no expansion)
 * - # comments (full line)
 * - KEY=value # inline comment (unquoted only)
 * - export KEY=value (export prefix stripped)
 * - Empty lines (ignored)
 *
 * @param content - Raw .env file content
 * @returns Parsed key-value mapping
 *
 * @example
 * ```typescript
 * const vars = parseDotEnv(`
 *   # Database config
 *   DB_HOST=localhost
 *   DB_PASSWORD="secret with spaces"
 *   export API_KEY=abc123
 * `);
 * // { DB_HOST: 'localhost', DB_PASSWORD: 'secret with spaces', API_KEY: 'abc123' }
 * ```
 */
export function parseDotEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Strip optional 'export ' prefix
    const normalized = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;

    // Find first = sign
    const eqIndex = normalized.indexOf('=');
    if (eqIndex === -1) {
      continue; // Invalid line, skip
    }

    const key = normalized.slice(0, eqIndex).trim();
    if (key === '') {
      continue; // Empty key, skip
    }

    let value = normalized.slice(eqIndex + 1);

    // Parse value based on quoting
    if (value.startsWith('"') && value.includes('"', 1)) {
      // Double-quoted: extract content, expand escapes
      const endQuote = value.lastIndexOf('"');
      if (endQuote > 0) {
        value = value.slice(1, endQuote);
        // Expand common escape sequences
        // IMPORTANT: Process \\\\ first to avoid matching \\t as tab
        const BACKSLASH_PLACEHOLDER = '__CONVEAUX_BACKSLASH__';
        value = value
          .replace(/\\\\/g, BACKSLASH_PLACEHOLDER) // Temp placeholder for literal backslash
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\\"/g, '"')
          .replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), '\\'); // Restore literal backslashes
      }
    } else if (value.startsWith("'") && value.includes("'", 1)) {
      // Single-quoted: extract content, no expansion
      const endQuote = value.lastIndexOf("'");
      if (endQuote > 0) {
        value = value.slice(1, endQuote);
      }
    } else {
      // Unquoted: strip inline comment
      const commentIndex = value.indexOf(' #');
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex);
      }
      value = value.trim();
    }

    result[key] = value;
  }

  return result;
}

// =============================================================================
// DotEnv Source Factory
// =============================================================================

/**
 * Dependencies for creating a .env file source.
 */
export interface DotEnvSourceDeps {
  /** FileReader to load the .env file */
  readonly fileReader: FileReader;
}

/**
 * Options for creating a .env file source.
 */
export interface DotEnvSourceOptions {
  /** Path to the .env file (required) */
  readonly path: string;
  /** Source name for debugging (default: 'dotenv:{path}') */
  readonly name?: string;
  /** Source priority (default: 40) */
  readonly priority?: SourcePriority;
}

/**
 * Creates a source that reads from a .env file.
 *
 * The file is parsed once at creation time. Changes to the file
 * after creation are not reflected (immutable snapshot).
 *
 * If the file cannot be read (missing, permissions), the source
 * returns undefined for all keys (graceful degradation).
 *
 * @param deps - File reading dependencies
 * @param options - Configuration including file path
 * @returns Promise resolving to an EnvSource with parsed .env values
 *
 * @example
 * ```typescript
 * import { createNodeFileReader } from '@conveaux/port-file-reader';
 *
 * const fileReader = createNodeFileReader();
 * const dotEnvSource = await createDotEnvSource(
 *   { fileReader },
 *   { path: '.env', priority: 40 }
 * );
 *
 * const env = createEnv({
 *   sources: [
 *     createShellEnvSource({ getEnv: k => process.env[k] }, { priority: 100 }),
 *     dotEnvSource,
 *   ],
 * });
 * ```
 */
export async function createDotEnvSource(
  deps: DotEnvSourceDeps,
  options: DotEnvSourceOptions
): Promise<EnvSource> {
  const { path } = options;
  const name = options.name ?? `dotenv:${path}`;
  const priority = options.priority ?? 40;

  // Parse file once at creation (immutable snapshot)
  const result = await deps.fileReader.readText(path);
  const vars: Record<string, string> = isOk(result) ? parseDotEnv(result.value) : {}; // Graceful degradation: missing file = empty source

  return {
    name,
    priority,
    get: (key: string): string | undefined => vars[key],
  };
}
