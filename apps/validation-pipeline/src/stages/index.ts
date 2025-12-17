/**
 * Stage registry - exports all available stages.
 *
 * Note: Build stage removed - we use source-first development with tsx.
 * TypeScript is only used for typechecking (noEmit: true).
 */

import type { Stage, StageName } from '../contracts/index.js';
import { agentsStage } from './agents.js';
import { checkStage } from './check.js';
import { devcontainerStage } from './devcontainer.js';
import { docsStage } from './docs.js';
import { doctorStage } from './doctor.js';
import { hermeticStage } from './hermetic.js';
import { installStage } from './install.js';
import { lintStage } from './lint.js';
import { testStage } from './test.js';
import { typecheckStage } from './typecheck.js';

export { agentsStage } from './agents.js';
export { checkStage } from './check.js';
export { devcontainerStage } from './devcontainer.js';
export { docsStage } from './docs.js';
export { installStage } from './install.js';
export { lintStage } from './lint.js';
export { testStage } from './test.js';
export { typecheckStage } from './typecheck.js';

/**
 * Map of stage names to stage implementations.
 */
export const stageRegistry: Record<StageName, Stage> = {
  agents: agentsStage,
  check: checkStage,
  devcontainer: devcontainerStage,
  docs: docsStage,
  install: installStage,
  doctor: doctorStage,
  lint: lintStage,
  typecheck: typecheckStage,
  hermetic: hermeticStage,
  test: testStage,
};

/**
 * Default stage execution order.
 */
export const DEFAULT_STAGE_ORDER: StageName[] = [
  'check',
  'devcontainer',
  'docs',
  'agents',
  'install',
  'doctor',
  'lint',
  'typecheck',
  'hermetic',
  'test',
];

/**
 * Get a stage by name.
 */
export function getStage(name: StageName): Stage {
  return stageRegistry[name];
}
