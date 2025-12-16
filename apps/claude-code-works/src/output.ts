/**
 * Terminal output utilities.
 *
 * Exports two mechanisms:
 * - `output`: User-facing messages to stdout (simple, colored)
 * - `logger`: Structured logging to stderr (JSON or pretty format)
 */

import { type Logger, createLogger, createPrettyFormatter } from '@conveaux/port-logger';
import { createOutChannel } from '@conveaux/port-outchannel';
import { createWallClock } from '@conveaux/port-wall-clock';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const;

// Composition root: inject platform globals
const clock = createWallClock({ Date });
const stderrChannel = createOutChannel(process.stderr);

/**
 * Structured logger for application logging.
 * Outputs to stderr with pretty formatting.
 * Use for debugging, errors with stack traces, and structured data.
 */
export const logger: Logger = createLogger({
  Date,
  channel: stderrChannel,
  clock,
  options: {
    formatter: createPrettyFormatter({ colors: true }),
    minLevel: 'debug',
  },
});

/**
 * Simple output utilities for user-facing messages.
 * Outputs to stdout with colored terminal output.
 * Use for CLI progress messages, status updates, and user prompts.
 */
export const output = {
  /**
   * Print an info message (blue).
   */
  info: (msg: string): void => {
    console.log(`${colors.blue}${msg}${colors.reset}`);
  },

  /**
   * Print a success message (green).
   */
  success: (msg: string): void => {
    console.log(`${colors.green}${msg}${colors.reset}`);
  },

  /**
   * Print a warning message (yellow).
   */
  warn: (msg: string): void => {
    console.log(`${colors.yellow}${msg}${colors.reset}`);
  },

  /**
   * Print an error message (red) to stderr.
   */
  error: (msg: string): void => {
    console.error(`${colors.red}${msg}${colors.reset}`);
  },

  /**
   * Print a dim message (for less important info).
   */
  dim: (msg: string): void => {
    console.log(`${colors.dim}${msg}${colors.reset}`);
  },

  /**
   * Print a step message (cyan, indented).
   */
  step: (msg: string): void => {
    console.log(`${colors.cyan}  > ${msg}${colors.reset}`);
  },

  /**
   * Print a header message (bold magenta with decoration).
   */
  header: (msg: string): void => {
    console.log(`\n${colors.bold}${colors.magenta}=== ${msg} ===${colors.reset}\n`);
  },
};
