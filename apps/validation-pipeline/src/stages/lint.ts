/**
 * Lint stage - runs Biome.js linter with optional autofix.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput, execCommand } from '../utils/exec.js';

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
      // Extract error summary from output
      const output = result.stdout || result.stderr;
      const errorLines = output
        .split('\n')
        .filter((line) => line.includes('error') || line.includes('Error'))
        .slice(0, 5);

      return {
        success: false,
        message: 'Lint check failed',
        durationMs,
        errors: errorLines.length > 0 ? errorLines : [output.slice(0, 500)],
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
