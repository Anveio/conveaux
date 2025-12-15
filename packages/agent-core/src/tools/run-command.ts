/**
 * Run command tool - executes shell commands.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool, ToolDefinition, ToolExecutor } from '@conveaux/agent-contracts';

const execAsync = promisify(exec);

export const runCommandDefinition: ToolDefinition = {
  name: 'run_command',
  description: 'Execute a shell command and return its output',
  input_schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (optional)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 120000)',
      },
    },
    required: ['command'],
  },
};

interface RunCommandInput {
  command: string;
  cwd?: string;
  timeout?: number;
}

export const runCommandExecutor: ToolExecutor = async (input: unknown): Promise<string> => {
  const { command, cwd, timeout = 120000 } = input as RunCommandInput;

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout,
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    let output = '';
    if (stdout) {
      output += stdout;
    }
    if (stderr) {
      output += stderr ? `\n[stderr]\n${stderr}` : '';
    }

    return output || '(no output)';
  } catch (error) {
    if (error instanceof Error && 'code' in error) {
      const execError = error as Error & { stdout?: string; stderr?: string; code?: number };
      let output = `Command exited with code ${execError.code}\n`;
      if (execError.stdout) output += execError.stdout;
      if (execError.stderr) output += `\n[stderr]\n${execError.stderr}`;
      return output;
    }
    throw error;
  }
};

export const runCommandTool: Tool = {
  definition: runCommandDefinition,
  execute: runCommandExecutor,
};
