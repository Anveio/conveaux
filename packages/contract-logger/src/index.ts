/**
 * @conveaux/contract-logger
 *
 * Logger contract - interface for structured logging with context.
 */

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
 */
export type LogContext = LogFields & {
  readonly trace?: TraceContext;
};

/**
 * Log level for categorizing log entries.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger interface for structured logging.
 *
 * All log methods accept an optional context object that will be
 * included in the log output. Context can include arbitrary fields
 * plus optional trace information for distributed tracing.
 */
export interface Logger {
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
   * Create a child logger with bound context.
   * All logs from the child will include the bound context.
   */
  child?(context: LogContext): Logger;
}
