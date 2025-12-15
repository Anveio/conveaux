/**
 * Build stage - runs the build command via turbo.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput, execCommand } from '../utils/exec.js';

export const buildStage: Stage = {
  name: 'build',
  description: 'Build all packages',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    const command = 'npm run build -- --output-logs=errors-only';
    const result = await execCommand(command, context.projectRoot);
    const durationMs = Date.now() - startTime;

    // Capture output for benchmarking
    const capturedOutput = context.benchmark
      ? { stdout: capOutput(result.stdout), stderr: capOutput(result.stderr) }
      : undefined;

    if (result.exitCode !== 0) {
      const output = result.stdout || result.stderr;
      const errorLines = output
        .split('\n')
        .filter((line) => line.toLowerCase().includes('error'))
        .slice(0, 10);

      return {
        success: false,
        message: 'Build failed',
        durationMs,
        errors: errorLines.length > 0 ? errorLines : [output.slice(0, 500)],
        output: capturedOutput,
      };
    }

    return {
      success: true,
      message: 'Build passed',
      durationMs,
      output: capturedOutput,
    };
  },
};
