/**
 * Read file tool - reads contents of a file.
 */

import { readFile } from 'node:fs/promises';
import type { Tool, ToolDefinition, ToolExecutor } from '@conveaux/agent-contracts';

export const readFileDefinition: ToolDefinition = {
  name: 'read_file',
  description: 'Read the contents of a file at the specified path',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file to read',
      },
    },
    required: ['path'],
  },
};

interface ReadFileInput {
  path: string;
}

export const readFileExecutor: ToolExecutor = async (input: unknown): Promise<string> => {
  const { path } = input as ReadFileInput;

  try {
    const content = await readFile(path, 'utf-8');
    return content;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`File not found: ${path}`);
    }
    throw error;
  }
};

export const readFileTool: Tool = {
  definition: readFileDefinition,
  execute: readFileExecutor,
};
