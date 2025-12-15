/**
 * Benchmark module - track and report agent performance metrics.
 */

export type { TokenUsage, AgentBenchmark, LoopBenchmark } from './contracts';

import { output } from '../output';
import type { AgentBenchmark, LoopBenchmark } from './contracts';

/**
 * Create an empty agent benchmark.
 */
export function createEmptyBenchmark(model: string): AgentBenchmark {
  return {
    apiCalls: 0,
    inputTokens: 0,
    outputTokens: 0,
    durationMs: 0,
    toolCalls: 0,
    model,
  };
}

/**
 * Aggregate benchmarks from multiple iterations.
 */
export function aggregateBenchmarks(benchmarks: AgentBenchmark[]): AgentBenchmark {
  if (benchmarks.length === 0) {
    return createEmptyBenchmark('unknown');
  }

  return benchmarks.reduce(
    (acc, b) => ({
      apiCalls: acc.apiCalls + b.apiCalls,
      inputTokens: acc.inputTokens + b.inputTokens,
      outputTokens: acc.outputTokens + b.outputTokens,
      durationMs: acc.durationMs + b.durationMs,
      toolCalls: acc.toolCalls + b.toolCalls,
      model: b.model,
    }),
    createEmptyBenchmark(benchmarks[0].model)
  );
}

/**
 * Report benchmark results to the terminal.
 */
export function reportBenchmark(benchmark: LoopBenchmark): void {
  output.header('BENCHMARK RESULTS');

  output.info('Token Usage:');
  output.dim(`  Input tokens:  ${benchmark.totals.inputTokens.toLocaleString()}`);
  output.dim(`  Output tokens: ${benchmark.totals.outputTokens.toLocaleString()}`);
  output.dim(
    `  Total tokens:  ${(benchmark.totals.inputTokens + benchmark.totals.outputTokens).toLocaleString()}`
  );

  output.info('\nPerformance:');
  output.dim(`  API calls:   ${benchmark.totals.apiCalls}`);
  output.dim(`  Tool calls:  ${benchmark.totals.toolCalls}`);
  output.dim(`  Duration:    ${(benchmark.totals.durationMs / 1000).toFixed(2)}s`);
  output.dim(`  Model:       ${benchmark.totals.model}`);

  if (benchmark.iterations.length > 1) {
    output.info('\nPer-Iteration Breakdown:');
    benchmark.iterations.forEach((iter, i) => {
      output.dim(
        `  Iteration ${i + 1}: ${iter.inputTokens + iter.outputTokens} tokens, ${iter.apiCalls} calls, ${(iter.durationMs / 1000).toFixed(2)}s`
      );
    });
  }
}
