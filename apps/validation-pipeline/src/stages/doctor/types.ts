/**
 * Type definitions for the doctor stage.
 *
 * Doctor steps detect and optionally fix code health issues.
 */

import type { StageContext } from '../../contracts/index.js';

/**
 * Extended context for doctor steps.
 */
export interface DoctorContext extends StageContext {
  /** Whether fixes should actually be applied (derived from autofix flag) */
  shouldFix: boolean;
}

/**
 * A single issue detected or fixed by a doctor step.
 */
export interface DoctorIssue {
  /** Relative file path (optional - some issues are project-wide) */
  file?: string;
  /** Human-readable description of the issue */
  description: string;
  /** Whether this issue was fixed */
  fixed: boolean;
}

/**
 * Result from running a doctor step.
 */
export interface DoctorStepResult {
  /** Whether the step completed successfully */
  success: boolean;
  /** Human-readable summary */
  message: string;
  /** List of issues found/fixed */
  issues: DoctorIssue[];
  /** Duration in milliseconds */
  durationMs: number;
}

/**
 * A doctor step that can detect and optionally fix issues.
 */
export interface DoctorStep {
  /** Unique identifier */
  name: string;
  /** Human-readable description */
  description: string;
  /**
   * Run the doctor step.
   * In check mode (shouldFix=false): reports issues without fixing
   * In fix mode (shouldFix=true): attempts to fix issues
   */
  run(context: DoctorContext): Promise<DoctorStepResult>;
}
