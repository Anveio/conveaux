/**
 * @conveaux/contract-logger
 *
 * Logger contract - interface for structured logging with context.
 * Supports 6 log levels from trace (most verbose) to fatal (most severe).
 */

// =============================================================================
// Color Configuration Types
// =============================================================================

/**
 * Basic 4-bit ANSI color names (foreground).
 * These map to standard terminal colors (30-37, 90-97).
 */
export type AnsiColorName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'gray'
  | 'brightBlack'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite';

/**
 * ANSI text style modifiers.
 */
export type AnsiStyle = 'bold' | 'dim' | 'italic' | 'underline' | 'inverse';

/**
 * 256-color palette index (0-255).
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit
 */
export type Ansi256Color = { readonly type: '256'; readonly index: number };

/**
 * True color (24-bit RGB).
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code#24-bit
 */
export type RgbColor = {
  readonly type: 'rgb';
  readonly r: number;
  readonly g: number;
  readonly b: number;
};

/**
 * Hex color string (e.g., '#ff5733' or 'ff5733').
 * Parsed to RGB at runtime.
 */
export type HexColor = { readonly type: 'hex'; readonly value: string };

/**
 * Color specification - can be a named color, 256-index, RGB, or hex.
 */
export type ColorSpec = AnsiColorName | Ansi256Color | RgbColor | HexColor;

/**
 * Style definition for a single element.
 * Combines foreground color with optional background and text styles.
 */
export interface StyleDefinition {
  /** Foreground color */
  readonly color?: ColorSpec;
  /** Background color */
  readonly background?: ColorSpec;
  /** Text styles to apply */
  readonly styles?: readonly AnsiStyle[];
}

/**
 * Theme definition for log levels and structural elements.
 * All properties are optional - unspecified values use defaults.
 */
export interface LoggerTheme {
  /** Style for trace level */
  readonly trace?: StyleDefinition;
  /** Style for debug level */
  readonly debug?: StyleDefinition;
  /** Style for info level */
  readonly info?: StyleDefinition;
  /** Style for warn level */
  readonly warn?: StyleDefinition;
  /** Style for error level */
  readonly error?: StyleDefinition;
  /** Style for fatal level */
  readonly fatal?: StyleDefinition;
  /** Style for timestamp */
  readonly timestamp?: StyleDefinition;
  /** Style for message text */
  readonly message?: StyleDefinition;
  /** Style for context fields JSON */
  readonly fields?: StyleDefinition;
  /** Style for error name/message */
  readonly errorText?: StyleDefinition;
  /** Style for stack trace */
  readonly stackTrace?: StyleDefinition;
}

/**
 * Preset theme names.
 */
export type ThemeName = 'default' | 'high-contrast' | 'minimal';

/**
 * Color configuration for the pretty formatter.
 *
 * Resolution order:
 * 1. If `enabled: false`, no colors
 * 2. If NO_COLOR env is set and `respectNoColor: true` (default), no colors
 * 3. If FORCE_COLOR env is set, colors enabled regardless of terminal
 * 4. Apply theme (preset or custom)
 * 5. Apply level overrides on top of theme
 *
 * @example Disable colors
 * ```typescript
 * { enabled: false }
 * ```
 *
 * @example Use preset theme
 * ```typescript
 * { theme: 'high-contrast' }
 * ```
 *
 * @example Custom theme
 * ```typescript
 * {
 *   theme: {
 *     info: { color: 'brightGreen', styles: ['bold'] },
 *     error: { color: { type: 'rgb', r: 255, g: 100, b: 100 } }
 *   }
 * }
 * ```
 */
export interface ColorConfig {
  /**
   * Enable or disable colors entirely.
   * @default true (unless NO_COLOR is set)
   */
  readonly enabled?: boolean;

  /**
   * Respect NO_COLOR environment variable.
   * When true and NO_COLOR is set (any value), colors are disabled.
   * @default true
   * @see https://no-color.org/
   */
  readonly respectNoColor?: boolean;

  /**
   * Force color output even when terminal detection suggests no support.
   * Useful for CI environments that support colors but don't advertise it.
   * @default false
   */
  readonly forceColor?: boolean;

  /**
   * Theme to use - either a preset name or custom theme object.
   * @default 'default'
   */
  readonly theme?: ThemeName | LoggerTheme;

  /**
   * Per-level style overrides applied on top of the theme.
   * Allows customizing specific levels without defining a full theme.
   */
  readonly levels?: Partial<Record<LogLevel, StyleDefinition>>;
}

/**
 * Environment detection interface for color support.
 * Injected to make the formatter testable without depending on process.env.
 */
export interface ColorEnvironment {
  /**
   * Check if NO_COLOR environment variable is set.
   * @returns true if NO_COLOR is set to any value
   */
  readonly isNoColorSet: () => boolean;

  /**
   * Check if FORCE_COLOR environment variable is set.
   * @returns true if FORCE_COLOR is set to any truthy value
   */
  readonly isForceColorSet: () => boolean;

  /**
   * Check if the output supports colors (e.g., is a TTY).
   * @returns true if the output appears to support ANSI colors
   */
  readonly supportsColor: () => boolean;
}

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
