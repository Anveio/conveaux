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

// Re-export contract types for convenience
export type {
  Logger,
  LogContext,
  LogLevel,
  LogFields,
  TraceContext,
  LoggerOptions,
  SerializedError,
} from '@conveaux/contract-logger';

/**
 * Numeric priority for log levels (higher = more severe).
 * Exported for consumers who need level comparison logic.
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
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
 * Recursively serialize an Error object for structured logging.
 * Extracts name, message, stack, and recursively handles cause chain.
 */
function serializeError(error: Error): SerializedError {
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

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
  const minLevel = options?.minLevel ?? 'debug';
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
      debug: (message: string, context?: LogContext) =>
        log('debug', message, mergeContext(boundContext, context)),
      info: (message: string, context?: LogContext) =>
        log('info', message, mergeContext(boundContext, context)),
      warn: (message: string, context?: LogContext) =>
        log('warn', message, mergeContext(boundContext, context)),
      error: (message: string, context?: LogContext) =>
        log('error', message, mergeContext(boundContext, context)),
      child: (newContext: LogContext) => createChildLogger(mergeContext(boundContext, newContext)),
    };
  };

  return {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),
    child: createChildLogger,
  };
}

/**
 * Merge two log contexts, with the second overriding the first.
 */
function mergeContext(base: LogContext, override?: LogContext): LogContext {
  if (!override) return base;
  return { ...base, ...override };
}
