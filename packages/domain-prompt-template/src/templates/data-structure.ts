/**
 * Data structure implementation prompt template.
 *
 * Specialized template for implementing data structures following
 * the contract-port architecture pattern used in this monorepo.
 */

import type { DataStructureConfig, RenderedPrompt } from '../types.js';

/**
 * Renders a data structure implementation prompt.
 *
 * @param config - The data structure configuration
 * @param agentId - This agent's index (1-N)
 * @param totalAgents - Total number of agents working in parallel
 * @returns A RenderedPrompt with the prompt string and metadata
 *
 * @example
 * ```typescript
 * const result = renderDataStructurePrompt(
 *   {
 *     name: 'lru-cache',
 *     displayName: 'LRU Cache',
 *     contractMethods: [
 *       'get(key: K): V | undefined',
 *       'set(key: K, value: V): void',
 *       'has(key: K): boolean'
 *     ],
 *     dependencies: 'StorageFactory<K, V>',
 *     options: 'capacity: number',
 *     implementationNotes: 'Use Map + doubly-linked list for O(1)',
 *     referencePackage: 'ring-buffer'
 *   },
 *   1,
 *   2
 * );
 * ```
 */
export function renderDataStructurePrompt(
  config: DataStructureConfig,
  agentId: number,
  totalAgents: number
): RenderedPrompt {
  const methodList = config.contractMethods.map((m) => `- ${m}`).join('\n');

  // Build optional sections
  const dependenciesSection = config.dependencies
    ? `\n## Injectable Dependencies\n${config.dependencies}\n`
    : '';

  const optionsSection = config.options ? `\n## Options\n${config.options}\n` : '';

  const notesSection = config.implementationNotes
    ? `\n## Implementation Notes\n${config.implementationNotes}\n`
    : '';

  const prompt = `# Implement ${config.displayName}

## Context
This monorepo uses contract-port architecture:
- Contracts define interfaces in packages/contract-*/
- Ports implement them in packages/port-*/
- 100% test coverage required
- Factory functions, not classes
- Pure functional style preferred (immutable data, pure functions)

## Your Scope
You are Agent #${agentId} of ${totalAgents} working in parallel.

Create two packages:
1. packages/contract-${config.name}/ - Interface definitions
2. packages/port-${config.name}/ - Implementation + tests

## Contract Interface
${methodList}
${dependenciesSection}${optionsSection}${notesSection}
## Constraints

### DO
- Follow the ${config.referencePackage} pattern exactly
- Use factory functions with dependency injection
- Write comprehensive tests with 100% coverage
- Include JSDoc comments on all public interfaces
- Run tests before reporting completion
- Prefer pure functional style (immutable data structures)

### DO NOT
- Push to main branch
- Modify existing packages
- Create cross-dependencies with other new packages being created
- Use classes instead of factory functions

## Reference Files
- \`packages/contract-${config.referencePackage}/src/index.ts\`
- \`packages/port-${config.referencePackage}/src/index.ts\`
- \`packages/port-${config.referencePackage}/src/index.test.ts\`
- \`packages/port-${config.referencePackage}/vitest.config.ts\`
- \`packages/port-${config.referencePackage}/package.json\`

## Success Criteria
- Both packages created with correct structure
- All tests pass
- 100% code coverage
- TypeScript compiles without errors

## Output Format
Commit your changes. Report: files created, test results, any issues encountered.`;

  return {
    prompt,
    metadata: {
      templateType: 'data-structure',
      agentId,
      totalAgents,
      taskName: config.displayName,
    },
  };
}
