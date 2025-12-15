/**
 * Stage registry - exports all available stages.
 *
 * Note: Build stage removed - we use source-first development with tsx.
 * TypeScript is only used for typechecking (noEmit: true).
 */

import type { Stage, StageName } from '../contracts/index.js';
import { checkStage } from './check.js';
import { installStage } from './install.js';
import { lintStage } from './lint.js';
import { testStage } from './test.js';
import { typecheckStage } from './typecheck.js';

export { checkStage } from './check.js';
export { installStage } from './install.js';
export { lintStage } from './lint.js';
export { testStage } from './test.js';
export { typecheckStage } from './typecheck.js';

/**
 * Map of stage names to stage implementations.
 */
export const stageRegistry: Record<StageName, Stage> = {
  check: checkStage,
  install: installStage,
  lint: lintStage,
  typecheck: typecheckStage,
  test: testStage,
};

/**
 * Default stage execution order.
 */
export const DEFAULT_STAGE_ORDER: StageName[] = ['check', 'install', 'lint', 'typecheck', 'test'];

/**
 * Get a stage by name.
 */
export function getStage(name: StageName): Stage {
  return stageRegistry[name];
}
