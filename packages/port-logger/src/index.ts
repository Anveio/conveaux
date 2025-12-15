/**
 * @conveaux/port-logger
 *
 * Structured JSON logger implementation.
 * All dependencies (channel, clock) are injected as contracts.
 */

import type {
  LogContext,
  LogLevel,
  Logger,
  LoggerOptions,
  SerializedError,
} from '@conveaux/contract-logger';
import type { OutChannel } from '@conveaux/contract-outchannel';
import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export all contract types for convenience
export type {
  // Core types
  Logger,
  LogContext,
  LogLevel,
  LogFields,
  TraceContext,
  LoggerOptions,
  SerializedError,
  LogEntry,
  // Extension points (for future phases)
  Formatter,
  Transport,
  Redactor,
  Sampler,
} from '@conveaux/contract-logger';

/**
 * Numeric priority for log levels (higher = more severe).
 * Exported for consumers who need level comparison logic.
 *
 * Priority order: trace (0) < debug (1) < info (2) < warn (3) < error (4) < fatal (5)
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Dependencies required by the logger.
 */
export interface LoggerDependencies {
  /** Where to write log output */
  channel: OutChannel;
  /** Clock for timestamps */
  clock: WallClock;
  /** Optional logger configuration */
  options?: LoggerOptions;
}

/**
 * A single log entry as written to the channel.
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  error?: SerializedError;
  [key: string]: unknown;
}

/**
 * Check if a log level is enabled given a minimum level.
 * Useful for conditional logging or pre-computation checks.
 *
 * @param current - The level to check
 * @param min - The minimum enabled level
 * @returns true if current level would be logged at min level
 *
 * @example
 * ```typescript
 * if (isLevelEnabled('debug', 'info')) {
 *   // This is false - debug is below info
 * }
 * if (isLevelEnabled('warn', 'info')) {
 *   // This is true - warn is at or above info
 * }
 * ```
 */
export function isLevelEnabled(current: LogLevel, min: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[current] >= LOG_LEVEL_PRIORITY[min];
}

/**
 * Recursively serialize an Error object for structured logging.
 * Extracts name, message, stack, and recursively handles cause chain.
 * Also extracts the `code` property if present (common in Node.js errors).
 *
 * @param error - The Error to serialize
 * @returns Serialized error object suitable for JSON output
 */
export function serializeError(error: Error): SerializedError {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  // Extract error code if present (common in Node.js errors like ENOENT)
  const errorWithCode = error as Error & { code?: string };
  if (typeof errorWithCode.code === 'string') {
    return {
      ...serialized,
      code: errorWithCode.code,
      ...(error.cause instanceof Error ? { cause: serializeError(error.cause) } : {}),
    };
  }

  if (error.cause instanceof Error) {
    return { ...serialized, cause: serializeError(error.cause) };
  }

  return serialized;
}

/**
 * Creates a structured JSON logger.
 *
 * @param deps - Injected dependencies (channel and clock)
 * @returns A Logger instance
 *
 * @example
 * ```typescript
 * import { createLogger } from '@conveaux/port-logger';
 * import { createStderrChannel } from '@conveaux/port-outchannel';
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * const logger = createLogger({
 *   channel: createStderrChannel(),
 *   clock: createWallClock(),
 * });
 *
 * logger.info('Server started', { port: 3000 });
 * ```
 */
export function createLogger(deps: LoggerDependencies): Logger {
  const { channel, clock, options } = deps;
  const minLevel = options?.minLevel ?? 'trace';
  const minPriority = LOG_LEVEL_PRIORITY[minLevel];

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= minPriority;
  };

  const log = (level: LogLevel, message: string, context?: LogContext): void => {
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(clock.nowMs()).toISOString(),
      level,
      message,
    };

    // Spread context fields into the entry (except 'trace' and 'error' which get special handling)
    if (context) {
      const { trace, error, ...fields } = context;
      Object.assign(entry, fields);
      if (trace) {
        entry.trace = trace;
      }
      if (error instanceof Error) {
        entry.error = serializeError(error);
      }
    }

    channel.write(`${JSON.stringify(entry)}\n`);
  };

  const createChildLogger = (boundContext: LogContext): Logger => {
    return {
      trace: (message: string, context?: LogContext) =>
        log('trace', message, mergeContext(boundContext, context)),
      debug: (message: string, context?: LogContext) =>
        log('debug', message, mergeContext(boundContext, context)),
      info: (message: string, context?: LogContext) =>
        log('info', message, mergeContext(boundContext, context)),
      warn: (message: string, context?: LogContext) =>
        log('warn', message, mergeContext(boundContext, context)),
      error: (message: string, context?: LogContext) =>
        log('error', message, mergeContext(boundContext, context)),
      fatal: (message: string, context?: LogContext) =>
        log('fatal', message, mergeContext(boundContext, context)),
      child: (newContext: LogContext) => createChildLogger(mergeContext(boundContext, newContext)),
      flush: async () => {
        // Child loggers delegate to the same channel, no separate buffering
      },
    };
  };

  return {
    trace: (message: string, context?: LogContext) => log('trace', message, context),
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),
    fatal: (message: string, context?: LogContext) => log('fatal', message, context),
    child: createChildLogger,
    flush: async () => {
      // Synchronous logger - no buffering, nothing to flush
      // Future async implementation would flush batched entries here
    },
  };
}

/**
 * Merge two log contexts, with the second overriding the first.
 */
function mergeContext(base: LogContext, override?: LogContext): LogContext {
  if (!override) return base;
  return { ...base, ...override };
}
