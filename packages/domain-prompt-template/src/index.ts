/**
 * @conveaux/domain-prompt-template
 *
 * Typed prompt templates for spawning parallel Claude agents.
 *
 * This package provides reusable, type-safe prompt templates that can be
 * programmatically customized for various parallel agent tasks.
 *
 * @example
 * ```typescript
 * import {
 *   renderParallelAgentPrompt,
 *   renderDataStructurePrompt,
 *   type DataStructureConfig
 * } from '@conveaux/domain-prompt-template';
 *
 * // Generic parallel task
 * const migrationPrompt = renderParallelAgentPrompt({
 *   taskTitle: 'Migrate API endpoints',
 *   contextBlock: 'Converting from Express to Fastify...',
 *   agentId: 1,
 *   totalAgents: 3,
 *   agentAssignment: 'Migrate routes in src/api/users/',
 *   doList: ['Update imports', 'Convert middleware'],
 *   doNotList: ['Change business logic'],
 *   referenceFiles: ['docs/migration-guide.md'],
 *   successCriteria: 'All routes compile and tests pass',
 *   outputFormat: 'Report modified files'
 * });
 *
 * // Data structure implementation
 * const lruConfig: DataStructureConfig = {
 *   name: 'lru-cache',
 *   displayName: 'LRU Cache',
 *   contractMethods: ['get(key)', 'set(key, value)', 'has(key)'],
 *   referencePackage: 'ring-buffer'
 * };
 * const lruPrompt = renderDataStructurePrompt(lruConfig, 1, 2);
 * ```
 */

// Re-export types
export type {
  ParallelAgentConfig,
  DataStructureConfig,
  RenderedPrompt,
  PromptMetadata,
} from './types.js';

// Re-export template functions
export { renderParallelAgentPrompt } from './templates/parallel-agent.js';
export { renderDataStructurePrompt } from './templates/data-structure.js';
