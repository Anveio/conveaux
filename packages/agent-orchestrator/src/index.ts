/**
 * @conveaux/agent-orchestrator
 *
 * Agent orchestrator that coordinates coding agents for package improvement.
 */

// Main entry point
export { runImprovementLoop } from './improvement-loop.js';

// Agent creators (for custom orchestration)
export {
  createAnalyzer,
  createImplementer,
  createReviewer,
} from './agents/index.js';

// Lesson recording
export { recordLesson } from './lesson-recorder.js';

// Re-export types
export type {
  OrchestratorConfig,
  OrchestratorResult,
  LessonLearned,
} from '@conveaux/agent-contracts';
