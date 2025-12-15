/**
 * Pipeline orchestrator - coordinates stage execution using DAG.
 *
 * Stages run in parallel when their dependencies are satisfied.
 * The dependency graph is:
 *
 *           [check]
 *          ↙     ↘
 *     [docs]    [install]
 *                ↙   ↘
 *           [lint]  [typecheck]
 *                        ↓
 *                   [hermetic]
 *                        ↓
 *                     [test]
 */

import {
  type Dag,
  type DagNode,
  type ExecuteDagDeps,
  executeDag,
  validateDag,
} from '@conveaux/port-dag';

import type {
  PipelineResult,
  Stage,
  StageContext,
  StageExecutionResult,
  StageName,
  StageResult,
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
  /** Force sequential execution (disable parallel) */
  sequential?: boolean;
  /** Optional callback when stage starts */
  onStageStart?: (stageName: StageName) => void;
  /** Optional callback when stage completes */
  onStageComplete?: (result: StageExecutionResult) => void;
}

/**
 * Stage dependency graph.
 *
 * Defines which stages can run in parallel based on dependencies.
 */
const STAGE_DEPENDENCIES: Record<StageName, StageName[]> = {
  check: [],
  docs: ['check'],
  install: ['check'],
  lint: ['install'],
  typecheck: ['install'],
  hermetic: ['typecheck'],
  test: ['hermetic'],
};

/**
 * Build a DAG from the stage registry.
 */
function buildStageDag(stagesToRun: StageName[]): Dag<Stage> {
  const stageSet = new Set(stagesToRun);

  return stagesToRun.map((stageName) => {
    const stage = getStage(stageName);
    // Filter dependencies to only include stages we're running
    const dependencies = STAGE_DEPENDENCIES[stageName].filter((dep) => stageSet.has(dep));

    return {
      id: stageName,
      data: stage,
      dependencies,
    };
  });
}

/**
 * Run the validation pipeline using DAG-based parallel execution.
 *
 * Stages run in parallel when their dependencies are satisfied.
 * Falls back to sequential execution if --sequential is specified.
 */
export async function runPipeline(options: PipelineOptions): Promise<PipelineResult> {
  const startTime = Date.now();
  const stagesToRun = options.stages ?? DEFAULT_STAGE_ORDER;

  // Use sequential mode if explicitly requested
  if (options.sequential) {
    return runPipelineSequential(options, stagesToRun, startTime);
  }

  const context: StageContext = {
    projectRoot: options.projectRoot,
    ci: options.ci,
    autofix: options.autofix,
    ui: options.ui,
  };

  // Build and validate the DAG
  const dag = buildStageDag(stagesToRun);
  const validation = validateDag(dag);
  if (!validation.valid) {
    throw new Error(`Invalid stage DAG: ${validation.errors[0]?.details ?? 'unknown error'}`);
  }

  // Execute stages using DAG
  const results: StageExecutionResult[] = [];
  const deps: ExecuteDagDeps = { clock: { nowMs: Date.now } };

  const dagResult = await executeDag<Stage, StageResult>(
    deps,
    dag,
    async (node: DagNode<Stage>) => {
      options.onStageStart?.(node.id as StageName);

      const stageResult = await node.data.run(context);

      const executionResult: StageExecutionResult = {
        ...stageResult,
        stage: node.id as StageName,
      };
      results.push(executionResult);
      options.onStageComplete?.(executionResult);

      // Throw to trigger fail-fast
      if (!stageResult.success) {
        throw new Error(`Stage ${node.id} failed`);
      }

      return stageResult;
    },
    { failFast: true }
  );

  // Sort results by execution order for consistent output
  const orderedResults = dagResult.executionOrder.map((nodeId) => {
    return results.find((r) => r.stage === nodeId)!;
  });

  return {
    success: dagResult.success,
    stages: orderedResults,
    totalDurationMs: Date.now() - startTime,
    failedStage: dagResult.failedNode as StageName | undefined,
  };
}

/**
 * Run the validation pipeline sequentially (legacy mode).
 *
 * Executes stages in order, stopping on first failure.
 */
async function runPipelineSequential(
  options: PipelineOptions,
  stagesToRun: StageName[],
  startTime: number
): Promise<PipelineResult> {
  const results: StageExecutionResult[] = [];

  const context: StageContext = {
    projectRoot: options.projectRoot,
    ci: options.ci,
    autofix: options.autofix,
    ui: options.ui,
  };

  for (const stageName of stagesToRun) {
    options.onStageStart?.(stageName);

    const stage = getStage(stageName);
    const stageResult = await stage.run(context);

    const executionResult: StageExecutionResult = {
      ...stageResult,
      stage: stageName,
    };
    results.push(executionResult);
    options.onStageComplete?.(executionResult);

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
