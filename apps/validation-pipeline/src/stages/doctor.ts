/**
 * Doctor stage - automated code health fixes.
 *
 * Runs a series of doctor steps that detect and optionally fix
 * common code quality issues like unused imports, dead code, etc.
 *
 * Behavior:
 * - When autofix=true: applies fixes and reports what was changed
 * - When autofix=false: only reports issues without modifying files
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput } from '../utils/exec.js';
import { doctorSteps } from './doctor/registry.js';
import type { DoctorContext, DoctorIssue, DoctorStepResult } from './doctor/types.js';

export const doctorStage: Stage = {
  name: 'doctor',
  description: 'Automated code health fixes (unused imports, etc.)',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    // Build doctor context - fixes only apply if autofix is enabled
    const doctorContext: DoctorContext = {
      ...context,
      shouldFix: context.autofix,
    };

    const allIssues: DoctorIssue[] = [];
    const stepResults: DoctorStepResult[] = [];
    const outputs: string[] = [];

    // Run each doctor step sequentially
    for (const step of doctorSteps) {
      const result = await step.run(doctorContext);
      stepResults.push(result);
      allIssues.push(...result.issues);

      if (result.issues.length > 0) {
        outputs.push(`[${step.name}] ${result.message}`);
        for (const issue of result.issues.slice(0, 10)) {
          const prefix = issue.fixed ? '[FIXED]' : '[ISSUE]';
          const location = issue.file ? `${issue.file}: ` : '';
          outputs.push(`  ${prefix} ${location}${issue.description}`);
        }
        if (result.issues.length > 10) {
          outputs.push(`  ... and ${result.issues.length - 10} more`);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    // Determine overall success
    // In fix mode: success if all steps succeeded
    // In check mode: success only if no issues found
    const allStepsSucceeded = stepResults.every((r) => r.success);
    const success = context.autofix ? allStepsSucceeded : allIssues.length === 0;

    // Build result message
    let message: string;
    if (allIssues.length === 0) {
      message = 'Code health check passed';
    } else if (context.autofix) {
      const fixedCount = allIssues.filter((i) => i.fixed).length;
      const unfixedCount = allIssues.length - fixedCount;
      message =
        unfixedCount > 0
          ? `Fixed ${fixedCount} issue(s), ${unfixedCount} could not be auto-fixed`
          : `Fixed ${fixedCount} issue(s)`;
    } else {
      message = `Found ${allIssues.length} issue(s) (run with autofix to repair)`;
    }

    // Capture output for benchmarking
    const capturedOutput = context.benchmark
      ? { stdout: capOutput(outputs.join('\n')), stderr: '' }
      : undefined;

    if (!success) {
      return {
        success: false,
        message,
        durationMs,
        errors: outputs.slice(0, 20),
        output: capturedOutput,
      };
    }

    return {
      success: true,
      message,
      durationMs,
      output: capturedOutput,
    };
  },
};
