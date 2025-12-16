/**
 * Task Router - Classifies features into agent types.
 *
 * Pure functions for routing tasks to specialized agents based on
 * feature characteristics.
 *
 * TODO: If classification rules grow complex, consider extracting
 * to contract-task-classification + port-task-classification
 */

import type {
  AgentType,
  ClassificationRule,
  ClassifiedTask,
  Impact,
} from '@conveaux/contract-coordinator';

// =============================================================================
// Feature Input Type
// =============================================================================

/**
 * Minimal feature shape needed for classification.
 * This allows the router to work with any feature-like object.
 */
export interface FeatureForClassification {
  readonly id: string;
  readonly category: 'quality' | 'performance' | 'behavior';
  readonly title: string;
  readonly description: string;
  readonly impact: Impact;
  readonly files: readonly string[];
}

// =============================================================================
// Classification Rules
// =============================================================================

/**
 * Matcher function for classification rules.
 */
export type FeatureMatcher = (feature: FeatureForClassification) => boolean;

/**
 * Full classification rule with matcher.
 */
export interface ClassificationRuleWithMatcher extends ClassificationRule {
  readonly match: FeatureMatcher;
}

/**
 * Check if any file has a test suffix.
 */
function hasTestSuffix(files: readonly string[]): boolean {
  return files.some((f) => f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__'));
}

/**
 * Check if description contains lint-related keywords.
 */
function hasLintKeywords(description: string): boolean {
  return /lint|biome|eslint|format|style/i.test(description);
}

/**
 * Check if description contains docs-related keywords.
 */
function hasDocsKeywords(description: string): boolean {
  return /doc|readme|jsdoc|comment|api\s*doc/i.test(description);
}

/**
 * Default classification rules.
 * Order matters - first match wins.
 */
export const DEFAULT_CLASSIFICATION_RULES: readonly ClassificationRuleWithMatcher[] = [
  {
    match: (f) => f.category === 'quality' && hasTestSuffix(f.files),
    agentType: 'test',
    priority: 1,
  },
  {
    match: (f) => f.category === 'quality' && hasLintKeywords(f.description),
    agentType: 'lint',
    priority: 2,
  },
  {
    match: (f) => hasDocsKeywords(f.description),
    agentType: 'docs',
    priority: 3,
  },
  {
    match: (f) => f.category === 'performance',
    agentType: 'refactor',
    priority: 2,
  },
  // Catch-all: use general coding agent
  {
    match: () => true,
    agentType: 'coding',
    priority: 2,
  },
];

// =============================================================================
// Router Functions
// =============================================================================

/**
 * Convert impact level to numeric priority (lower = higher priority).
 */
export function impactToPriority(impact: Impact): number {
  switch (impact) {
    case 'high':
      return 1;
    case 'medium':
      return 2;
    case 'low':
      return 3;
  }
}

/**
 * Build a prompt for the given agent type and feature.
 */
export function buildPromptForAgent(
  agentType: AgentType,
  feature: FeatureForClassification
): string {
  const basePrompt = `Work on feature: ${feature.id}
Title: ${feature.title}
Description: ${feature.description}
Files: ${feature.files.join(', ')}`;

  switch (agentType) {
    case 'lint':
      return `Fix lint/formatting issues.\n\n${basePrompt}`;
    case 'test':
      return `Write or improve tests for coverage.\n\n${basePrompt}`;
    case 'docs':
      return `Improve documentation (JSDoc, README, comments).\n\n${basePrompt}`;
    case 'refactor':
      return `Refactor for performance/structure without changing behavior.\n\n${basePrompt}`;
    default:
      return `Implement the feature.\n\n${basePrompt}`;
  }
}

/**
 * Classify a single feature into a task with agent type assignment.
 */
export function classifyFeature(
  feature: FeatureForClassification,
  rules: readonly ClassificationRuleWithMatcher[] = DEFAULT_CLASSIFICATION_RULES
): ClassifiedTask {
  for (const rule of rules) {
    if (rule.match(feature)) {
      return {
        featureId: feature.id,
        agentType: rule.agentType,
        files: feature.files,
        priority: impactToPriority(feature.impact),
        prompt: buildPromptForAgent(rule.agentType, feature),
      };
    }
  }

  // Fallback (should never reach due to catch-all rule)
  return {
    featureId: feature.id,
    agentType: 'coding',
    files: feature.files,
    priority: impactToPriority(feature.impact),
    prompt: buildPromptForAgent('coding', feature),
  };
}

/**
 * Classify multiple features into tasks.
 */
export function classifyFeatures(
  features: readonly FeatureForClassification[],
  rules: readonly ClassificationRuleWithMatcher[] = DEFAULT_CLASSIFICATION_RULES
): readonly ClassifiedTask[] {
  return features.map((f) => classifyFeature(f, rules));
}
