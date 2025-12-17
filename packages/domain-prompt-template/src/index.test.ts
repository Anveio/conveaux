import { describe, expect, it } from 'vitest';
import {
  type DataStructureConfig,
  type ParallelAgentConfig,
  renderDataStructurePrompt,
  renderParallelAgentPrompt,
} from './index.js';

describe('renderParallelAgentPrompt', () => {
  const baseConfig: ParallelAgentConfig = {
    taskTitle: 'Test Task',
    contextBlock: 'Test context with details',
    agentId: 1,
    totalAgents: 3,
    agentAssignment: 'Do the test work',
    doList: ['First thing', 'Second thing'],
    doNotList: ['Bad thing', 'Another bad thing'],
    referenceFiles: ['path/to/file.ts', 'another/file.md'],
    successCriteria: 'All tests pass',
    outputFormat: 'Report results',
  };

  it('renders task title correctly', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('# Test Task');
  });

  it('renders context block', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('## Context');
    expect(result.prompt).toContain('Test context with details');
  });

  it('renders agent scope with correct numbers', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('Agent #1 of 3');
    expect(result.prompt).toContain('Do the test work');
  });

  it('renders do list items', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('### DO');
    expect(result.prompt).toContain('- First thing');
    expect(result.prompt).toContain('- Second thing');
  });

  it('renders do not list items', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('### DO NOT');
    expect(result.prompt).toContain('- Bad thing');
    expect(result.prompt).toContain('- Another bad thing');
  });

  it('renders reference files with backticks', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('## Reference Files');
    expect(result.prompt).toContain('- `path/to/file.ts`');
    expect(result.prompt).toContain('- `another/file.md`');
  });

  it('renders success criteria', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('## Success Criteria');
    expect(result.prompt).toContain('All tests pass');
  });

  it('renders output format', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.prompt).toContain('## Output Format');
    expect(result.prompt).toContain('Report results');
  });

  it('returns correct metadata', () => {
    const result = renderParallelAgentPrompt(baseConfig);
    expect(result.metadata).toEqual({
      templateType: 'parallel-agent',
      agentId: 1,
      totalAgents: 3,
      taskName: 'Test Task',
    });
  });

  it('handles empty do list', () => {
    const config = { ...baseConfig, doList: [] as readonly string[] };
    const result = renderParallelAgentPrompt(config);
    expect(result.prompt).toContain('### DO\n');
  });

  it('handles empty do not list', () => {
    const config = { ...baseConfig, doNotList: [] as readonly string[] };
    const result = renderParallelAgentPrompt(config);
    expect(result.prompt).toContain('### DO NOT\n');
  });

  it('handles empty reference files', () => {
    const config = { ...baseConfig, referenceFiles: [] as readonly string[] };
    const result = renderParallelAgentPrompt(config);
    expect(result.prompt).toContain('## Reference Files\n');
  });
});

describe('renderDataStructurePrompt', () => {
  const baseConfig: DataStructureConfig = {
    name: 'lru-cache',
    displayName: 'LRU Cache',
    contractMethods: [
      'get(key: K): V | undefined',
      'set(key: K, value: V): void',
      'has(key: K): boolean',
    ],
    referencePackage: 'ring-buffer',
  };

  it('renders display name in title', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('# Implement LRU Cache');
  });

  it('renders context about contract-port architecture', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('contract-port architecture');
    expect(result.prompt).toContain('packages/contract-*/');
    expect(result.prompt).toContain('packages/port-*/');
  });

  it('renders agent scope correctly', () => {
    const result = renderDataStructurePrompt(baseConfig, 2, 4);
    expect(result.prompt).toContain('Agent #2 of 4');
  });

  it('renders package names from config name', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('packages/contract-lru-cache/');
    expect(result.prompt).toContain('packages/port-lru-cache/');
  });

  it('renders contract methods', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('## Contract Interface');
    expect(result.prompt).toContain('- get(key: K): V | undefined');
    expect(result.prompt).toContain('- set(key: K, value: V): void');
    expect(result.prompt).toContain('- has(key: K): boolean');
  });

  it('renders reference files using reference package', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('`packages/contract-ring-buffer/src/index.ts`');
    expect(result.prompt).toContain('`packages/port-ring-buffer/src/index.ts`');
    expect(result.prompt).toContain('`packages/port-ring-buffer/src/index.test.ts`');
  });

  it('renders success criteria', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('Both packages created');
    expect(result.prompt).toContain('All tests pass');
    expect(result.prompt).toContain('100% code coverage');
  });

  it('returns correct metadata', () => {
    const result = renderDataStructurePrompt(baseConfig, 3, 5);
    expect(result.metadata).toEqual({
      templateType: 'data-structure',
      agentId: 3,
      totalAgents: 5,
      taskName: 'LRU Cache',
    });
  });

  describe('optional sections', () => {
    it('renders dependencies section when provided', () => {
      const config = { ...baseConfig, dependencies: 'StorageFactory<K, V>' };
      const result = renderDataStructurePrompt(config, 1, 2);
      expect(result.prompt).toContain('## Injectable Dependencies');
      expect(result.prompt).toContain('StorageFactory<K, V>');
    });

    it('omits dependencies section when not provided', () => {
      const result = renderDataStructurePrompt(baseConfig, 1, 2);
      expect(result.prompt).not.toContain('## Injectable Dependencies');
    });

    it('renders options section when provided', () => {
      const config = { ...baseConfig, options: 'capacity: number' };
      const result = renderDataStructurePrompt(config, 1, 2);
      expect(result.prompt).toContain('## Options');
      expect(result.prompt).toContain('capacity: number');
    });

    it('omits options section when not provided', () => {
      const result = renderDataStructurePrompt(baseConfig, 1, 2);
      expect(result.prompt).not.toContain('## Options');
    });

    it('renders implementation notes when provided', () => {
      const config = { ...baseConfig, implementationNotes: 'Use Map + doubly-linked list' };
      const result = renderDataStructurePrompt(config, 1, 2);
      expect(result.prompt).toContain('## Implementation Notes');
      expect(result.prompt).toContain('Use Map + doubly-linked list');
    });

    it('omits implementation notes when not provided', () => {
      const result = renderDataStructurePrompt(baseConfig, 1, 2);
      expect(result.prompt).not.toContain('## Implementation Notes');
    });

    it('renders all optional sections together', () => {
      const config: DataStructureConfig = {
        ...baseConfig,
        dependencies: 'StorageFactory<K, V>',
        options: 'capacity: number',
        implementationNotes: 'Use Map + doubly-linked list for O(1)',
      };
      const result = renderDataStructurePrompt(config, 1, 2);
      expect(result.prompt).toContain('## Injectable Dependencies');
      expect(result.prompt).toContain('## Options');
      expect(result.prompt).toContain('## Implementation Notes');
    });
  });

  it('renders DO constraints', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('### DO');
    expect(result.prompt).toContain('Follow the ring-buffer pattern exactly');
    expect(result.prompt).toContain('factory functions with dependency injection');
    expect(result.prompt).toContain('100% coverage');
  });

  it('renders DO NOT constraints', () => {
    const result = renderDataStructurePrompt(baseConfig, 1, 2);
    expect(result.prompt).toContain('### DO NOT');
    expect(result.prompt).toContain('Push to main branch');
    expect(result.prompt).toContain('Modify existing packages');
  });
});
