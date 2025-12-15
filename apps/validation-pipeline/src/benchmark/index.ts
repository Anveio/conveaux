/**
 * Benchmark module - measures pipeline performance for recursive self-improvement.
 *
 * Tracks:
 * - Speed: Execution time per stage
 * - Token count: LLM token estimate of output (chars/4 approximation)
 */

export type { BenchmarkResults, StageBenchmark, TokenEstimate } from './contracts.js';
export { collectBenchmarks, type NamedStageResult } from './collector.js';
export { reportBenchmarks } from './reporter.js';
export { estimateOutputTokens, estimateTokens } from './token-counter.js';
