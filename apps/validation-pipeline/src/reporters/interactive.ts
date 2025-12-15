/**
 * Interactive reporter - human-friendly colored output.
 */

import chalk from 'chalk';
import type {
  PipelineResult,
  Reporter,
  StageExecutionResult,
  StageName,
} from '../contracts/index.js';

/**
 * Report the start of a stage.
 */
function reportStageStart(stageName: StageName): void {
  console.log(chalk.blue(`Running stage: ${stageName}...`));
}

/**
 * Report a stage result.
 */
function reportStageResult(result: StageExecutionResult): void {
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
function reportPipelineResult(result: PipelineResult): void {
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

/**
 * Interactive reporter - human-friendly colored output.
 * Implements the Reporter interface with colored terminal output.
 */
export const interactiveReporter: Reporter = {
  reportStageStart,
  reportStageResult,
  reportPipelineResult,
};
