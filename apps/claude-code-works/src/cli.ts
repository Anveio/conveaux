#!/usr/bin/env bun
/**
 * claude-code-works CLI
 *
 * A coding agent that follows the instructions framework to execute
 * recursive self-improvement on a target package.
 */

import { Command } from 'commander';
import { runCreate, runDoctor, runImprove, runStatus } from './commands/index';
import { resolveConfig } from './config';
import { logger, output } from './output';

const program = new Command();

program
  .name('claude-code-works')
  .description('A coding agent that follows instructions for recursive self-improvement')
  .version('0.1.0');

// Improve command
program
  .command('improve <package-path>')
  .description('Improve an existing package')
  .option('-i, --iterations <n>', 'Maximum iterations', Number.parseInt)
  .option('-m, --model <model>', 'Claude model to use')
  .option('-b, --benchmark', 'Enable benchmark output')
  .action(
    async (
      packagePath: string,
      options: { iterations?: number; model?: string; benchmark?: boolean }
    ) => {
      const projectRoot = process.cwd();
      const config = resolveConfig(projectRoot, {
        improveIterations: options.iterations,
        model: options.model,
        benchmark: options.benchmark,
      });

      await runImprove(
        packagePath,
        {
          iterations: options.iterations,
          model: options.model,
          benchmark: options.benchmark,
        },
        config
      );
    }
  );

// Create command
program
  .command('create <package-name>')
  .description('Create a new package')
  .option('-t, --type <type>', 'Package type (contract, port, adapter, core, app)', 'core')
  .option('-d, --description <desc>', 'Package description')
  .option('-i, --iterations <n>', 'Maximum iterations', Number.parseInt)
  .option('-m, --model <model>', 'Claude model to use')
  .option('-b, --benchmark', 'Enable benchmark output')
  .action(
    async (
      packageName: string,
      options: {
        type?: string;
        description?: string;
        iterations?: number;
        model?: string;
        benchmark?: boolean;
      }
    ) => {
      const projectRoot = process.cwd();
      const config = resolveConfig(projectRoot, {
        createIterations: options.iterations,
        model: options.model,
        benchmark: options.benchmark,
      });

      await runCreate(
        packageName,
        {
          type: options.type,
          description: options.description,
          iterations: options.iterations,
          model: options.model,
          benchmark: options.benchmark,
        },
        config
      );
    }
  );

// Status command
program
  .command('status')
  .description('Show repository state, lessons, IPs, and verification status')
  .action(async () => {
    await runStatus();
  });

// Doctor command
program
  .command('doctor')
  .description('Validate environment setup')
  .action(async () => {
    await runDoctor();
  });

// Parse arguments
program.parseAsync(process.argv).catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error('CLI command failed', { error: err });
  output.error(`Fatal error: ${err.message}`);
  process.exit(1);
});
