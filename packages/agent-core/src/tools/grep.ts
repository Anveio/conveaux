/**
 * Grep tool - searches for patterns in files.
 */

import { readFile } from 'node:fs/promises';
import { glob as globAsync } from 'node:fs/promises';
import { join } from 'node:path';
import type { Tool, ToolDefinition, ToolExecutor } from '@conveaux/agent-contracts';

export const grepDefinition: ToolDefinition = {
  name: 'grep',
  description: 'Search for a regex pattern in files. Returns matching lines with file:line format.',
  input_schema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Regular expression pattern to search for',
      },
      filePattern: {
        type: 'string',
        description: 'Glob pattern for files to search (default: "**/*")',
      },
      cwd: {
        type: 'string',
        description: 'Directory to search in (default: current directory)',
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 100)',
      },
    },
    required: ['pattern'],
  },
};

interface GrepInput {
  pattern: string;
  filePattern?: string;
  cwd?: string;
  maxResults?: number;
}

export const grepExecutor: ToolExecutor = async (input: unknown): Promise<string> => {
  const { pattern, filePattern = '**/*', cwd = '.', maxResults = 100 } = input as GrepInput;

  const regex = new RegExp(pattern, 'g');
  const results: string[] = [];

  // Find all files matching the file pattern
  const files: string[] = [];
  for await (const file of globAsync(filePattern, { cwd })) {
    files.push(file);
  }

  // Search each file
  for (const file of files) {
    if (results.length >= maxResults) break;

    try {
      const filePath = join(cwd, file);
      const content = await readFile(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (results.length >= maxResults) break;

        const line = lines[i];
        if (line !== undefined && regex.test(line)) {
          results.push(`${file}:${i + 1}:${line}`);
        }
        // Reset regex lastIndex for global regex
        regex.lastIndex = 0;
      }
    } catch {
      // Skip files that can't be read (binary, permissions, etc.)
    }
  }

  if (results.length === 0) {
    return `No matches found for pattern: ${pattern}`;
  }

  let output = results.join('\n');
  if (results.length >= maxResults) {
    output += `\n\n(truncated at ${maxResults} results)`;
  }

  return output;
};

export const grepTool: Tool = {
  definition: grepDefinition,
  execute: grepExecutor,
};
