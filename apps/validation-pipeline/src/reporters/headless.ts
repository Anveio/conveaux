/**
 * Headless reporter - machine-parseable output for CI.
 */

import type {
  PipelineResult,
  Reporter,
  StageExecutionResult,
  StageName,
} from '../contracts/index.js';

/**
 * Report the start of the pipeline.
 */
function reportPipelineStart(): void {
  console.log('VERIFICATION:START');
}

/**
 * Report the start of a stage.
 */
function reportStageStart(stageName: StageName): void {
  console.log(`STAGE:${stageName}:START`);
}

/**
 * Report a stage result.
 */
function reportStageResult(result: StageExecutionResult): void {
  if (result.success) {
    console.log(`STAGE:${result.stage}:PASS`);
  } else {
    console.log(`STAGE:${result.stage}:FAIL`);
    // Output errors for failed stages
    if (result.errors && result.errors.length > 0) {
      for (const error of result.errors) {
        console.log(`  ${error}`);
      }
    }
  }
}

/**
 * Report pipeline result summary.
 */
function reportPipelineResult(result: PipelineResult): void {
  if (result.success) {
    console.log('VERIFICATION:PASS');
  } else {
    console.log('VERIFICATION:FAIL');
  }
}

/**
 * Headless reporter - machine-parseable output for CI.
 * Implements the Reporter interface with structured text output.
 */
export const headlessReporter: Reporter = {
  reportPipelineStart,
  reportStageStart,
  reportStageResult,
  reportPipelineResult,
};
