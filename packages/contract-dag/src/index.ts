/**
 * @conveaux/contract-dag
 *
 * Pure types for directed acyclic graphs.
 * No runtime code - all operations are pure functions in @conveaux/port-dag.
 *
 * Design principle (L-017): A DAG is data, not a capability.
 * - Contract: pure types (DagNode, Dag, results)
 * - Port: pure functions (validateDag, getTopologicalOrder, executeDag)
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * Unique identifier for a node in the DAG.
 */
export type NodeId = string;

/**
 * A node in the DAG - pure data, no methods.
 *
 * @template T - The type of data stored in the node
 *
 * @example
 * ```typescript
 * const node: DagNode<{ name: string }> = {
 *   id: 'build',
 *   data: { name: 'Build Step' },
 *   dependencies: ['install'],
 * };
 * ```
 */
export interface DagNode<T = unknown> {
  readonly id: NodeId;
  readonly data: T;
  readonly dependencies: readonly NodeId[];
}

/**
 * A DAG is just an array of nodes - pure data.
 *
 * Operations on the DAG (validation, traversal, execution) are pure
 * functions in @conveaux/port-dag, not methods on this type.
 *
 * @template T - The type of data stored in each node
 *
 * @example
 * ```typescript
 * const dag: Dag<Stage> = [
 *   { id: 'check', data: checkStage, dependencies: [] },
 *   { id: 'install', data: installStage, dependencies: ['check'] },
 *   { id: 'build', data: buildStage, dependencies: ['install'] },
 * ];
 * ```
 */
export type Dag<T = unknown> = readonly DagNode<T>[];

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur in a DAG.
 */
export type DagValidationErrorType =
  | 'cycle'
  | 'missing_dependency'
  | 'self_reference'
  | 'duplicate_id';

/**
 * A validation error found in the DAG.
 */
export interface DagValidationError {
  readonly type: DagValidationErrorType;
  readonly nodeId: NodeId;
  readonly details: string;
}

/**
 * Result of validating a DAG.
 */
export interface DagValidationResult {
  readonly valid: boolean;
  readonly errors: readonly DagValidationError[];
}

// =============================================================================
// Execution Types
// =============================================================================

/**
 * Status of a node during execution.
 */
export type NodeStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'skipped';

/**
 * Result of executing a single node.
 *
 * @template T - The type of output data from the node execution
 */
export interface NodeResult<T = unknown> {
  readonly nodeId: NodeId;
  readonly status: NodeStatus;
  readonly data?: T;
  readonly durationMs: number;
  readonly error?: Error;
}

/**
 * Result of executing the entire DAG.
 *
 * @template T - The type of output data from each node execution
 */
export interface DagExecutionResult<T = unknown> {
  readonly success: boolean;
  readonly results: ReadonlyMap<NodeId, NodeResult<T>>;
  readonly executionOrder: readonly NodeId[];
  readonly totalDurationMs: number;
  readonly failedNode?: NodeId;
  readonly cancelledNodes: readonly NodeId[];
}

/**
 * Options for DAG execution (configuration, not dependencies).
 *
 * Dependencies like clock are passed separately via ExecuteDagDeps in the port.
 */
export interface DagExecutionOptions {
  /**
   * Maximum number of nodes to execute concurrently.
   * undefined = no limit (execute all ready nodes in parallel)
   */
  readonly maxConcurrency?: number;

  /**
   * Stop execution on first failure.
   * @default true
   */
  readonly failFast?: boolean;

  /**
   * AbortSignal for external cancellation.
   */
  readonly signal?: AbortSignal;
}

/**
 * Observer callbacks for execution progress.
 *
 * This is a capability interface (has methods) because it represents
 * callbacks that DO something (notify observers), not data.
 *
 * @template T - The type of output data from each node execution
 */
export interface DagExecutionObserver<T = unknown> {
  /**
   * Called when a node starts executing.
   */
  onNodeStart?(nodeId: NodeId): void;

  /**
   * Called when a node completes (success or failure).
   */
  onNodeComplete?(nodeId: NodeId, result: NodeResult<T>): void;

  /**
   * Called when a node is skipped (dependency failed).
   */
  onNodeSkipped?(nodeId: NodeId, reason: string): void;
}
