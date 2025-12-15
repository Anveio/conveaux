/**
 * Test stage - runs all tests via turbo.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput, execCommand } from '../utils/exec.js';

export const testStage: Stage = {
  name: 'test',
  description: 'Run all tests',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    const command = 'npm run test -- --output-logs=errors-only';
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
        .filter((line) => line.includes('FAIL') || line.includes('Error') || line.includes('error'))
        .slice(0, 10);

      return {
        success: false,
        message: 'Tests failed',
        durationMs,
        errors: errorLines.length > 0 ? errorLines : [output.slice(0, 500)],
        output: capturedOutput,
      };
    }

    return {
      success: true,
      message: 'All tests passed',
      durationMs,
      output: capturedOutput,
    };
  },
};
