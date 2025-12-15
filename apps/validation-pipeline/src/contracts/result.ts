/**
 * Result contract - defines types for pipeline execution results.
 */

import type { StageName, StageResult } from './stage.js';

/**
 * Result of a single stage execution with stage name.
 */
export interface StageExecutionResult extends StageResult {
  /** Name of the stage that was executed */
  stage: StageName;
}

/**
 * Result of the entire pipeline execution.
 */
export interface PipelineResult {
  /** Whether all stages passed */
  success: boolean;
  /** Results for each stage that was executed */
  stages: StageExecutionResult[];
  /** Total duration of the pipeline in milliseconds */
  totalDurationMs: number;
  /** Name of the first failed stage, if any */
  failedStage?: StageName;
}
