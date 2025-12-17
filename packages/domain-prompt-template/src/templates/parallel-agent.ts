/**
 * Generic parallel agent prompt template.
 *
 * Use this template for any task that can be parallelized across
 * multiple agents with independent work units.
 */

import type { ParallelAgentConfig, RenderedPrompt } from '../types.js';

/**
 * Renders a generic parallel agent prompt from configuration.
 *
 * @param config - The parallel agent configuration
 * @returns A RenderedPrompt with the prompt string and metadata
 *
 * @example
 * ```typescript
 * const result = renderParallelAgentPrompt({
 *   taskTitle: 'Migrate API endpoints',
 *   contextBlock: 'We are migrating from Express to Fastify...',
 *   agentId: 1,
 *   totalAgents: 3,
 *   agentAssignment: 'Migrate routes in src/api/users/',
 *   doList: ['Update imports', 'Convert middleware'],
 *   doNotList: ['Change business logic', 'Modify tests'],
 *   referenceFiles: ['docs/migration-guide.md'],
 *   successCriteria: 'All routes compile and pass tests',
 *   outputFormat: 'Report modified files and any issues'
 * });
 * ```
 */
export function renderParallelAgentPrompt(config: ParallelAgentConfig): RenderedPrompt {
  const doListItems = config.doList.map((item) => `- ${item}`).join('\n');
  const doNotListItems = config.doNotList.map((item) => `- ${item}`).join('\n');
  const refFiles = config.referenceFiles.map((f) => `- \`${f}\``).join('\n');

  const prompt = `# ${config.taskTitle}

## Context
${config.contextBlock}

## Your Scope
You are Agent #${config.agentId} of ${config.totalAgents} working in parallel.

Your specific assignment:
${config.agentAssignment}

## Constraints

### DO
${doListItems}

### DO NOT
${doNotListItems}

## Reference Files
${refFiles}

## Success Criteria
${config.successCriteria}

## Output Format
${config.outputFormat}`;

  return {
    prompt,
    metadata: {
      templateType: 'parallel-agent',
      agentId: config.agentId,
      totalAgents: config.totalAgents,
      taskName: config.taskTitle,
    },
  };
}
