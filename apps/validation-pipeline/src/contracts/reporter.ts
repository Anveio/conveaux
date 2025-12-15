/**
 * Reporter contract - defines the interface for pipeline output reporters.
 *
 * Reporters format and output pipeline progress and results.
 * Multiple implementations exist for different use cases:
 * - interactive: Human-friendly colored output
 * - headless: Machine-parseable output for CI
 * - agent: Minimal output optimized for LLM agents
 */

import type { PipelineResult, StageExecutionResult } from './result.js';
import type { StageName } from './stage.js';

/**
 * Reporter interface for pipeline output.
 *
 * All methods are optional - reporters can choose which events to handle.
 * This allows agent mode to be completely silent during execution.
 */
export interface Reporter {
  /** Report the start of the pipeline. Called once at the beginning. */
  reportPipelineStart?(): void;

  /** Report the start of a stage. Called before each stage runs. */
  reportStageStart(stageName: StageName): void;

  /** Report a stage result. Called after each stage completes. */
  reportStageResult(result: StageExecutionResult): void;

  /** Report the final pipeline result. Called once at the end. */
  reportPipelineResult(result: PipelineResult): void;
}
