/**
 * Utility for executing shell commands.
 */

import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(execCallback);

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Execute a shell command and return the result.
 *
 * @param command - The command to execute
 * @param cwd - Working directory for the command
 * @returns The command result with stdout, stderr, and exit code
 */
export async function execCommand(command: string, cwd: string): Promise<ExecResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    if (isExecError(error)) {
      return {
        stdout: error.stdout ?? '',
        stderr: error.stderr ?? '',
        exitCode: error.code ?? 1,
      };
    }
    throw error;
  }
}

interface ExecError {
  stdout?: string;
  stderr?: string;
  code?: number;
}

function isExecError(error: unknown): error is ExecError {
  return (
    typeof error === 'object' &&
    error !== null &&
    ('stdout' in error || 'stderr' in error || 'code' in error)
  );
}
