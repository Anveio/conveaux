/**
 * @conveaux/contract-logger
 *
 * Logger contract - interface for structured logging with context.
 * Supports 6 log levels from trace (most verbose) to fatal (most severe).
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Arbitrary log context fields.
 */
export type LogFields = Record<string, unknown>;

/**
 * Trace context for distributed tracing correlation.
 */
export type TraceContext = {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly causationId?: string;
  readonly sampled?: boolean;
};

/**
 * Log context combining arbitrary fields with optional trace context.
 * Include an `error` property with an Error instance for automatic serialization.
 */
export type LogContext = LogFields & {
  readonly trace?: TraceContext;
  readonly error?: Error;
};

/**
 * Log level for categorizing log entries.
 * Levels ordered from most verbose (trace) to most severe (fatal).
 *
 * Priority mapping:
 * - trace: 0 (most verbose, below debug)
 * - debug: 1 (detailed debugging)
 * - info: 2 (general operational)
 * - warn: 3 (potential problems)
 * - error: 4 (error conditions)
 * - fatal: 5 (unrecoverable errors)
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Serialized representation of an Error for structured logging.
 * Automatically extracted when an Error object is present in context.
 */
export interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: SerializedError;
  /** Optional error code (e.g., 'ENOENT', 'ECONNREFUSED') */
  readonly code?: string;
}

/**
 * A single log entry as structured output.
 * This is the shape of data after formatting, before transport.
 */
export interface LogEntry {
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly fields?: LogFields;
  readonly trace?: TraceContext;
  readonly error?: SerializedError;
}

// =============================================================================
// Extension Points (for future phases)
// =============================================================================

/**
 * Formatter transforms a LogEntry into a string for output.
 * Implementations: JSON formatter, pretty formatter, etc.
 */
export interface Formatter {
  /**
   * Format a log entry into a string.
   * @param entry - The log entry to format
   * @returns Formatted string (typically with trailing newline)
   */
  format(entry: LogEntry): string;
}

/**
 * Transport writes formatted log output to a destination.
 * Implementations: stdout, file, cloud service, etc.
 */
export interface Transport {
  /**
   * Write formatted output to the destination.
   * May be synchronous or asynchronous.
   */
  write(formatted: string): void | Promise<void>;

  /**
   * Flush any buffered output.
   * Called on logger.flush() and on graceful shutdown.
   */
  flush?(): Promise<void>;
}

/**
 * Redactor modifies log entries to remove sensitive data.
 * Applied before formatting to prevent secrets/PII from reaching output.
 */
export interface Redactor {
  /**
   * Redact sensitive data from a log entry.
   * @param entry - The original log entry
   * @returns Modified entry with sensitive data masked/removed
   */
  redact(entry: LogEntry): LogEntry;
}

/**
 * Sampler controls which log entries are emitted.
 * Used for rate limiting or probabilistic sampling in high-throughput scenarios.
 */
export interface Sampler {
  /**
   * Determine whether a log at the given level should be emitted.
   * @param level - The log level
   * @param context - Optional context for sampling decisions
   * @returns true if the log should be emitted, false to drop
   */
  shouldLog(level: LogLevel, context?: LogContext): boolean;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Options for configuring logger behavior.
 */
export interface LoggerOptions {
  /**
   * Minimum log level to emit. Logs below this level are silently dropped.
   * @default 'trace' (all logs emitted)
   */
  readonly minLevel?: LogLevel;

  /**
   * Custom formatter for log entries.
   * If not provided, uses default JSON formatter.
   */
  readonly formatter?: Formatter;

  /**
   * Redactor for removing sensitive data.
   * Applied before formatting.
   */
  readonly redactor?: Redactor;

  /**
   * Sampler for rate limiting or probabilistic sampling.
   * Applied before redaction and formatting.
   */
  readonly sampler?: Sampler;

  /**
   * Async configuration for batched writes.
   * - false or undefined: synchronous writes (default)
   * - true: async with default settings
   * - object: async with custom batch size and flush interval
   */
  readonly async?:
    | boolean
    | {
        /** Maximum entries to batch before flushing */
        readonly batchSize?: number;
        /** Interval in ms to flush batched entries */
        readonly flushInterval?: number;
      };
}

// =============================================================================
// Logger Interface
// =============================================================================

/**
 * Logger interface for structured logging.
 *
 * All log methods accept an optional context object that will be
 * included in the log output. Context can include arbitrary fields
 * plus optional trace information for distributed tracing.
 *
 * @example
 * ```typescript
 * logger.info('User logged in', { userId: '123', trace: { traceId: 'abc' } });
 * logger.error('Request failed', { error: new Error('timeout'), requestId: 'xyz' });
 *
 * const childLogger = logger.child({ service: 'auth' });
 * childLogger.info('Token validated'); // Includes service: 'auth'
 * ```
 */
export interface Logger {
  /**
   * Log a trace message.
   * Use for very detailed debugging (more verbose than debug).
   */
  trace(message: string, context?: LogContext): void;

  /**
   * Log a debug message.
   * Use for detailed debugging information.
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log an info message.
   * Use for general operational information.
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log a warning message.
   * Use for potentially problematic situations.
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log an error message.
   * Use for error conditions.
   */
  error(message: string, context?: LogContext): void;

  /**
   * Log a fatal message.
   * Use for unrecoverable errors that require immediate attention.
   */
  fatal(message: string, context?: LogContext): void;

  /**
   * Create a child logger with bound context.
   * All logs from the child will include the bound context.
   */
  child(context: LogContext): Logger;

  /**
   * Flush any buffered log entries.
   * Call this before process exit to ensure all logs are written.
   * No-op for synchronous loggers.
   */
  flush(): Promise<void>;
}
