/**
 * Validation pipeline - library exports.
 */

export type {
  PipelineResult,
  Stage,
  StageContext,
  StageExecutionResult,
  StageName,
  StageResult,
} from './contracts/index.js';

export { runPipeline } from './pipeline.js';
export type { PipelineOptions } from './pipeline.js';

export {
  checkStage,
  DEFAULT_STAGE_ORDER,
  docsStage,
  getStage,
  installStage,
  lintStage,
  stageRegistry,
  testStage,
  typecheckStage,
} from './stages/index.js';
