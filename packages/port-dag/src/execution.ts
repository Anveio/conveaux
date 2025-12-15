/**
 * DAG execution functions.
 *
 * Pure functions for executing DAG nodes in parallel while
 * respecting dependencies.
 */

import type {
  Dag,
  DagExecutionObserver,
  DagExecutionOptions,
  DagExecutionResult,
  DagNode,
  NodeId,
  NodeResult,
  NodeStatus,
} from '@conveaux/contract-dag';
import type { WallClock } from '@conveaux/contract-wall-clock';

// =============================================================================
// Dependencies
// =============================================================================

/**
 * Dependencies required for DAG execution.
 *
 * Per coding-patterns: dependencies are always required and come first.
 */
export interface ExecuteDagDeps {
  /** Clock for duration measurement */
  readonly clock: WallClock;
}

// =============================================================================
// Execution Function
// =============================================================================

/**
 * Execute DAG nodes in parallel, respecting dependencies.
 *
 * Each node starts executing as soon as all its dependencies complete.
 * Supports fail-fast behavior, concurrency limiting, and progress observation.
 *
 * @param deps - Required dependencies (clock for timing)
 * @param dag - The DAG to execute
 * @param runNode - Function to execute a single node
 * @param options - Execution options (optional)
 * @param observer - Progress callbacks (optional)
 * @returns Execution result with status of all nodes
 *
 * @example
 * ```typescript
 * const result = await executeDag(
 *   { clock },
 *   dag,
 *   async (node) => {
 *     console.log(`Running ${node.id}`);
 *     return await runStage(node.data);
 *   },
 *   { failFast: true },
 *   {
 *     onNodeStart: (id) => console.log(`Started: ${id}`),
 *     onNodeComplete: (id, result) => console.log(`Done: ${id}`),
 *   }
 * );
 * ```
 */
export async function executeDag<TInput, TOutput>(
  deps: ExecuteDagDeps,
  dag: Dag<TInput>,
  runNode: (node: DagNode<TInput>) => Promise<TOutput>,
  options?: DagExecutionOptions,
  observer?: DagExecutionObserver<TOutput>
): Promise<DagExecutionResult<TOutput>> {
  const { clock } = deps;

  const startTime = clock.nowMs();
  const failFast = options?.failFast ?? true;
  const maxConcurrency = options?.maxConcurrency;
  const signal = options?.signal;

  // Track results and state
  const results = new Map<NodeId, NodeResult<TOutput>>();
  const executionOrder: NodeId[] = [];
  const cancelledNodes: NodeId[] = [];
  let failedNode: NodeId | undefined;
  let shouldCancel = false;

  // Build node map and promise map
  const nodeMap = new Map(dag.map((node) => [node.id, node]));
  const nodePromises = new Map<NodeId, Promise<NodeResult<TOutput>>>();

  // Semaphore for concurrency limiting
  let activeCount = 0;
  const waitQueue: Array<() => void> = [];

  async function acquireSemaphore(): Promise<void> {
    if (maxConcurrency === undefined || activeCount < maxConcurrency) {
      activeCount++;
      return;
    }
    await new Promise<void>((resolve) => waitQueue.push(resolve));
    activeCount++;
  }

  function releaseSemaphore(): void {
    activeCount--;
    const next = waitQueue.shift();
    if (next) {
      next();
    }
  }

  // Create execution promise for a node
  function createNodePromise(node: DagNode<TInput>): Promise<NodeResult<TOutput>> {
    // If already created, return existing promise
    const existing = nodePromises.get(node.id);
    if (existing) {
      return existing;
    }

    const promise = (async (): Promise<NodeResult<TOutput>> => {
      // Wait for all dependencies first
      const depPromises = node.dependencies.map((depId) => {
        const depNode = nodeMap.get(depId);
        if (!depNode) {
          // Missing dependency - should be caught by validation
          return Promise.resolve<NodeResult<TOutput>>({
            nodeId: depId,
            status: 'failed',
            durationMs: 0,
            error: new Error(`Missing dependency: ${depId}`),
          });
        }
        return createNodePromise(depNode);
      });

      const depResults = await Promise.all(depPromises);

      // Check if we should skip due to failed dependencies or cancellation
      const failedDep = depResults.find((r) => r.status === 'failed' || r.status === 'cancelled');
      if (failedDep || shouldCancel) {
        const result: NodeResult<TOutput> = {
          nodeId: node.id,
          status: 'skipped',
          durationMs: 0,
        };
        results.set(node.id, result);
        cancelledNodes.push(node.id);
        observer?.onNodeSkipped?.(
          node.id,
          failedDep ? `Dependency "${failedDep.nodeId}" failed` : 'Execution cancelled'
        );
        return result;
      }

      // Check for abort signal
      if (signal?.aborted) {
        shouldCancel = true;
        const result: NodeResult<TOutput> = {
          nodeId: node.id,
          status: 'cancelled',
          durationMs: 0,
        };
        results.set(node.id, result);
        cancelledNodes.push(node.id);
        observer?.onNodeSkipped?.(node.id, 'Execution aborted');
        return result;
      }

      // Acquire semaphore for concurrency limiting
      await acquireSemaphore();

      // Double-check cancellation after acquiring semaphore
      if (shouldCancel || signal?.aborted) {
        releaseSemaphore();
        const result: NodeResult<TOutput> = {
          nodeId: node.id,
          status: 'cancelled',
          durationMs: 0,
        };
        results.set(node.id, result);
        cancelledNodes.push(node.id);
        return result;
      }

      // Execute the node
      const nodeStartTime = clock.nowMs();
      observer?.onNodeStart?.(node.id);
      executionOrder.push(node.id);

      let result: NodeResult<TOutput>;
      let status: NodeStatus = 'running';

      try {
        const data = await runNode(node);
        status = 'completed';
        result = {
          nodeId: node.id,
          status,
          data,
          durationMs: clock.nowMs() - nodeStartTime,
        };
      } catch (error) {
        status = 'failed';
        result = {
          nodeId: node.id,
          status,
          durationMs: clock.nowMs() - nodeStartTime,
          error: error instanceof Error ? error : new Error(String(error)),
        };

        if (failFast) {
          shouldCancel = true;
          failedNode = node.id;
        }
      } finally {
        releaseSemaphore();
      }

      results.set(node.id, result);
      observer?.onNodeComplete?.(node.id, result);
      return result;
    })();

    nodePromises.set(node.id, promise);
    return promise;
  }

  // Start all node executions
  const allPromises = dag.map((node) => createNodePromise(node));
  await Promise.all(allPromises);

  const totalDurationMs = clock.nowMs() - startTime;
  const success = !failedNode && cancelledNodes.length === 0;

  return {
    success,
    results,
    executionOrder,
    totalDurationMs,
    failedNode,
    cancelledNodes,
  };
}
