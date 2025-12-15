/**
 * Stage contract - defines the interface for validation pipeline stages.
 */

/**
 * Available stage names in the validation pipeline.
 */
export type StageName = 'check' | 'install' | 'lint' | 'typecheck' | 'build' | 'test';

/**
 * Context passed to each stage during execution.
 */
export interface StageContext {
  /** Root directory of the project being validated */
  projectRoot: string;
  /** Whether running in CI environment (affects output mode) */
  ci: boolean;
  /** Whether autofix should be applied (for lint stage) */
  autofix: boolean;
  /** Output mode for stage feedback */
  ui: boolean;
  /** Whether benchmarking is enabled */
  benchmark?: boolean;
}

/**
 * Captured command output for benchmarking.
 */
export interface StageOutput {
  stdout: string;
  stderr: string;
}

/**
 * Result returned by a stage after execution.
 */
export interface StageResult {
  /** Whether the stage passed */
  success: boolean;
  /** Human-readable message describing the result */
  message: string;
  /** Duration of the stage in milliseconds */
  durationMs: number;
  /** Error details if the stage failed */
  errors?: string[];
  /** Raw command output (only when benchmark mode active) */
  output?: StageOutput;
}

/**
 * A validation pipeline stage.
 */
export interface Stage {
  /** Unique name identifying the stage */
  name: StageName;
  /** Human-readable description of what the stage does */
  description: string;
  /** Execute the stage and return the result */
  run(context: StageContext): Promise<StageResult>;
}
