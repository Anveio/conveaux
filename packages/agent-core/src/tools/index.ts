/**
 * Tool exports for the agent-core package.
 */

export { readFileTool, readFileDefinition, readFileExecutor } from './read-file.js';
export { editFileTool, editFileDefinition, editFileExecutor } from './edit-file.js';
export { writeFileTool, writeFileDefinition, writeFileExecutor } from './write-file.js';
export { runCommandTool, runCommandDefinition, runCommandExecutor } from './run-command.js';
export { globTool, globDefinition, globExecutor } from './glob.js';
export { grepTool, grepDefinition, grepExecutor } from './grep.js';

// Re-export all tools as a convenient array
import { readFileTool } from './read-file.js';
import { editFileTool } from './edit-file.js';
import { writeFileTool } from './write-file.js';
import { runCommandTool } from './run-command.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';

/**
 * All available tools for easy access.
 */
export const allTools = {
  readFile: readFileTool,
  editFile: editFileTool,
  writeFile: writeFileTool,
  runCommand: runCommandTool,
  glob: globTool,
  grep: grepTool,
};
