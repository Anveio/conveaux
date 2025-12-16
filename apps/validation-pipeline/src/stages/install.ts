/**
 * Install stage - runs npm install to ensure dependencies are up to date.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput, execCommand } from '../utils/exec.js';

export const installStage: Stage = {
  name: 'install',
  description: 'Install dependencies',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = context.clock.nowMs();

    const command = 'npm install --silent';
    const result = await execCommand(command, context.projectRoot);
    const durationMs = context.clock.nowMs() - startTime;

    // Capture output for benchmarking
    const capturedOutput = context.benchmark
      ? { stdout: capOutput(result.stdout), stderr: capOutput(result.stderr) }
      : undefined;

    if (result.exitCode !== 0) {
      const output = result.stdout || result.stderr;
      return {
        success: false,
        message: 'npm install failed',
        durationMs,
        errors: [output.slice(0, 500)],
        output: capturedOutput,
      };
    }

    return {
      success: true,
      message: 'Dependencies installed',
      durationMs,
      output: capturedOutput,
    };
  },
};
