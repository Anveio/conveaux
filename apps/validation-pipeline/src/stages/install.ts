/**
 * Install stage - runs npm install to ensure dependencies are up to date.
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { execCommand } from '../utils/exec.js';

export const installStage: Stage = {
  name: 'install',
  description: 'Install dependencies',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    const command = 'npm install --silent';
    const result = await execCommand(command, context.projectRoot);
    const durationMs = Date.now() - startTime;

    if (result.exitCode !== 0) {
      const output = result.stdout || result.stderr;
      return {
        success: false,
        message: 'npm install failed',
        durationMs,
        errors: [output.slice(0, 500)],
      };
    }

    return {
      success: true,
      message: 'Dependencies installed',
      durationMs,
    };
  },
};
