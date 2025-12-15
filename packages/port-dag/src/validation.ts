/**
 * DAG validation functions.
 *
 * Pure functions for validating DAG structure - detecting cycles,
 * missing dependencies, self-references, and duplicate IDs.
 */

import type { Dag, DagValidationError, DagValidationResult, NodeId } from '@conveaux/contract-dag';

/**
 * Validate a DAG for structural errors.
 *
 * Checks for:
 * - Duplicate node IDs
 * - Self-references (node depends on itself)
 * - Missing dependencies (depends on non-existent node)
 * - Cycles (circular dependencies)
 *
 * @param dag - The DAG to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateDag(dag);
 * if (!result.valid) {
 *   console.error('Invalid DAG:', result.errors);
 * }
 * ```
 */
export function validateDag<T>(dag: Dag<T>): DagValidationResult {
  const errors: DagValidationError[] = [];
  const nodeIds = new Set<NodeId>();

  // Check for duplicate IDs
  for (const node of dag) {
    if (nodeIds.has(node.id)) {
      errors.push({
        type: 'duplicate_id',
        nodeId: node.id,
        details: `Duplicate node ID: "${node.id}"`,
      });
    }
    nodeIds.add(node.id);
  }

  // Check for self-references and missing dependencies
  for (const node of dag) {
    // Self-reference check
    if (node.dependencies.includes(node.id)) {
      errors.push({
        type: 'self_reference',
        nodeId: node.id,
        details: `Node "${node.id}" depends on itself`,
      });
    }

    // Missing dependency check
    for (const depId of node.dependencies) {
      if (!nodeIds.has(depId)) {
        errors.push({
          type: 'missing_dependency',
          nodeId: node.id,
          details: `Node "${node.id}" depends on non-existent node "${depId}"`,
        });
      }
    }
  }

  // Check for cycles
  const cycles = detectCycles(dag);
  for (const cycle of cycles) {
    // cycle is guaranteed to have at least one element (the starting node)
    const startNode = cycle[0];
    if (startNode !== undefined) {
      errors.push({
        type: 'cycle',
        nodeId: startNode,
        details: `Cycle detected: ${cycle.join(' → ')}`,
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Detect cycles in the DAG using DFS.
 *
 * Returns an array of cycle paths. Each cycle is represented as
 * an array of node IDs forming the cycle.
 *
 * @param dag - The DAG to check for cycles
 * @returns Array of cycle paths (empty if no cycles)
 *
 * @example
 * ```typescript
 * const cycles = detectCycles(dag);
 * if (cycles.length > 0) {
 *   console.error('Cycles found:', cycles);
 * }
 * ```
 */
export function detectCycles<T>(dag: Dag<T>): NodeId[][] {
  const cycles: NodeId[][] = [];
  const visited = new Set<NodeId>();
  const recursionStack = new Set<NodeId>();
  const path: NodeId[] = [];

  // Build adjacency map for efficient lookup
  const nodeMap = new Map(dag.map((node) => [node.id, node]));

  function dfs(nodeId: NodeId): void {
    // Skip if node doesn't exist (missing dependency case)
    if (!nodeMap.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const node = nodeMap.get(nodeId)!;
    for (const depId of node.dependencies) {
      if (!visited.has(depId)) {
        dfs(depId);
      } else if (recursionStack.has(depId)) {
        // Found a cycle - extract the cycle from the path
        const cycleStartIndex = path.indexOf(depId);
        const cycle = [...path.slice(cycleStartIndex), depId];
        cycles.push(cycle);
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
  }

  // Run DFS from each unvisited node
  for (const node of dag) {
    if (!visited.has(node.id)) {
      dfs(node.id);
    }
  }

  return cycles;
}
