/**
 * Lint stage - runs Biome.js linter with optional autofix.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput, execCommand } from '../utils/exec.js';

/**
 * Extract error locations from Biome output.
 * Biome format: ./path/file.ts:line:col ruleName ━━━━
 */
function extractBiomeErrors(output: string): string[] {
  const lines = output.split('\n');
  const errors: string[] = [];

  for (const line of lines) {
    // Match file:line:col patterns (Biome error locations)
    // Example: ./apps/validation-pipeline/src/pipeline.ts:152:12 lint/style/noNonNullAssertion
    if (line.match(/^\.\/.+:\d+:\d+\s+\S+/)) {
      errors.push(line.trim());
    }
  }

  return errors;
}

export const lintStage: Stage = {
  name: 'lint',
  description: 'Run Biome.js linter',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    // In autofix mode, use `npm run lint` which applies fixes
    // In check mode (CI), use `npm run lint:check` which only checks
    const command = context.autofix ? 'npm run lint' : 'npm run lint:check';

    const result = await execCommand(command, context.projectRoot);
    const durationMs = Date.now() - startTime;

    // Capture output for benchmarking
    const capturedOutput = context.benchmark
      ? { stdout: capOutput(result.stdout), stderr: capOutput(result.stderr) }
      : undefined;

    // Biome exits with 0 on success, non-zero on errors
    if (result.exitCode !== 0) {
      // In autofix mode, the --write flag doesn't show detailed error output
      // Run lint:check to get detailed error locations
      let output = result.stdout + result.stderr;
      if (context.autofix) {
        const checkResult = await execCommand('npm run lint:check', context.projectRoot);
        output = checkResult.stdout + checkResult.stderr;
      }

      const errors = extractBiomeErrors(output);

      return {
        success: false,
        message: 'Lint check failed',
        durationMs,
        errors: errors.length > 0 ? errors : [output.slice(0, 500)],
        output: capturedOutput,
      };
    }

    return {
      success: true,
      message: context.autofix ? 'Lint check passed (fixes applied)' : 'Lint check passed',
      durationMs,
      output: capturedOutput,
    };
  },
};
