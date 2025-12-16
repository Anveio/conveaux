#!/usr/bin/env node
/**
 * Claude Code Works CLI
 *
 * An autonomous coding agent using the Claude Agent SDK.
 * Based on Anthropic's effective harnesses pattern.
 */

import { Command } from 'commander';
import { createRuntimeDeps } from './composition.js';
import { runImprovementCycle } from './harness.js';

const program = new Command();

program
  .name('claude-code-works')
  .description('Autonomous coding agent for long-running improvement cycles')
  .version('0.1.0');

program
  .command('run')
  .description('Run the improvement cycle (Initializer -> Coding -> Reviewer)')
  .option('-n, --max-features <n>', 'Maximum features to complete', '5')
  .option(
    '-s, --scope <paths>',
    'Comma-separated paths to focus on (e.g., packages/port-logger,packages/contract-logger)'
  )
  .option('-l, --log-level <level>', 'Log level: trace|debug|info|warn|error|fatal', 'info')
  .option('--no-color', 'Disable colored output')
  .action(
    async (options: {
      maxFeatures: string;
      scope?: string;
      logLevel: string;
      color: boolean;
    }) => {
      const maxFeatures = Number.parseInt(options.maxFeatures, 10);
      const logLevel = options.logLevel as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
      const scope = options.scope?.split(',').map((s) => s.trim());

      const deps = await createRuntimeDeps({
        projectRoot: process.cwd(),
        logLevel,
        colors: options.color,
      });

      const result = await runImprovementCycle(deps, { maxFeatures, scope });

      process.exit(result.featuresCompleted > 0 ? 0 : 1);
    }
  );

program.parse();
