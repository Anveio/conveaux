/**
 * Pipeline orchestrator - coordinates stage execution.
 */

import type {
  PipelineResult,
  StageContext,
  StageExecutionResult,
  StageName,
} from './contracts/index.js';
import { DEFAULT_STAGE_ORDER, getStage } from './stages/index.js';

export interface PipelineOptions {
  /** Project root directory */
  projectRoot: string;
  /** Whether running in CI mode */
  ci: boolean;
  /** Whether to apply autofix for lint */
  autofix: boolean;
  /** Whether to show interactive UI */
  ui: boolean;
  /** Specific stages to run (defaults to all) */
  stages?: StageName[];
}

/**
 * Run the validation pipeline.
 *
 * Executes stages sequentially in order, stopping on first failure.
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const stagesToRun = options.stages ?? DEFAULT_STAGE_ORDER;
  const results: StageExecutionResult[] = [];

  const context: StageContext = {
    projectRoot: options.projectRoot,
    ci: options.ci,
    autofix: options.autofix,
    ui: options.ui,
  };

  for (const stageName of stagesToRun) {
    const stage = getStage(stageName);
    const stageResult = await stage.run(context);

    const executionResult: StageExecutionResult = {
      ...stageResult,
      stage: stageName,
    };
    results.push(executionResult);

    // Fail fast on first error
    if (!stageResult.success) {
      return {
        success: false,
        stages: results,
        totalDurationMs: Date.now() - startTime,
        failedStage: stageName,
      };
    }
  }

  return {
    success: true,
    stages: results,
    totalDurationMs: Date.now() - startTime,
  };
}
