#!/usr/bin/env node

/**
 * CLI entry point for validation-pipeline.
 */

import { cwd } from 'node:process';
import { Command } from 'commander';
import type { StageName } from './contracts/index.js';
import { headless, interactive } from './reporters/index.js';
import { DEFAULT_STAGE_ORDER, getStage } from './stages/index.js';

const program = new Command();

program
  .name('validation-pipeline')
  .description('Run the validation pipeline (check, lint, typecheck, build, test)')
  .version('0.1.0')
  .option('--ui <boolean>', 'Enable interactive UI (default: true)', 'true')
  .option('--stage <name>', 'Run only a specific stage')
  .option('--no-autofix', 'Disable autofix for lint stage')
  .option('--ci', 'Run in CI mode (disables autofix, uses headless output)')
  .action(async (options: { ui: string; stage?: string; autofix: boolean; ci?: boolean }) => {
    const ui = options.ci ? false : options.ui !== 'false';
    const autofix = options.ci ? false : options.autofix;
    const projectRoot = cwd();

    // Determine which stages to run
    let stages: StageName[] | undefined;
    if (options.stage) {
      const stageName = options.stage as StageName;
      if (!DEFAULT_STAGE_ORDER.includes(stageName)) {
        console.error(`Unknown stage: ${options.stage}`);
        console.error(`Available stages: ${DEFAULT_STAGE_ORDER.join(', ')}`);
        process.exit(2);
      }
      stages = [stageName];
    }

    // Select reporter based on UI mode
    const reporter = ui ? interactive : headless;

    // Report pipeline start (headless only)
    if (!ui) {
      headless.reportPipelineStart();
    }

    // Run each stage
    const stagesToRun = stages ?? DEFAULT_STAGE_ORDER;
    const results: Array<{
      stage: StageName;
      success: boolean;
      message: string;
      durationMs: number;
      errors?: string[];
    }> = [];

    const startTime = Date.now();
    let failed = false;
    let failedStage: StageName | undefined;

    for (const stageName of stagesToRun) {
      reporter.reportStageStart(stageName);

      const stage = getStage(stageName);
      const result = await stage.run({
        projectRoot,
        ci: Boolean(options.ci),
        autofix,
        ui,
      });

      const executionResult = {
        ...result,
        stage: stageName,
      };
      results.push(executionResult);
      reporter.reportStageResult(executionResult);

      if (!result.success) {
        failed = true;
        failedStage = stageName;
        break;
      }
    }

    const totalDurationMs = Date.now() - startTime;

    // Report final result
    reporter.reportPipelineResult({
      success: !failed,
      stages: results,
      totalDurationMs,
      failedStage,
    });

    process.exit(failed ? 1 : 0);
  });

program.parse();
