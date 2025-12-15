/**
 * @conveaux/port-logger
 *
 * Structured JSON logger implementation.
 * All dependencies (channel, clock) are injected as contracts.
 */

import type { DateConstructor } from '@conveaux/contract-date';
import type {
  Formatter,
  LogContext,
  LogEntry,
  LogLevel,
  Logger,
  LoggerOptions,
  SerializedError,
} from '@conveaux/contract-logger';
import type { OutChannel } from '@conveaux/contract-outchannel';
import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export all contract types for convenience
export type { DateConstructor } from '@conveaux/contract-date';
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

// =============================================================================
// Formatters
// =============================================================================

/**
 * Creates a JSON formatter (default formatter).
 * Outputs one JSON object per line (NDJSON format).
 *
 * @example
 * ```typescript
 * const formatter = createJsonFormatter();
 * // Output: {"timestamp":"...","level":"info","message":"Hello"}\n
 * ```
 */
export function createJsonFormatter(): Formatter {
  return {
    format: (entry: LogEntry): string => `${JSON.stringify(entry)}\n`,
  };
}

/**
 * ANSI color codes for terminal output.
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  // Level colors
  trace: '\x1b[90m', // gray
  debug: '\x1b[36m', // cyan
  info: '\x1b[32m', // green
  warn: '\x1b[33m', // yellow
  error: '\x1b[31m', // red
  fatal: '\x1b[35m', // magenta (bold applied separately)
} as const;

/**
 * Creates a pretty formatter for human-readable output.
 * Useful for development and debugging.
 *
 * @param options - Formatter options
 * @param options.colors - Enable ANSI colors (default: true)
 *
 * @example
 * ```typescript
 * const formatter = createPrettyFormatter();
 * // Output: 10:30:00.000 INFO  Hello { userId: "123" }
 *
 * const noColorFormatter = createPrettyFormatter({ colors: false });
 * // Output: 10:30:00.000 INFO  Hello { userId: "123" }
 * ```
 */
export function createPrettyFormatter(options?: { colors?: boolean }): Formatter {
  const useColors = options?.colors ?? true;

  const colorize = (text: string, color: string): string => {
    if (!useColors) return text;
    return `${color}${text}${COLORS.reset}`;
  };

  const formatLevel = (level: LogLevel): string => {
    const padded = level.toUpperCase().padEnd(5);
    if (!useColors) return padded;

    const color = COLORS[level];
    if (level === 'fatal') {
      return `${COLORS.bold}${color}${padded}${COLORS.reset}`;
    }
    return colorize(padded, color);
  };

  const formatTimestamp = (timestamp: string): string => {
    // Extract time portion (HH:MM:SS.mmm) for concise output
    const time = timestamp.split('T')[1]?.replace('Z', '') ?? timestamp;
    return colorize(time, COLORS.dim);
  };

  const formatFields = (entry: LogEntry): string => {
    const { timestamp, level, message, error, trace, fields, ...rest } = entry;
    const allFields = { ...fields, ...rest };

    // Include trace if present
    if (trace) {
      Object.assign(allFields, { trace });
    }

    if (Object.keys(allFields).length === 0) {
      return '';
    }

    const formatted = JSON.stringify(allFields);
    return colorize(` ${formatted}`, COLORS.dim);
  };

  const formatError = (error: SerializedError): string => {
    const lines: string[] = [];
    lines.push(colorize(`  ${error.name}: ${error.message}`, COLORS.error));

    if (error.code) {
      lines.push(colorize(`  Code: ${error.code}`, COLORS.dim));
    }

    if (error.stack) {
      // Show first 3 stack frames
      const frames = error.stack.split('\n').slice(1, 4);
      for (const frame of frames) {
        lines.push(colorize(`  ${frame.trim()}`, COLORS.dim));
      }
    }

    if (error.cause) {
      lines.push(colorize('  Caused by:', COLORS.dim));
      lines.push(formatError(error.cause));
    }

    return lines.join('\n');
  };

  return {
    format: (entry: LogEntry): string => {
      const parts = [
        formatTimestamp(entry.timestamp),
        formatLevel(entry.level),
        entry.message,
        formatFields(entry),
      ];

      let output = parts.join(' ');

      if (entry.error) {
        output += `\n${formatError(entry.error)}`;
      }

      return `${output}\n`;
    },
  };
}

/**
 * Dependencies required by the logger.
 */
export interface LoggerDependencies {
  /** Date constructor for timestamp formatting */
  Date: DateConstructor;
  /** Where to write log output */
  channel: OutChannel;
  /** Clock for timestamps */
  clock: WallClock;
  /** Optional logger configuration */
  options?: LoggerOptions;
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
 * import { createOutChannel } from '@conveaux/port-outchannel';
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * const logger = createLogger({
 *   channel: createOutChannel(process.stderr),
 *   clock: createWallClock(),
 * });
 *
 * logger.info('Server started', { port: 3000 });
 * ```
 */
export function createLogger(deps: LoggerDependencies): Logger {
  const { Date: DateCtor, channel, clock, options } = deps;
  const minLevel = options?.minLevel ?? 'trace';
  const minPriority = LOG_LEVEL_PRIORITY[minLevel];
  const formatter = options?.formatter ?? createJsonFormatter();

  const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVEL_PRIORITY[level] >= minPriority;
  };

  const log = (level: LogLevel, message: string, context?: LogContext): void => {
    if (!shouldLog(level)) {
      return;
    }

    // Build the log entry
    const entry: LogEntry = {
      timestamp: new DateCtor(clock.nowMs()).toISOString(),
      level,
      message,
    };

    // Spread context fields into the entry (except 'trace' and 'error' which get special handling)
    if (context) {
      const { trace, error, ...fields } = context;
      Object.assign(entry, fields);
      if (trace) {
        (entry as LogEntry & { trace: typeof trace }).trace = trace;
      }
      if (error instanceof Error) {
        (entry as LogEntry & { error: SerializedError }).error = serializeError(error);
      }
    }

    channel.write(formatter.format(entry));
  };

  /**
   * Creates a logger instance with optional bound context.
   * Used for both root logger and child loggers.
   */
  const createLoggerInstance = (boundContext?: LogContext): Logger => {
    const logWithContext = (level: LogLevel, message: string, context?: LogContext): void => {
      const merged = boundContext ? mergeContext(boundContext, context) : context;
      log(level, message, merged);
    };

    return {
      trace: (message, context) => logWithContext('trace', message, context),
      debug: (message, context) => logWithContext('debug', message, context),
      info: (message, context) => logWithContext('info', message, context),
      warn: (message, context) => logWithContext('warn', message, context),
      error: (message, context) => logWithContext('error', message, context),
      fatal: (message, context) => logWithContext('fatal', message, context),
      child: (newContext) =>
        createLoggerInstance(boundContext ? mergeContext(boundContext, newContext) : newContext),
      flush: async () => {
        // Synchronous logger - no buffering, nothing to flush
        // Future async implementation would flush batched entries here
      },
    };
  };

  return createLoggerInstance();
}

/**
 * Merge two log contexts, with the second overriding the first.
 */
function mergeContext(base: LogContext, override?: LogContext): LogContext {
  if (!override) return base;
  return { ...base, ...override };
}
