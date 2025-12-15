/**
 * Benchmark module contracts.
 */

import type { StageName } from '../contracts/stage.js';

/**
 * Token count estimate for LLM context.
 */
export interface TokenEstimate {
  /** Estimated token count (chars/4 approximation) */
  inputTokens: number;
  /** Raw character count */
  characterCount: number;
}

/**
 * Benchmark data for a single stage.
 */
export interface StageBenchmark {
  /** Stage name */
  stage: StageName;
  /** Execution time in milliseconds */
  durationMs: number;
  /** Token estimate of stage output */
  tokens: TokenEstimate;
}

/**
 * Complete benchmark results for a pipeline run.
 */
export interface BenchmarkResults {
  /** Per-stage benchmark data */
  stages: StageBenchmark[];
  /** Total pipeline execution time in milliseconds */
  totalDurationMs: number;
  /** Total tokens across all stages */
  totalTokens: number;
}
