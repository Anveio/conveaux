#!/usr/bin/env node

import { ConveauxError, getExitCode } from '@conveaux/port-control-flow';
import { Command } from 'commander';
import { pollForApproval } from './checker.js';
import { createRuntimeDeps } from './composition.js';
import { GhNotAuthenticatedError, GhNotInstalledError, InvalidPrUrlError } from './errors.js';
import { checkGhAuthenticated, checkGhInstalled, createGitHubClient } from './github.js';
import { EXIT_CODES } from './types.js';
import type { CheckResult, CheckerConfig } from './types.js';

// ============================================================================
// URL Parsing
// ============================================================================

function parsePrUrl(url: string): { owner: string; repo: string; prNumber: number } | null {
  // Matches: https://github.com/owner/repo/pull/123
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!(match?.[1] && match[2] && match[3])) return null;
  return {
    owner: match[1],
    repo: match[2],
    prNumber: Number.parseInt(match[3], 10),
  };
}

// ============================================================================
// CLI Definition
// ============================================================================

const program = new Command();

program
  .name('pr-approval-checker')
  .description(
    `Poll for PR approval from a bot reviewer.

Waits for either:
  - A thumbs up reaction from the bot on any comment (approved)
  - A comment from the bot with feedback (needs changes)

Exit codes:
  0 = approved (bot reacted with thumbs up)
  1 = feedback (bot left a comment)
  2 = timeout (no response within timeout)
  3 = error (invalid input or system failure)`
  )
  .version('0.1.0')
  .argument('<pr-url>', 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)')
  .option('--bot <username>', 'Bot username to check for (env: PR_CHECKER_BOT)')
  .option('--timeout <minutes>', 'Timeout in minutes (env: PR_CHECKER_TIMEOUT)')
  .option('--interval <seconds>', 'Poll interval in seconds (env: PR_CHECKER_INTERVAL)')
  .option('--once', 'Check once and exit (no polling)', false)
  .option('--json', 'Output logs as JSON (for programmatic consumption)', false)
  .option('-v, --verbose', 'Enable debug logging', false)
  .action(async (prUrl: string, options: CliOptions) => {
    // Create runtime dependencies based on CLI options
    const deps = createRuntimeDeps({
      json: options.json,
      verbose: options.verbose,
    });
    const { logger, env, clock, scheduler } = deps;

    try {
      // Parse and validate PR URL
      const parsed = parsePrUrl(prUrl);
      if (!parsed) {
        throw new InvalidPrUrlError(prUrl);
      }

      // Check gh CLI is available and authenticated
      if (!checkGhInstalled()) {
        throw new GhNotInstalledError();
      }
      if (!checkGhAuthenticated()) {
        throw new GhNotAuthenticatedError();
      }

      // Build config from CLI options + environment variables
      const config: CheckerConfig = {
        owner: parsed.owner,
        repo: parsed.repo,
        prNumber: parsed.prNumber,
        botUsername: options.bot ?? env.get('PR_CHECKER_BOT') ?? 'chatgpt-codex-connector[bot]',
        timeoutMs:
          Number.parseInt(options.timeout ?? env.get('PR_CHECKER_TIMEOUT') ?? '10', 10) * 60 * 1000,
        intervalMs:
          Number.parseInt(options.interval ?? env.get('PR_CHECKER_INTERVAL') ?? '30', 10) * 1000,
        once: options.once,
      };

      // Create GitHub client and run the check
      const github = createGitHubClient({ logger });
      const result = await pollForApproval({ logger, clock, github, scheduler }, config);

      // Output result to stdout (always JSON for programmatic consumption)
      console.log(JSON.stringify(result, null, 2));

      // Exit with appropriate code
      process.exit(EXIT_CODES[result.status]);
    } catch (error) {
      handleError(logger, error, prUrl);
    }
  });

// ============================================================================
// Error Handling
// ============================================================================

interface Logger {
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;
}

function parsedToPrInfo(parsed: { owner: string; repo: string; prNumber: number } | null) {
  if (!parsed) return null;
  return { owner: parsed.owner, repo: parsed.repo, number: parsed.prNumber };
}

function handleError(logger: Logger, error: unknown, prUrl: string): never {
  if (error instanceof ConveauxError) {
    logger.error(error.message);
    const result: CheckResult = {
      status: 'error',
      pr: parsedToPrInfo(parsePrUrl(prUrl)),
      message: error.message,
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(getExitCode(error));
  }

  // Unknown error
  const message = error instanceof Error ? error.message : String(error);
  logger.fatal('Unexpected error', { error });
  const result: CheckResult = {
    status: 'error',
    pr: parsedToPrInfo(parsePrUrl(prUrl)),
    message,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(3);
}

// ============================================================================
// Types
// ============================================================================

interface CliOptions {
  bot?: string;
  timeout?: string;
  interval?: string;
  once: boolean;
  json: boolean;
  verbose: boolean;
}

// ============================================================================
// Entry Point
// ============================================================================

program.parse();
