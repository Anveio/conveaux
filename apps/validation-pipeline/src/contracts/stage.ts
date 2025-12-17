/**
 * Stage contract - defines the interface for validation pipeline stages.
 */

import type { WallClock } from '@conveaux/contract-wall-clock';

/**
 * Available stage names in the validation pipeline.
 * Note: 'build' was removed - we use source-first development with tsx.
 */
export type StageName =
  | 'agents'
  | 'check'
  | 'devcontainer'
  | 'docs'
  | 'install'
  | 'doctor'
  | 'lint'
  | 'typecheck'
  | 'hermetic'
  | 'test';

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
  /** Clock for timing measurements */
  clock: WallClock;
}

/**
 * Captured command output for benchmarking.
 */
interface StageOutput {
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
