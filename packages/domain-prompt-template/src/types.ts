/**
 * @conveaux/domain-prompt-template
 *
 * Type definitions for parallel agent prompt templates.
 */

// =============================================================================
// Generic Parallel Agent Types
// =============================================================================

/**
 * Configuration for a generic parallel agent prompt.
 *
 * This template can be customized for any parallel task by
 * providing the appropriate context and constraints.
 */
export interface ParallelAgentConfig {
  /** Short descriptive title for the task */
  readonly taskTitle: string;

  /** Background info, architecture patterns, conventions */
  readonly contextBlock: string;

  /** This agent's index (1-N) */
  readonly agentId: number;

  /** Total number of agents working in parallel */
  readonly totalAgents: number;

  /** Specific work this agent should do */
  readonly agentAssignment: string;

  /** Positive constraints/requirements */
  readonly doList: readonly string[];

  /** Negative constraints/prohibitions */
  readonly doNotList: readonly string[];

  /** File paths the agent should read for patterns */
  readonly referenceFiles: readonly string[];

  /** How to know the task is complete */
  readonly successCriteria: string;

  /** What the agent should produce/return */
  readonly outputFormat: string;
}

// =============================================================================
// Data Structure Implementation Types
// =============================================================================

/**
 * Configuration for implementing a data structure following
 * the contract-port architecture pattern.
 */
export interface DataStructureConfig {
  /** Package name suffix, e.g., "lru-cache" -> contract-lru-cache, port-lru-cache */
  readonly name: string;

  /** Human-readable name, e.g., "LRU Cache" */
  readonly displayName: string;

  /** Contract interface methods with full TypeScript signatures */
  readonly contractMethods: readonly string[];

  /** Injectable dependencies description, e.g., "StorageFactory<K, V>" */
  readonly dependencies?: string;

  /** Options interface description, e.g., "capacity: number" */
  readonly options?: string;

  /** Implementation hints or algorithm notes */
  readonly implementationNotes?: string;

  /** Reference package to use as template, e.g., "ring-buffer" */
  readonly referencePackage: string;
}

// =============================================================================
// Template Rendering Result Types
// =============================================================================

/**
 * Result of rendering a prompt template.
 * Contains the rendered prompt and metadata for tracking.
 */
export interface RenderedPrompt {
  /** The fully rendered prompt string */
  readonly prompt: string;

  /** Metadata for tracking/debugging */
  readonly metadata: PromptMetadata;
}

/**
 * Metadata about a rendered prompt.
 */
export interface PromptMetadata {
  /** Template type used */
  readonly templateType: 'parallel-agent' | 'data-structure';

  /** Agent ID if applicable */
  readonly agentId?: number;

  /** Total agents if applicable */
  readonly totalAgents?: number;

  /** Task title or name */
  readonly taskName: string;
}
