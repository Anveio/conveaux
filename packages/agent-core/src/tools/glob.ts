/**
 * Glob tool - finds files matching a pattern.
 */

import { glob as globAsync } from 'node:fs/promises';
import type { Tool, ToolDefinition, ToolExecutor } from '@conveaux/agent-contracts';

export const globDefinition: ToolDefinition = {
  name: 'glob',
  description: 'Find files matching a glob pattern (e.g., "**/*.ts", "src/**/*.test.ts")',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files against',
      },
      cwd: {
        type: 'string',
        description: 'Directory to search in (default: current directory)',
      },
    },
    required: ['pattern'],
  },
};

interface GlobInput {
  pattern: string;
  cwd?: string;
}

export const globExecutor: ToolExecutor = async (input: unknown): Promise<string> => {
  const { pattern, cwd = '.' } = input as GlobInput;

  const files: string[] = [];
  for await (const file of globAsync(pattern, { cwd })) {
    files.push(file);
  }

  if (files.length === 0) {
    return `No files found matching pattern: ${pattern}`;
  }

  return files.join('\n');
};

export const globTool: Tool = {
  definition: globDefinition,
  execute: globExecutor,
};
