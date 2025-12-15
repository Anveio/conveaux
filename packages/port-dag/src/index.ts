/**
 * @conveaux/port-dag
 *
 * Pure functions for directed acyclic graph operations.
 * All types come from @conveaux/contract-dag.
 *
 * Design principle (L-017): Operations on data structures are pure functions,
 * not methods on the data. The DAG is data, these functions operate on it.
 *
 * @example
 * ```typescript
 * import {
 *   validateDag,
 *   getTopologicalOrder,
 *   executeDag,
 *   type Dag,
 *   type DagNode,
 *   type ExecuteDagDeps,
 * } from '@conveaux/port-dag';
 *
 * const dag: Dag<Stage> = [
 *   { id: 'check', data: checkStage, dependencies: [] },
 *   { id: 'install', data: installStage, dependencies: ['check'] },
 *   { id: 'build', data: buildStage, dependencies: ['install'] },
 * ];
 *
 * const validation = validateDag(dag);
 * if (!validation.valid) {
 *   throw new Error(validation.errors[0].details);
 * }
 *
 * const order = getTopologicalOrder(dag);
 * // ['check', 'install', 'build']
 *
 * const result = await executeDag(
 *   { clock },
 *   dag,
 *   async (node) => node.data.run()
 * );
 * ```
 */

// Re-export all types from contract
export type {
  Dag,
  DagExecutionObserver,
  DagExecutionOptions,
  DagExecutionResult,
  DagNode,
  DagValidationError,
  DagValidationErrorType,
  DagValidationResult,
  NodeId,
  NodeResult,
  NodeStatus,
} from '@conveaux/contract-dag';

// Export validation functions
export { detectCycles, validateDag } from './validation.js';

// Export query functions
export { getDependents, getLeaves, getNode, getRoots, getTopologicalOrder } from './query.js';

// Export execution functions and types
export { executeDag, type ExecuteDagDeps } from './execution.js';
