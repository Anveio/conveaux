/**
 * Interactive reporter - human-friendly colored output.
 */

import chalk from 'chalk';
import type { PipelineResult, StageExecutionResult, StageName } from '../contracts/index.js';

/**
 * Report the start of a stage.
 */
export function reportStageStart(stageName: StageName): void {
  console.log(chalk.blue(`Running stage: ${stageName}...`));
}

/**
 * Report a stage result.
 */
export function reportStageResult(result: StageExecutionResult): void {
  const duration = `${result.durationMs}ms`;

  if (result.success) {
    console.log(chalk.green(`  ${result.stage}: PASS (${duration})`));
  } else {
    console.log(chalk.red(`  ${result.stage}: FAIL (${duration})`));
    if (result.errors) {
      for (const error of result.errors) {
        console.log(chalk.dim(`    ${error}`));
      }
    }
  }
}

/**
 * Report pipeline result summary.
 */
export function reportPipelineResult(result: PipelineResult): void {
  console.log('');

  if (result.success) {
    console.log(chalk.green.bold('VERIFICATION: PASS'));
    console.log(chalk.dim(`Total time: ${result.totalDurationMs}ms`));
  } else {
    console.log(chalk.red.bold('VERIFICATION: FAIL'));
    console.log(chalk.dim(`Failed at stage: ${result.failedStage}`));
    console.log(chalk.dim(`Total time: ${result.totalDurationMs}ms`));
  }
}
