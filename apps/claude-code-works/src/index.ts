/**
 * @conveaux/claude-code-works
 *
 * A coding agent that follows the instructions framework
 * for recursive self-improvement of packages.
 */

export { runOuterLoop } from './loop';
export type { LoopConfig, LoopResult } from './loop';

export { loadInstructions, getContextForTask, getPatterns } from './instructions';
export type { Instructions, InstructionFile, InstructionCategory } from './instructions';

export { runAgent } from './agent';
export type { AgentConfig, AgentResult } from './agent';

export { allTools, executeTool, getToolDefinitions } from './tools';
export type { Tool, ToolDefinition } from './tools';

export { output } from './output';

export {
  isRecord,
  isError,
  hasErrorMessage,
  getErrorMessage,
  isString,
  getStringProperty,
  isGrepNoMatchError,
  extractExecErrorOutput,
} from './type-guards';
