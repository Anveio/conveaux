/**
 * Benchmark data collector.
 * Gathers benchmark metrics from stage results.
 */

import type { StageName, StageResult } from '../contracts/stage.js';
import type { BenchmarkResults, StageBenchmark } from './contracts.js';
import { estimateOutputTokens } from './token-counter.js';

/**
 * Stage result with name for collection.
 */
export interface NamedStageResult {
  name: StageName;
  result: StageResult;
}

/**
 * Collect benchmark data from stage results.
 *
 * @param stageResults - Array of stage names and their results
 * @returns Aggregated benchmark results
 */
export function collectBenchmarks(stageResults: NamedStageResult[]): BenchmarkResults {
  const stages: StageBenchmark[] = [];
  let totalDurationMs = 0;
  let totalTokens = 0;

  for (const { name, result } of stageResults) {
    // Calculate tokens from output if available
    const stdout = result.output?.stdout ?? '';
    const stderr = result.output?.stderr ?? '';
    const tokens = estimateOutputTokens(stdout, stderr);

    const stageBenchmark: StageBenchmark = {
      stage: name,
      durationMs: result.durationMs,
      tokens,
    };

    stages.push(stageBenchmark);
    totalDurationMs += result.durationMs;
    totalTokens += tokens.inputTokens;
  }

  return {
    stages,
    totalDurationMs,
    totalTokens,
  };
}
