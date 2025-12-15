/**
 * Typecheck stage - runs TypeScript compiler for type checking.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { execCommand } from '../utils/exec.js';

export const typecheckStage: Stage = {
  name: 'typecheck',
  description: 'Run TypeScript type checking',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    // Use npm run typecheck which delegates to turbo
    const command = 'npm run typecheck -- --output-logs=errors-only';
    const result = await execCommand(command, context.projectRoot);
    const durationMs = Date.now() - startTime;

    if (result.exitCode !== 0) {
      // Extract TypeScript errors from output
      const output = result.stdout || result.stderr;
      const errorLines = output
        .split('\n')
        .filter((line) => line.includes('error TS') || line.includes(': error'))
        .slice(0, 10);

      return {
        success: false,
        message: 'Type checking failed',
        durationMs,
        errors: errorLines.length > 0 ? errorLines : [output.slice(0, 500)],
      };
    }

    return {
      success: true,
      message: 'Type checking passed',
      durationMs,
    };
  },
};
