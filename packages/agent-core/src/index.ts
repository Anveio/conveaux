/**
 * @conveaux/agent-core
 *
 * Core agent abstraction with agentic loop and tool implementations.
 */

// Agent class and factory
export { Agent, createAgent } from './agent.js';

// Tool exports
export {
  // Individual tools
  readFileTool,
  editFileTool,
  writeFileTool,
  runCommandTool,
  globTool,
  grepTool,
  // Definitions (for custom tool composition)
  readFileDefinition,
  editFileDefinition,
  writeFileDefinition,
  runCommandDefinition,
  globDefinition,
  grepDefinition,
  // Executors (for custom tool composition)
  readFileExecutor,
  editFileExecutor,
  writeFileExecutor,
  runCommandExecutor,
  globExecutor,
  grepExecutor,
  // Convenience export
  allTools,
} from './tools/index.js';

// Re-export contracts for convenience
export type {
  Tool,
  ToolDefinition,
  ToolExecutor,
  AgentConfig,
  AgentResult,
  ToolCall,
  ModelId,
} from '@conveaux/agent-contracts';
