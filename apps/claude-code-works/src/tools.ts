/**
 * Tools that the agent can use to interact with the file system.
 *
 * Each tool has:
 * - A definition (for the Claude API)
 * - An executor (the actual implementation)
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  };
}

export interface Tool {
  definition: ToolDefinition;
  execute: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Read a file from the file system.
 */
export const readFileTool: Tool = {
  definition: {
    name: 'read_file',
    description: 'Read the contents of a file at the given path.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to read (relative to project root)',
        },
      },
      required: ['path'],
    },
  },
  execute: async (input) => {
    const path = input.path as string;
    try {
      const content = await readFile(path, 'utf-8');
      return content;
    } catch (error) {
      const err = error as Error;
      return `Error reading file: ${err.message}`;
    }
  },
};

/**
 * Write content to a file.
 */
export const writeFileTool: Tool = {
  definition: {
    name: 'write_file',
    description: 'Write content to a file. Creates parent directories if needed.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The file path to write (relative to project root)',
        },
        content: {
          type: 'string',
          description: 'The content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  execute: async (input) => {
    const path = input.path as string;
    const content = input.content as string;
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content, 'utf-8');
      return `Successfully wrote ${content.length} bytes to ${path}`;
    } catch (error) {
      const err = error as Error;
      return `Error writing file: ${err.message}`;
    }
  },
};

/**
 * List files in a directory.
 */
export const listFilesTool: Tool = {
  definition: {
    name: 'list_files',
    description: 'List files and directories at the given path.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list (relative to project root)',
        },
      },
      required: ['path'],
    },
  },
  execute: async (input) => {
    const path = input.path as string;
    try {
      const entries = await readdir(path, { withFileTypes: true });
      const lines = entries.map(e => {
        const type = e.isDirectory() ? '[dir]' : '[file]';
        return `${type} ${e.name}`;
      });
      return lines.join('\n') || '(empty directory)';
    } catch (error) {
      const err = error as Error;
      return `Error listing directory: ${err.message}`;
    }
  },
};

/**
 * Run a shell command.
 */
export const runCommandTool: Tool = {
  definition: {
    name: 'run_command',
    description: 'Run a shell command and return the output. Use for git, npm, verification, etc.',
    input_schema: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to run',
        },
        cwd: {
          type: 'string',
          description: 'Working directory (optional, defaults to project root)',
        },
      },
      required: ['command'],
    },
  },
  execute: async (input) => {
    const command = input.command as string;
    const cwd = (input.cwd as string) || process.cwd();

    // Safety check - don't allow dangerous commands
    const dangerous = ['rm -rf /', 'sudo', '> /dev/', 'mkfs'];
    if (dangerous.some(d => command.includes(d))) {
      return 'Error: Command rejected for safety reasons';
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout: 120000, // 2 minute timeout
        maxBuffer: 1024 * 1024, // 1MB buffer
      });

      const output = [stdout, stderr].filter(Boolean).join('\n');
      return output || '(command completed with no output)';
    } catch (error) {
      const err = error as Error & { stdout?: string; stderr?: string };
      const output = [err.stdout, err.stderr, err.message]
        .filter(Boolean)
        .join('\n');
      return `Command failed:\n${output}`;
    }
  },
};

/**
 * Search for text in files using grep.
 */
export const grepTool: Tool = {
  definition: {
    name: 'grep',
    description: 'Search for a pattern in files. Returns matching lines with file paths.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'The regex pattern to search for',
        },
        path: {
          type: 'string',
          description: 'The directory or file to search in',
        },
        include: {
          type: 'string',
          description: 'File pattern to include (e.g., "*.ts")',
        },
      },
      required: ['pattern', 'path'],
    },
  },
  execute: async (input) => {
    const pattern = input.pattern as string;
    const path = input.path as string;
    const include = input.include as string | undefined;

    let command = `grep -rn "${pattern}" "${path}"`;
    if (include) {
      command = `grep -rn --include="${include}" "${pattern}" "${path}"`;
    }

    try {
      const { stdout } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 30000,
        maxBuffer: 1024 * 1024,
      });
      return stdout || '(no matches found)';
    } catch {
      return '(no matches found)';
    }
  },
};

/**
 * All available tools.
 */
export const allTools: Tool[] = [
  readFileTool,
  writeFileTool,
  listFilesTool,
  runCommandTool,
  grepTool,
];

/**
 * Get tool definitions for the Claude API.
 */
export function getToolDefinitions(): ToolDefinition[] {
  return allTools.map(t => t.definition);
}

/**
 * Execute a tool by name.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  const tool = allTools.find(t => t.definition.name === name);
  if (!tool) {
    return `Error: Unknown tool "${name}"`;
  }
  return tool.execute(input);
}
