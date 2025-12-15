/**
 * Benchmark contracts for tracking agent performance metrics.
 */

/**
 * Token usage from a single API call.
 */
export interface TokenUsage {
  /** Input tokens consumed */
  inputTokens: number;
  /** Output tokens generated */
  outputTokens: number;
}

/**
 * Aggregated benchmark metrics for an agent run.
 */
export interface AgentBenchmark {
  /** Number of API calls made */
  apiCalls: number;
  /** Total input tokens consumed */
  inputTokens: number;
  /** Total output tokens generated */
  outputTokens: number;
  /** Total execution time in milliseconds */
  durationMs: number;
  /** Number of tool calls executed */
  toolCalls: number;
  /** Model used for the run */
  model: string;
}

/**
 * Benchmark result for a complete loop run.
 */
export interface LoopBenchmark {
  /** Per-iteration benchmarks */
  iterations: AgentBenchmark[];
  /** Total metrics across all iterations */
  totals: AgentBenchmark;
  /** Timestamp when the run started */
  startedAt: string;
  /** Timestamp when the run completed */
  completedAt: string;
}
