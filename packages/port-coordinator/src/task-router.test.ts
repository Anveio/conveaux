import { describe, expect, it } from 'vitest';
import {
  type ClassificationRuleWithMatcher,
  DEFAULT_CLASSIFICATION_RULES,
  type FeatureForClassification,
  buildPromptForAgent,
  classifyFeature,
  classifyFeatures,
  impactToPriority,
} from './task-router.js';

describe('impactToPriority', () => {
  it('returns 1 for high impact', () => {
    expect(impactToPriority('high')).toBe(1);
  });

  it('returns 2 for medium impact', () => {
    expect(impactToPriority('medium')).toBe(2);
  });

  it('returns 3 for low impact', () => {
    expect(impactToPriority('low')).toBe(3);
  });
});

describe('buildPromptForAgent', () => {
  const feature: FeatureForClassification = {
    id: 'feat-1',
    category: 'quality',
    title: 'Fix something',
    description: 'Description here',
    impact: 'medium',
    files: ['src/foo.ts', 'src/bar.ts'],
  };

  it('builds prompt for lint agent', () => {
    const prompt = buildPromptForAgent('lint', feature);
    expect(prompt).toContain('Fix lint/formatting issues');
    expect(prompt).toContain('feat-1');
    expect(prompt).toContain('src/foo.ts');
  });

  it('builds prompt for test agent', () => {
    const prompt = buildPromptForAgent('test', feature);
    expect(prompt).toContain('Write or improve tests');
    expect(prompt).toContain('feat-1');
  });

  it('builds prompt for docs agent', () => {
    const prompt = buildPromptForAgent('docs', feature);
    expect(prompt).toContain('Improve documentation');
    expect(prompt).toContain('feat-1');
  });

  it('builds prompt for refactor agent', () => {
    const prompt = buildPromptForAgent('refactor', feature);
    expect(prompt).toContain('Refactor for performance');
    expect(prompt).toContain('feat-1');
  });

  it('builds prompt for coding agent', () => {
    const prompt = buildPromptForAgent('coding', feature);
    expect(prompt).toContain('Implement the feature');
    expect(prompt).toContain('feat-1');
  });

  it('builds prompt for initializer (defaults to coding)', () => {
    const prompt = buildPromptForAgent('initializer', feature);
    expect(prompt).toContain('Implement the feature');
  });

  it('builds prompt for reviewer (defaults to coding)', () => {
    const prompt = buildPromptForAgent('reviewer', feature);
    expect(prompt).toContain('Implement the feature');
  });
});

describe('classifyFeature', () => {
  it('classifies test files to test agent', () => {
    const feature: FeatureForClassification = {
      id: 'test-feat',
      category: 'quality',
      title: 'Add tests',
      description: 'Add unit tests',
      impact: 'medium',
      files: ['src/foo.test.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('test');
    expect(task.featureId).toBe('test-feat');
    expect(task.priority).toBe(2);
  });

  it('classifies spec files to test agent', () => {
    const feature: FeatureForClassification = {
      id: 'spec-feat',
      category: 'quality',
      title: 'Add tests',
      description: 'Add unit tests',
      impact: 'high',
      files: ['src/foo.spec.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('test');
    expect(task.priority).toBe(1);
  });

  it('classifies __tests__ files to test agent', () => {
    const feature: FeatureForClassification = {
      id: 'tests-dir',
      category: 'quality',
      title: 'Add tests',
      description: 'Add unit tests',
      impact: 'low',
      files: ['src/__tests__/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('test');
    expect(task.priority).toBe(3);
  });

  it('classifies lint keywords to lint agent', () => {
    const feature: FeatureForClassification = {
      id: 'lint-feat',
      category: 'quality',
      title: 'Fix lint',
      description: 'Fix biome lint errors',
      impact: 'low',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('lint');
  });

  it('classifies eslint keywords to lint agent', () => {
    const feature: FeatureForClassification = {
      id: 'eslint-feat',
      category: 'quality',
      title: 'Fix eslint',
      description: 'Fix ESLint errors',
      impact: 'low',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('lint');
  });

  it('classifies format keywords to lint agent', () => {
    const feature: FeatureForClassification = {
      id: 'format-feat',
      category: 'quality',
      title: 'Format code',
      description: 'Apply code formatting',
      impact: 'low',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('lint');
  });

  it('classifies style keywords to lint agent', () => {
    const feature: FeatureForClassification = {
      id: 'style-feat',
      category: 'quality',
      title: 'Fix style',
      description: 'Fix code style issues',
      impact: 'low',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('lint');
  });

  it('classifies docs keywords to docs agent', () => {
    const feature: FeatureForClassification = {
      id: 'docs-feat',
      category: 'behavior',
      title: 'Add docs',
      description: 'Add JSDoc comments',
      impact: 'low',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('docs');
  });

  it('classifies readme keywords to docs agent', () => {
    const feature: FeatureForClassification = {
      id: 'readme-feat',
      category: 'behavior',
      title: 'Update README',
      description: 'Update the README file',
      impact: 'low',
      files: ['README.md'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('docs');
  });

  it('classifies api doc keywords to docs agent', () => {
    const feature: FeatureForClassification = {
      id: 'api-doc-feat',
      category: 'behavior',
      title: 'API docs',
      description: 'Generate API documentation',
      impact: 'low',
      files: ['docs/api.md'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('docs');
  });

  it('classifies comment keywords to docs agent', () => {
    const feature: FeatureForClassification = {
      id: 'comment-feat',
      category: 'behavior',
      title: 'Add comments',
      description: 'Add inline code comments',
      impact: 'low',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('docs');
  });

  it('classifies performance category to refactor agent', () => {
    const feature: FeatureForClassification = {
      id: 'perf-feat',
      category: 'performance',
      title: 'Optimize loop',
      description: 'Optimize the main loop',
      impact: 'high',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('refactor');
  });

  it('falls back to coding agent for unmatched features', () => {
    const feature: FeatureForClassification = {
      id: 'generic-feat',
      category: 'behavior',
      title: 'Add feature',
      description: 'Add a new feature',
      impact: 'medium',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.agentType).toBe('coding');
  });

  it('uses custom rules when provided', () => {
    const customRules: ClassificationRuleWithMatcher[] = [
      { match: () => true, agentType: 'reviewer', priority: 1 },
    ];

    const feature: FeatureForClassification = {
      id: 'custom-feat',
      category: 'behavior',
      title: 'Custom',
      description: 'Custom feature',
      impact: 'medium',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature, customRules);
    expect(task.agentType).toBe('reviewer');
  });

  it('falls back to coding agent when no rules match', () => {
    // Empty rules array - no rules can match
    const noMatchRules: ClassificationRuleWithMatcher[] = [
      { match: () => false, agentType: 'test', priority: 1 },
    ];

    const feature: FeatureForClassification = {
      id: 'no-match',
      category: 'behavior',
      title: 'No match',
      description: 'No rules match this',
      impact: 'high',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature, noMatchRules);
    expect(task.agentType).toBe('coding');
    expect(task.priority).toBe(1);
    expect(task.prompt).toContain('Implement the feature');
  });

  it('includes files in classified task', () => {
    const feature: FeatureForClassification = {
      id: 'files-feat',
      category: 'behavior',
      title: 'Multi-file',
      description: 'Multi-file change',
      impact: 'medium',
      files: ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.files).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
  });

  it('includes prompt in classified task', () => {
    const feature: FeatureForClassification = {
      id: 'prompt-feat',
      category: 'behavior',
      title: 'Test prompt',
      description: 'Test prompt generation',
      impact: 'medium',
      files: ['src/foo.ts'],
    };

    const task = classifyFeature(feature);
    expect(task.prompt).toContain('prompt-feat');
    expect(task.prompt).toContain('Test prompt');
  });
});

describe('classifyFeatures', () => {
  it('classifies multiple features', () => {
    const features: FeatureForClassification[] = [
      {
        id: 'feat-1',
        category: 'quality',
        title: 'Add tests',
        description: 'Add tests',
        impact: 'high',
        files: ['src/foo.test.ts'],
      },
      {
        id: 'feat-2',
        category: 'performance',
        title: 'Optimize',
        description: 'Optimize code',
        impact: 'medium',
        files: ['src/bar.ts'],
      },
    ];

    const tasks = classifyFeatures(features);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]!.agentType).toBe('test');
    expect(tasks[1]!.agentType).toBe('refactor');
  });

  it('returns empty array for empty input', () => {
    const tasks = classifyFeatures([]);
    expect(tasks).toEqual([]);
  });

  it('uses custom rules when provided', () => {
    const customRules: ClassificationRuleWithMatcher[] = [
      { match: () => true, agentType: 'docs', priority: 1 },
    ];

    const features: FeatureForClassification[] = [
      {
        id: 'feat-1',
        category: 'behavior',
        title: 'Feature 1',
        description: 'Description',
        impact: 'medium',
        files: ['src/foo.ts'],
      },
    ];

    const tasks = classifyFeatures(features, customRules);
    expect(tasks[0]!.agentType).toBe('docs');
  });
});

describe('DEFAULT_CLASSIFICATION_RULES', () => {
  it('has expected number of rules', () => {
    expect(DEFAULT_CLASSIFICATION_RULES.length).toBe(5);
  });

  it('has a catch-all rule last', () => {
    const lastRule = DEFAULT_CLASSIFICATION_RULES.at(-1)!;
    expect(lastRule.agentType).toBe('coding');
    // The catch-all should match anything
    const anyFeature: FeatureForClassification = {
      id: 'any',
      category: 'behavior',
      title: 'Any',
      description: 'Any',
      impact: 'low',
      files: [],
    };
    expect(lastRule.match(anyFeature)).toBe(true);
  });
});
