/**
 * Terminal output utilities using ANSI escape codes.
 * No external dependencies.
 */

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

export const output = {
  info: (msg: string): void => {
    console.log(`${colors.blue}${msg}${colors.reset}`);
  },

  success: (msg: string): void => {
    console.log(`${colors.green}${msg}${colors.reset}`);
  },

  warn: (msg: string): void => {
    console.log(`${colors.yellow}${msg}${colors.reset}`);
  },

  error: (msg: string): void => {
    console.error(`${colors.red}${msg}${colors.reset}`);
  },

  dim: (msg: string): void => {
    console.log(`${colors.dim}${msg}${colors.reset}`);
  },

  step: (msg: string): void => {
    console.log(`${colors.cyan}  > ${msg}${colors.reset}`);
  },

  header: (msg: string): void => {
    console.log(`\n${colors.bold}${colors.magenta}=== ${msg} ===${colors.reset}\n`);
  },
};
