#!/usr/bin/env node
/**
 * Claude Code Works CLI
 *
 * An autonomous coding agent using the Claude Agent SDK.
 * Implements the three-agent pattern from Anthropic's engineering blog:
 * https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { Command } from 'commander';
import { createRuntimeDeps } from './composition.js';
import type { FeatureCategory } from './contracts/index.js';
import { runImprovementCycle } from './harness.js';

const program = new Command();

program
  .name('claude-code-works')
  .description('Autonomous coding agent using Claude Agent SDK')
  .version('0.1.0');

/**
 * Quickstart command - reproduces the Agent SDK quickstart example.
 * Demonstrates basic query() usage with tool access.
 */
program
  .command('quickstart')
  .description('Run Agent SDK quickstart example')
  .argument('<prompt>', 'Prompt for the agent')
  .option('-t, --tools <tools>', 'Comma-separated list of tools', 'Read,Glob,Bash')
  .action(async (prompt: string, options: { tools: string }) => {
    const allowedTools = options.tools.split(',').map((t) => t.trim());

    console.log(`Running agent with prompt: "${prompt}"`);
    console.log(`Allowed tools: ${allowedTools.join(', ')}\n`);

    for await (const message of query({
      prompt,
      options: {
        allowedTools,
      },
    })) {
      console.log(JSON.stringify(message, null, 2));
    }
  });

/**
 * Run command - executes the three-agent improvement cycle.
 * Initializer -> Coding Agent -> Reviewer
 */
program
  .command('run')
  .description('Run the improvement cycle (Initializer -> Coding -> Reviewer)')
  .option('-n, --max-features <n>', 'Maximum features to complete', '5')
  .option('-c, --category <cat>', 'Filter by category: quality|performance|behavior')
  .option('-l, --log-level <level>', 'Log level: trace|debug|info|warn|error|fatal', 'info')
  .option('--no-color', 'Disable colored output')
  .option('--no-learning', 'Disable human input capture (no SQLite storage)')
  .action(
    async (options: {
      maxFeatures: string;
      category?: string;
      logLevel: string;
      color: boolean;
      learning: boolean;
    }) => {
      const maxFeatures = Number.parseInt(options.maxFeatures, 10);
      const category = options.category as FeatureCategory | undefined;
      const logLevel = options.logLevel as 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

      // Create runtime dependencies via composition root
      // Storage is enabled by default for capturing human inputs
      const deps = createRuntimeDeps({
        projectRoot: process.cwd(),
        logLevel,
        colors: options.color,
        disableStorage: !options.learning,
      });

      const result = await runImprovementCycle(
        {
          projectRoot: deps.projectRoot,
          logger: deps.logger,
          instrumenter: deps.instrumenter,
          humanInputStore: deps.humanInputStore,
        },
        {
          maxFeatures,
          category,
        }
      );

      // Final summary logged by harness
      process.exit(result.featuresCompleted > 0 ? 0 : 1);
    }
  );

program.parse();
