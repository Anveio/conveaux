/**
 * DAG query functions.
 *
 * Pure functions for querying DAG structure - topological ordering,
 * finding roots/leaves, and node lookups.
 */

import type { Dag, DagNode, NodeId } from '@conveaux/contract-dag';

/**
 * Get topological order of node IDs using Kahn's algorithm.
 *
 * Returns nodes in an order where all dependencies come before
 * their dependents. This is the order nodes should be executed.
 *
 * @param dag - The DAG to sort
 * @returns Array of node IDs in topological order
 * @throws Error if the DAG contains cycles
 *
 * @example
 * ```typescript
 * const order = getTopologicalOrder(dag);
 * // ['check', 'install', 'lint', 'typecheck', 'test']
 * ```
 */
export function getTopologicalOrder<T>(dag: Dag<T>): NodeId[] {
  // Build adjacency and in-degree maps
  const inDegree = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>();

  // Initialize
  for (const node of dag) {
    inDegree.set(node.id, node.dependencies.length);
    dependents.set(node.id, []);
  }

  // Build dependents map (reverse edges)
  for (const node of dag) {
    for (const depId of node.dependencies) {
      const deps = dependents.get(depId);
      if (deps) {
        deps.push(node.id);
      }
    }
  }

  // Start with nodes that have no dependencies
  const queue: NodeId[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const result: NodeId[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);

    // Reduce in-degree for all dependents
    // nodeId is guaranteed to be in dependents since it came from the queue,
    // which only contains nodes from inDegree (initialized for all DAG nodes)
    const nodeDependents = dependents.get(nodeId)!;
    for (const depId of nodeDependents) {
      // depId is guaranteed to be in inDegree since it was added to nodeDependents
      // only for nodes that exist in the DAG
      const newDegree = inDegree.get(depId)! - 1;
      inDegree.set(depId, newDegree);
      if (newDegree === 0) {
        queue.push(depId);
      }
    }
  }

  // If we didn't process all nodes, there's a cycle
  if (result.length !== dag.length) {
    throw new Error('Cannot compute topological order: DAG contains cycles');
  }

  return result;
}

/**
 * Get root nodes (nodes with no dependencies).
 *
 * Root nodes are entry points into the DAG and can be
 * executed immediately without waiting for anything.
 *
 * @param dag - The DAG to query
 * @returns Array of root node IDs
 *
 * @example
 * ```typescript
 * const roots = getRoots(dag);
 * // ['check'] - the only node with no dependencies
 * ```
 */
export function getRoots<T>(dag: Dag<T>): NodeId[] {
  return dag.filter((node) => node.dependencies.length === 0).map((node) => node.id);
}

/**
 * Get leaf nodes (nodes that nothing depends on).
 *
 * Leaf nodes are the final outputs of the DAG - nothing
 * else needs them to complete.
 *
 * @param dag - The DAG to query
 * @returns Array of leaf node IDs
 *
 * @example
 * ```typescript
 * const leaves = getLeaves(dag);
 * // ['test', 'docs'] - nothing depends on these
 * ```
 */
export function getLeaves<T>(dag: Dag<T>): NodeId[] {
  // Collect all nodes that are dependencies of other nodes
  const hasDependents = new Set<NodeId>();
  for (const node of dag) {
    for (const depId of node.dependencies) {
      hasDependents.add(depId);
    }
  }

  // Return nodes that are not in the hasDependents set
  return dag.filter((node) => !hasDependents.has(node.id)).map((node) => node.id);
}

/**
 * Get direct dependents of a node (nodes that depend on it).
 *
 * @param dag - The DAG to query
 * @param nodeId - The node to find dependents for
 * @returns Array of dependent node IDs
 *
 * @example
 * ```typescript
 * const deps = getDependents(dag, 'install');
 * // ['lint', 'typecheck'] - these depend on install
 * ```
 */
export function getDependents<T>(dag: Dag<T>, nodeId: NodeId): NodeId[] {
  return dag.filter((node) => node.dependencies.includes(nodeId)).map((node) => node.id);
}

/**
 * Get a node by ID.
 *
 * @param dag - The DAG to query
 * @param nodeId - The ID of the node to retrieve
 * @returns The node if found, undefined otherwise
 *
 * @example
 * ```typescript
 * const node = getNode(dag, 'build');
 * if (node) {
 *   console.log(node.data);
 * }
 * ```
 */
export function getNode<T>(dag: Dag<T>, nodeId: NodeId): DagNode<T> | undefined {
  return dag.find((node) => node.id === nodeId);
}
