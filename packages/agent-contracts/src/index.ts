/**
 * @conveaux/agent-contracts
 *
 * TypeScript interfaces for the agent orchestrator system.
 * These contracts define the shape of tools, agents, and orchestration.
 */

// =============================================================================
// Tool Contracts
// =============================================================================

/**
 * Tool definition that matches the Anthropic SDK format.
 * Used to describe what tools an agent has access to.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required?: string[];
  };
}

/**
 * JSON Schema property for tool input definitions.
 */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
}

/**
 * Function type for executing a tool.
 * Takes unknown input (will be validated by caller) and returns string result.
 */
export type ToolExecutor = (input: unknown) => Promise<string>;

/**
 * A complete tool with definition and executor.
 */
export interface Tool {
  definition: ToolDefinition;
  execute: ToolExecutor;
}

// =============================================================================
// Agent Contracts
// =============================================================================

/**
 * Supported Claude model identifiers.
 */
export type ModelId =
  | 'claude-opus-4-5-20251101'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-haiku-4-5-20251001';

/**
 * Configuration for creating an agent.
 */
export interface AgentConfig {
  /** Unique name for this agent */
  name: string;

  /** Which Claude model to use */
  model: ModelId;

  /** System prompt that defines the agent's role and behavior */
  systemPrompt: string;

  /** Tools available to this agent */
  tools: Tool[];

  /** Maximum tokens for each response (default: 4096) */
  maxTokens?: number;

  /** Maximum tool-use iterations to prevent infinite loops (default: 20) */
  maxIterations?: number;
}

/**
 * Record of a single tool call made by an agent.
 */
export interface ToolCall {
  tool: string;
  input: unknown;
  result: string;
}

/**
 * Result of running an agent.
 */
export interface AgentResult {
  /** Whether the agent completed successfully */
  success: boolean;

  /** Final text output from the agent */
  output: string;

  /** All tool calls made during execution */
  toolCalls: ToolCall[];

  /** Token usage for billing/monitoring */
  tokenUsage: {
    input: number;
    output: number;
  };
}

// =============================================================================
// Orchestrator Contracts
// =============================================================================

/**
 * Configuration for the orchestrator.
 */
export interface OrchestratorConfig {
  /** Path to the package to improve */
  targetPackage: string;

  /** Maximum improvement iterations */
  maxIterations: number;

  /** Anthropic API key (falls back to ANTHROPIC_API_KEY env) */
  anthropicApiKey?: string;
}

/**
 * Result of running the improvement loop.
 */
export interface OrchestratorResult {
  /** Whether the orchestrator completed successfully */
  success: boolean;

  /** Number of iterations completed */
  iterations: number;

  /** Lessons learned during improvement */
  lessons: LessonLearned[];
}

/**
 * A lesson learned during an improvement iteration.
 */
export interface LessonLearned {
  /** Unique identifier */
  id: string;

  /** When the lesson was learned */
  date: string;

  /** Package or context where the lesson was learned */
  context: string;

  /** The lesson itself */
  lesson: string;

  /** Evidence supporting the lesson */
  evidence: string;
}

/**
 * Quality metrics for a package.
 */
export interface QualityMetrics {
  /** Whether ./verify.sh passed */
  verifyPassed: boolean;

  /** Number of tests */
  testCount: number;

  /** Number of errors/warnings */
  errorCount: number;
}

// =============================================================================
// Port Interfaces (L-003 Compliance)
// =============================================================================

/**
 * Logger port - replaces direct console.* usage.
 * Enables testable logging and platform-agnostic output.
 *
 * @deprecated Use `Logger` from `@conveaux/contract-logger` instead.
 * This interface will be removed in a future major version.
 *
 * Migration guide:
 * ```typescript
 * // Before
 * import { Logger } from '@conveaux/agent-contracts';
 * const logger: Logger = createConsoleLogger();
 *
 * // After
 * import { createLogger, Logger } from '@conveaux/port-logger';
 * import { createStderrChannel } from '@conveaux/port-outchannel';
 * import { createWallClock } from '@conveaux/port-wall-clock';
 *
 * const logger: Logger = createLogger({
 *   channel: createStderrChannel(),
 *   clock: createWallClock(),
 * });
 * ```
 *
 * The new Logger interface provides:
 * - 6 log levels (trace, debug, info, warn, error, fatal)
 * - Structured JSON output
 * - Child logger support with context binding
 * - Error serialization with cause chains
 * - Trace context for distributed tracing
 * - flush() for async completion
 */
export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

import type { NanosecondTimestamp } from '@conveaux/contract-nanosecond-timestamp';
// Wall clock and nanosecond timestamp interfaces
import type { WallClock } from '@conveaux/contract-wall-clock';
export type { WallClock };
export type { NanosecondTimestamp };

/**
 * Random port - replaces direct Math.random() and crypto usage.
 * Enables deterministic randomness in tests.
 */
export interface Random {
  /** Random number between 0 and 1 */
  number(): number;
  /** Generate UUID v4 */
  uuid(): string;
  /** Random choice from array */
  choice<T>(items: T[]): T;
}

/**
 * Environment port - replaces direct process.env and process.cwd() usage.
 * Enables injectable configuration in tests.
 */
export interface Environment {
  /** Get environment variable (returns undefined if not set) */
  get(key: string): string | undefined;
  /** Get environment variable (throws if not set) */
  require(key: string): string;
  /** Get current working directory */
  cwd(): string;
}

/**
 * Bundle of all ports for dependency injection.
 */
export interface Ports {
  logger: Logger;
  clock: WallClock;
  random: Random;
  env: Environment;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error class for agent errors.
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

/**
 * Error when a tool execution fails.
 */
export class ToolExecutionError extends AgentError {
  constructor(toolName: string, message: string) {
    super(`Tool '${toolName}' failed: ${message}`, 'TOOL_EXECUTION_ERROR');
    this.name = 'ToolExecutionError';
  }
}

/**
 * Error when max iterations is reached.
 */
export class MaxIterationsError extends AgentError {
  constructor(iterations: number) {
    super(`Max iterations (${iterations}) reached`, 'MAX_ITERATIONS_ERROR');
    this.name = 'MaxIterationsError';
  }
}
