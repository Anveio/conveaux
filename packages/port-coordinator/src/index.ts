/**
 * @conveaux/port-coordinator
 *
 * Pure functions for multi-agent coordination.
 *
 * This port provides:
 * - Task classification (feature → agent type)
 * - Execution planning (tasks → parallel waves)
 *
 * FUTURE ADDITIONS (see TODO in contract-coordinator):
 * - Worktree management (create/cleanup git worktrees)
 * - Process spawning (spawn `claude -p` CLI processes)
 * - Result parsing (parse JSON output from CLI)
 */

// Task Router
export {
  classifyFeature,
  classifyFeatures,
  impactToPriority,
  buildPromptForAgent,
  DEFAULT_CLASSIFICATION_RULES,
  type FeatureForClassification,
  type FeatureMatcher,
  type ClassificationRuleWithMatcher,
} from './task-router.js';

// Execution Planner
export {
  planExecutionWaves,
  tasksOverlap,
  conflictsWithWave,
  countTotalTasks,
  getAllFiles,
  type ExecutionPlannerOptions,
} from './execution-planner.js';

// Re-export contract types for convenience
export type {
  AgentType,
  AgentStatus,
  AgentState,
  ClassifiedTask,
  ClassificationRule,
  ExecutionWave,
  WaveStatus,
  WaveState,
  ProcessConfig,
  ProcessResult,
  WorktreeConfig,
  WorktreeResult,
  TaskResult,
  CoordinatorResult,
  CoordinatorOptions,
  Impact,
} from '@conveaux/contract-coordinator';
