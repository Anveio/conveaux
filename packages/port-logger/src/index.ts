/**
 * @conveaux/port-logger
 *
 * Structured JSON logger implementation.
 * All dependencies (channel, clock) are injected as contracts.
 */

import type { DateConstructor } from '@conveaux/contract-date';
import type {
  AnsiColorName,
  AnsiStyle,
  ColorConfig,
  ColorEnvironment,
  ColorSpec,
  Formatter,
  LogContext,
  LogEntry,
  LogLevel,
  Logger,
  LoggerOptions,
  LoggerTheme,
  SerializedError,
  StyleDefinition,
  ThemeName,
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
  // Color configuration types
  AnsiColorName,
  AnsiStyle,
  Ansi256Color,
  RgbColor,
  HexColor,
  ColorSpec,
  StyleDefinition,
  LoggerTheme,
  ThemeName,
  ColorConfig,
  ColorEnvironment,
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

// =============================================================================
// ANSI Color Constants
// =============================================================================

/** ANSI reset code */
export const ANSI_RESET = '\x1b[0m';

/**
 * ANSI escape code mappings for named foreground colors.
 */
export const ANSI_COLORS: Record<AnsiColorName, string> = {
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

/**
 * ANSI escape code mappings for background colors.
 */
export const ANSI_BG_COLORS: Record<AnsiColorName, string> = {
  black: '\x1b[40m',
  red: '\x1b[41m',
  green: '\x1b[42m',
  yellow: '\x1b[43m',
  blue: '\x1b[44m',
  magenta: '\x1b[45m',
  cyan: '\x1b[46m',
  white: '\x1b[47m',
  gray: '\x1b[100m',
  brightBlack: '\x1b[100m',
  brightRed: '\x1b[101m',
  brightGreen: '\x1b[102m',
  brightYellow: '\x1b[103m',
  brightBlue: '\x1b[104m',
  brightMagenta: '\x1b[105m',
  brightCyan: '\x1b[106m',
  brightWhite: '\x1b[107m',
};

/**
 * ANSI escape codes for text styles.
 */
export const ANSI_STYLES: Record<AnsiStyle, string> = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
};

// =============================================================================
// Theme Definitions
// =============================================================================

type RequiredLoggerTheme = Required<LoggerTheme>;

/**
 * Default theme - matches original hardcoded behavior for backward compatibility.
 */
export const DEFAULT_THEME: RequiredLoggerTheme = {
  trace: { color: 'gray' },
  debug: { color: 'cyan' },
  info: { color: 'green' },
  warn: { color: 'yellow' },
  error: { color: 'red' },
  fatal: { color: 'magenta', styles: ['bold'] },
  timestamp: { styles: ['dim'] },
  message: {},
  fields: { styles: ['dim'] },
  errorText: { color: 'red' },
  stackTrace: { styles: ['dim'] },
};

/**
 * High contrast theme for accessibility.
 */
export const HIGH_CONTRAST_THEME: RequiredLoggerTheme = {
  trace: { color: 'white', styles: ['dim'] },
  debug: { color: 'brightCyan' },
  info: { color: 'brightGreen', styles: ['bold'] },
  warn: { color: 'brightYellow', styles: ['bold'] },
  error: { color: 'brightRed', styles: ['bold'] },
  fatal: { color: 'brightWhite', background: 'red', styles: ['bold'] },
  timestamp: { color: 'brightWhite' },
  message: { color: 'brightWhite' },
  fields: { color: 'brightCyan' },
  errorText: { color: 'brightRed', styles: ['bold'] },
  stackTrace: { color: 'brightRed' },
};

/**
 * Minimal theme - only level colors, nothing else styled.
 */
export const MINIMAL_THEME: RequiredLoggerTheme = {
  trace: { color: 'gray' },
  debug: { color: 'cyan' },
  info: { color: 'green' },
  warn: { color: 'yellow' },
  error: { color: 'red' },
  fatal: { color: 'magenta' },
  timestamp: {},
  message: {},
  fields: {},
  errorText: {},
  stackTrace: {},
};

/**
 * All preset themes mapped by name.
 */
export const PRESET_THEMES: Record<ThemeName, RequiredLoggerTheme> = {
  default: DEFAULT_THEME,
  'high-contrast': HIGH_CONTRAST_THEME,
  minimal: MINIMAL_THEME,
};

// =============================================================================
// Color Environment
// =============================================================================

/**
 * Dependencies for creating a color environment detector.
 */
export interface ColorEnvironmentDeps {
  /** Function to get environment variable value */
  readonly getEnv: (name: string) => string | undefined;
  /** Check if output is a TTY (optional, defaults to false) */
  readonly isTTY?: () => boolean;
}

/**
 * Creates a ColorEnvironment from platform dependencies.
 *
 * @param deps - Platform-specific dependencies
 * @returns A ColorEnvironment implementation
 *
 * @example Node.js usage
 * ```typescript
 * const colorEnv = createColorEnvironment({
 *   getEnv: (name) => process.env[name],
 *   isTTY: () => process.stderr.isTTY ?? false,
 * });
 * ```
 *
 * @example Testing
 * ```typescript
 * const colorEnv = createColorEnvironment({
 *   getEnv: () => undefined,
 *   isTTY: () => true,
 * });
 * ```
 */
export function createColorEnvironment(deps: ColorEnvironmentDeps): ColorEnvironment {
  return {
    isNoColorSet: () => deps.getEnv('NO_COLOR') !== undefined,
    isForceColorSet: () => {
      const value = deps.getEnv('FORCE_COLOR');
      return value !== undefined && value !== '0' && value !== '';
    },
    supportsColor: () => deps.isTTY?.() ?? false,
  };
}

// =============================================================================
// Color Rendering Utilities
// =============================================================================

/**
 * Convert a ColorSpec to ANSI escape sequence.
 */
function colorSpecToAnsi(spec: ColorSpec, isBackground: boolean): string {
  if (typeof spec === 'string') {
    return isBackground ? ANSI_BG_COLORS[spec] : ANSI_COLORS[spec];
  }

  if (spec.type === '256') {
    const code = isBackground ? 48 : 38;
    const index = Math.max(0, Math.min(255, Math.floor(spec.index)));
    return `\x1b[${code};5;${index}m`;
  }

  if (spec.type === 'rgb') {
    const code = isBackground ? 48 : 38;
    const r = Math.max(0, Math.min(255, Math.floor(spec.r)));
    const g = Math.max(0, Math.min(255, Math.floor(spec.g)));
    const b = Math.max(0, Math.min(255, Math.floor(spec.b)));
    return `\x1b[${code};2;${r};${g};${b}m`;
  }

  if (spec.type === 'hex') {
    const rgb = parseHexColor(spec.value);
    if (!rgb) return '';
    const code = isBackground ? 48 : 38;
    return `\x1b[${code};2;${rgb.r};${rgb.g};${rgb.b}m`;
  }

  return '';
}

/**
 * Parse a hex color string to RGB values.
 */
function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;

  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16),
  };
}

/**
 * Apply a StyleDefinition to text.
 */
function applyStyle(text: string, style: StyleDefinition): string {
  if (!(style.color || style.background || style.styles?.length)) {
    return text;
  }

  const codes: string[] = [];

  if (style.color) {
    codes.push(colorSpecToAnsi(style.color, false));
  }

  if (style.background) {
    codes.push(colorSpecToAnsi(style.background, true));
  }

  if (style.styles) {
    for (const s of style.styles) {
      codes.push(ANSI_STYLES[s]);
    }
  }

  return `${codes.join('')}${text}${ANSI_RESET}`;
}

/**
 * Colorizer functions for different log elements.
 */
interface Colorizer {
  level: (level: LogLevel, text: string) => string;
  timestamp: (text: string) => string;
  message: (text: string) => string;
  fields: (text: string) => string;
  errorText: (text: string) => string;
  stackTrace: (text: string) => string;
}

/**
 * Create a colorizer from a theme.
 * Returns a no-op colorizer if theme is null (colors disabled).
 */
function createColorizer(theme: RequiredLoggerTheme | null): Colorizer {
  if (!theme) {
    return {
      level: (_level, text) => text,
      timestamp: (text) => text,
      message: (text) => text,
      fields: (text) => text,
      errorText: (text) => text,
      stackTrace: (text) => text,
    };
  }

  return {
    level: (level, text) => applyStyle(text, theme[level]),
    timestamp: (text) => applyStyle(text, theme.timestamp),
    message: (text) => applyStyle(text, theme.message),
    fields: (text) => applyStyle(text, theme.fields),
    errorText: (text) => applyStyle(text, theme.errorText),
    stackTrace: (text) => applyStyle(text, theme.stackTrace),
  };
}

// =============================================================================
// Pretty Formatter Options
// =============================================================================

/**
 * Options for the pretty formatter.
 * Backward compatible with the old `{ colors?: boolean }` signature.
 */
export interface PrettyFormatterOptions {
  /**
   * Simple color toggle (backward compatible).
   * Equivalent to `{ enabled: colors }` in ColorConfig.
   * Ignored if `colorConfig` is provided.
   * @default true
   */
  readonly colors?: boolean;

  /**
   * Full color configuration.
   * Takes precedence over `colors` if both are specified.
   */
  readonly colorConfig?: ColorConfig;

  /**
   * Color environment for NO_COLOR/FORCE_COLOR detection.
   * If not provided, colors are always enabled unless explicitly disabled.
   *
   * For proper NO_COLOR support, inject this from your composition root:
   * @example
   * ```typescript
   * createPrettyFormatter({
   *   colorEnv: createColorEnvironment({
   *     getEnv: (name) => process.env[name],
   *     isTTY: () => process.stderr.isTTY ?? false,
   *   }),
   * })
   * ```
   */
  readonly colorEnv?: ColorEnvironment;
}

/**
 * Resolve whether colors should be enabled based on all inputs.
 */
function resolveColorEnabled(options?: PrettyFormatterOptions): boolean {
  const config = options?.colorConfig;
  const env = options?.colorEnv;

  // Explicit disable always wins
  if (config?.enabled === false) return false;
  if (options?.colors === false && !config) return false;

  // FORCE_COLOR takes precedence over NO_COLOR
  if (config?.forceColor || env?.isForceColorSet()) return true;

  // Check NO_COLOR (default: respect it)
  const respectNoColor = config?.respectNoColor ?? true;
  if (respectNoColor && env?.isNoColorSet()) return false;

  // Explicit enable
  if (config?.enabled === true || options?.colors === true) return true;

  // Default: enabled
  return true;
}

/**
 * Resolve the effective theme from config.
 */
function resolveTheme(config?: ColorConfig): RequiredLoggerTheme {
  let base = PRESET_THEMES.default;

  if (config?.theme) {
    if (typeof config.theme === 'string') {
      base = PRESET_THEMES[config.theme] ?? PRESET_THEMES.default;
    } else {
      base = { ...base, ...config.theme };
    }
  }

  if (config?.levels) {
    return {
      ...base,
      ...config.levels,
    };
  }

  return base;
}

// =============================================================================
// Formatters
// =============================================================================

/**
 * Creates a pretty formatter for human-readable output.
 * Useful for development and debugging.
 *
 * @param options - Formatter options (optional)
 * @returns A Formatter instance
 *
 * @example Basic usage (colors enabled by default)
 * ```typescript
 * const formatter = createPrettyFormatter();
 * ```
 *
 * @example Disable colors (backward compatible)
 * ```typescript
 * const formatter = createPrettyFormatter({ colors: false });
 * ```
 *
 * @example Custom theme
 * ```typescript
 * const formatter = createPrettyFormatter({
 *   colorConfig: {
 *     theme: {
 *       info: { color: 'brightGreen', styles: ['bold'] },
 *       error: { color: { type: 'rgb', r: 255, g: 80, b: 80 } },
 *     },
 *   },
 * });
 * ```
 *
 * @example Preset theme with NO_COLOR support
 * ```typescript
 * const formatter = createPrettyFormatter({
 *   colorConfig: { theme: 'high-contrast' },
 *   colorEnv: createColorEnvironment({
 *     getEnv: (name) => process.env[name],
 *     isTTY: () => process.stderr.isTTY ?? false,
 *   }),
 * });
 * ```
 */
export function createPrettyFormatter(options?: PrettyFormatterOptions): Formatter {
  // Resolve whether colors should be used
  const useColors = resolveColorEnabled(options);

  // Resolve the effective theme
  const theme = useColors ? resolveTheme(options?.colorConfig) : null;

  // Build the colorizer
  const colorizer = createColorizer(theme);

  const formatLevel = (level: LogLevel): string => {
    const padded = level.toUpperCase().padEnd(5);
    return colorizer.level(level, padded);
  };

  const formatTimestamp = (timestamp: string): string => {
    // Extract time portion (HH:MM:SS.mmm) for concise output
    const time = timestamp.split('T')[1]?.replace('Z', '') ?? timestamp;
    return colorizer.timestamp(time);
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
    return colorizer.fields(` ${formatted}`);
  };

  const formatError = (error: SerializedError): string => {
    const lines: string[] = [];
    lines.push(colorizer.errorText(`  ${error.name}: ${error.message}`));

    if (error.code) {
      lines.push(colorizer.stackTrace(`  Code: ${error.code}`));
    }

    if (error.stack) {
      // Show first 3 stack frames
      const frames = error.stack.split('\n').slice(1, 4);
      for (const frame of frames) {
        lines.push(colorizer.stackTrace(`  ${frame.trim()}`));
      }
    }

    if (error.cause) {
      lines.push(colorizer.stackTrace('  Caused by:'));
      lines.push(formatError(error.cause));
    }

    return lines.join('\n');
  };

  return {
    format: (entry: LogEntry): string => {
      const parts = [
        formatTimestamp(entry.timestamp),
        formatLevel(entry.level),
        colorizer.message(entry.message),
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
