/**
 * Terminal output utilities.
 *
 * Exports two mechanisms:
 * - `output`: User-facing messages to stdout (simple, colored)
 * - `logger`: Structured logging to stderr (JSON or pretty format)
 */

import {
  ANSI_COLORS,
  ANSI_RESET,
  ANSI_STYLES,
  type Logger,
  createLogger,
  createPrettyFormatter,
} from '@conveaux/port-logger';
import { createOutChannel } from '@conveaux/port-outchannel';
import { createWallClock } from '@conveaux/port-wall-clock';

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
    console.log(`${ANSI_COLORS.blue}${msg}${ANSI_RESET}`);
  },

  /**
   * Print a success message (green).
   */
  success: (msg: string): void => {
    console.log(`${ANSI_COLORS.green}${msg}${ANSI_RESET}`);
  },

  /**
   * Print a warning message (yellow).
   */
  warn: (msg: string): void => {
    console.log(`${ANSI_COLORS.yellow}${msg}${ANSI_RESET}`);
  },

  /**
   * Print an error message (red) to stderr.
   */
  error: (msg: string): void => {
    console.error(`${ANSI_COLORS.red}${msg}${ANSI_RESET}`);
  },

  /**
   * Print a dim message (for less important info).
   */
  dim: (msg: string): void => {
    console.log(`${ANSI_STYLES.dim}${msg}${ANSI_RESET}`);
  },

  /**
   * Print a step message (cyan, indented).
   */
  step: (msg: string): void => {
    console.log(`${ANSI_COLORS.cyan}  > ${msg}${ANSI_RESET}`);
  },

  /**
   * Print a header message (bold magenta with decoration).
   */
  header: (msg: string): void => {
    console.log(`\n${ANSI_STYLES.bold}${ANSI_COLORS.magenta}=== ${msg} ===${ANSI_RESET}\n`);
  },
};
