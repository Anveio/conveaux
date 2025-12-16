/**
 * @conveaux/claude-code-works
 *
 * A coding agent that follows the instructions framework
 * for recursive self-improvement of packages.
 */

// Loop orchestration
export { runOuterLoop } from './loop';
export type { LoopConfig, LoopResult } from './loop';

// Instructions framework
export { loadInstructions, getContextForTask, getPatterns } from './instructions';
export type { Instructions, InstructionFile, InstructionCategory } from './instructions';

// Agent
export { runAgent } from './agent';
export type { AgentConfig, AgentResult, AgentUsage } from './agent';

// Tools
export { allTools, executeTool, getToolDefinitions } from './tools';
export type { Tool, ToolDefinition } from './tools';

// Output
export { output, logger } from './output';

// Config
export { loadConfig, resolveConfig, DEFAULT_CONFIG, CONFIG_FILE_NAME } from './config';
export type { Config } from './config';

// Benchmark
export {
  createEmptyBenchmark,
  aggregateBenchmarks,
  reportBenchmark,
} from './benchmark/index';
export type { TokenUsage, AgentBenchmark, LoopBenchmark } from './benchmark/contracts';

// Commands
export { runImprove, runCreate, runStatus, runDoctor } from './commands/index';
export type { ImproveOptions, CreateOptions } from './commands/index';

// Type guards
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
