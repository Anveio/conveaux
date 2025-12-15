/**
 * Headless reporter - machine-parseable output for CI.
 */

import type { PipelineResult, StageExecutionResult, StageName } from '../contracts/index.js';

/**
 * Report the start of the pipeline.
 */
export function reportPipelineStart(): void {
  console.log('VERIFICATION:START');
}

/**
 * Report the start of a stage.
 */
export function reportStageStart(stageName: StageName): void {
  console.log(`STAGE:${stageName}:START`);
}

/**
 * Report a stage result.
 */
export function reportStageResult(result: StageExecutionResult): void {
  if (result.success) {
    console.log(`STAGE:${result.stage}:PASS`);
  } else {
    console.log(`STAGE:${result.stage}:FAIL`);
  }
}

/**
 * Report pipeline result summary.
 */
export function reportPipelineResult(result: PipelineResult): void {
  if (result.success) {
    console.log('VERIFICATION:PASS');
  } else {
    console.log('VERIFICATION:FAIL');
  }
}
