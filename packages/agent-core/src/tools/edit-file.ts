/**
 * Edit file tool - performs string replacement in a file.
 */

import { readFile, writeFile } from 'node:fs/promises';
import type { Tool, ToolDefinition, ToolExecutor } from '@conveaux/agent-contracts';

export const editFileDefinition: ToolDefinition = {
  name: 'edit_file',
  description:
    'Replace a specific string in a file with a new string. The old_string must exist exactly once in the file.',
  input_schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit',
      },
      old_string: {
        type: 'string',
        description: 'The exact string to find and replace (must be unique in the file)',
      },
      new_string: {
        type: 'string',
        description: 'The string to replace old_string with',
      },
    },
    required: ['path', 'old_string', 'new_string'],
  },
};

interface EditFileInput {
  path: string;
  old_string: string;
  new_string: string;
}

export const editFileExecutor: ToolExecutor = async (input: unknown): Promise<string> => {
  const { path, old_string, new_string } = input as EditFileInput;

  // Read the file
  const content = await readFile(path, 'utf-8');

  // Check how many times old_string appears
  const occurrences = content.split(old_string).length - 1;

  if (occurrences === 0) {
    throw new Error(`String not found in file: "${old_string.slice(0, 50)}..."`);
  }

  if (occurrences > 1) {
    throw new Error(
      `String appears ${occurrences} times in file. It must be unique. Provide more context to make the match unique.`
    );
  }

  // Perform the replacement
  const newContent = content.replace(old_string, new_string);

  // Write the file
  await writeFile(path, newContent, 'utf-8');

  return `Successfully edited ${path}`;
};

export const editFileTool: Tool = {
  definition: editFileDefinition,
  execute: editFileExecutor,
};
