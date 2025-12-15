/**
 * Write file tool - creates or overwrites a file.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Tool, ToolDefinition, ToolExecutor } from '@conveaux/agent-contracts';

export const writeFileDefinition: ToolDefinition = {
  name: 'write_file',
  description: 'Write content to a file, creating it if it does not exist or overwriting if it does',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
};

interface WriteFileInput {
  path: string;
  content: string;
}

export const writeFileExecutor: ToolExecutor = async (input: unknown): Promise<string> => {
  const { path, content } = input as WriteFileInput;

  // Ensure parent directory exists
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });

  // Write the file
  await writeFile(path, content, 'utf-8');

  return `Successfully wrote ${content.length} characters to ${path}`;
};

export const writeFileTool: Tool = {
  definition: writeFileDefinition,
  execute: writeFileExecutor,
};
