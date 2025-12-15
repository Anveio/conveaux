import { describe, expect, it } from 'vitest';

import type { Dag, DagExecutionObserver } from '@conveaux/contract-dag';
import type { WallClock } from '@conveaux/contract-wall-clock';

import type { ExecuteDagDeps } from './execution.js';
import { executeDag } from './execution.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock clock for testing.
 * Uses Date.now() internally - tests don't need to be hermetic.
 */
function createTestClock(): WallClock {
  return { nowMs: () => Date.now() };
}

/**
 * Create deps with test clock.
 */
function createTestDeps(): ExecuteDagDeps {
  return { clock: createTestClock() };
}

// =============================================================================
// Tests
// =============================================================================

describe('executeDag', () => {
  it('executes nodes in dependency order', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];
    const executionLog: string[] = [];

    const result = await executeDag(createTestDeps(), dag, async (node) => {
      executionLog.push(node.id);
      return `result-${node.id}`;
    });

    expect(result.success).toBe(true);
    expect(executionLog).toEqual(['a', 'b', 'c']);
    expect(result.results.get('a')?.data).toBe('result-a');
    expect(result.results.get('b')?.data).toBe('result-b');
    expect(result.results.get('c')?.data).toBe('result-c');
  });

  it('executes independent nodes in parallel', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: ['a', 'b'] },
    ];
    const timestamps: Record<string, { start: number; end: number }> = {};

    await executeDag(createTestDeps(), dag, async (node) => {
      timestamps[node.id] = { start: Date.now(), end: 0 };
      await new Promise((resolve) => setTimeout(resolve, 50));
      timestamps[node.id]!.end = Date.now();
      return node.id;
    });

    // 'a' and 'b' should overlap in time (parallel execution)
    const aEnd = timestamps.a!.end;
    const bEnd = timestamps.b!.end;
    const cStart = timestamps.c!.start;

    // 'c' should start after both 'a' and 'b' end
    expect(cStart).toBeGreaterThanOrEqual(Math.max(aEnd, bEnd) - 10); // Small tolerance
  });

  it('handles empty DAG', async () => {
    const dag: Dag<string> = [];

    const result = await executeDag(createTestDeps(), dag, async () => 'result');

    expect(result.success).toBe(true);
    expect(result.executionOrder).toEqual([]);
    expect(result.results.size).toBe(0);
  });

  it('handles single node', async () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const result = await executeDag(createTestDeps(), dag, async (node) => `result-${node.id}`);

    expect(result.success).toBe(true);
    expect(result.executionOrder).toEqual(['a']);
    expect(result.results.get('a')?.status).toBe('completed');
  });

  it('fails fast by default', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const result = await executeDag(createTestDeps(), dag, async (node) => {
      if (node.id === 'b') {
        throw new Error('Node b failed');
      }
      return node.id;
    });

    expect(result.success).toBe(false);
    expect(result.failedNode).toBe('b');
    expect(result.results.get('a')?.status).toBe('completed');
    expect(result.results.get('b')?.status).toBe('failed');
    expect(result.results.get('c')?.status).toBe('skipped');
    expect(result.cancelledNodes).toContain('c');
  });

  it('continues execution when failFast is false', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: ['a'] },
    ];

    const result = await executeDag(
      createTestDeps(),
      dag,
      async (node) => {
        if (node.id === 'a') {
          throw new Error('Node a failed');
        }
        return node.id;
      },
      { failFast: false }
    );

    // 'b' should complete even though 'a' failed
    expect(result.results.get('a')?.status).toBe('failed');
    expect(result.results.get('b')?.status).toBe('completed');
    // 'c' should be skipped because its dependency 'a' failed
    expect(result.results.get('c')?.status).toBe('skipped');
  });

  it('respects maxConcurrency', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: [] },
    ];
    let maxConcurrent = 0;
    let currentConcurrent = 0;

    await executeDag(
      createTestDeps(),
      dag,
      async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise((resolve) => setTimeout(resolve, 50));
        currentConcurrent--;
        return 'done';
      },
      { maxConcurrency: 2 }
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('calls observer callbacks', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];
    const startedNodes: string[] = [];
    const completedNodes: string[] = [];

    const observer: DagExecutionObserver<string> = {
      onNodeStart: (id) => startedNodes.push(id),
      onNodeComplete: (id) => completedNodes.push(id),
    };

    await executeDag(createTestDeps(), dag, async (node) => node.id, undefined, observer);

    expect(startedNodes).toEqual(['a', 'b']);
    expect(completedNodes).toEqual(['a', 'b']);
  });

  it('calls onNodeSkipped when dependency fails', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];
    const skippedNodes: Array<{ id: string; reason: string }> = [];

    const observer: DagExecutionObserver<string> = {
      onNodeSkipped: (id, reason) => skippedNodes.push({ id, reason }),
    };

    await executeDag(
      createTestDeps(),
      dag,
      async (node) => {
        if (node.id === 'a') {
          throw new Error('Failed');
        }
        return node.id;
      },
      { failFast: true },
      observer
    );

    expect(skippedNodes).toHaveLength(1);
    const skipped = skippedNodes[0]!;
    expect(skipped.id).toBe('b');
    expect(skipped.reason).toContain('Dependency');
  });

  it('respects AbortSignal', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];
    const controller = new AbortController();

    const resultPromise = executeDag(
      createTestDeps(),
      dag,
      async (node) => {
        if (node.id === 'a') {
          controller.abort();
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
        return node.id;
      },
      { signal: controller.signal }
    );

    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.cancelledNodes.length).toBeGreaterThan(0);
  });

  it('returns correct totalDurationMs', async () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const result = await executeDag(createTestDeps(), dag, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'done';
    });

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(45); // Allow small timing variance
  });

  it('records node duration', async () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const result = await executeDag(createTestDeps(), dag, async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'done';
    });

    expect(result.results.get('a')?.durationMs).toBeGreaterThanOrEqual(45); // Allow small timing variance
  });

  it('converts non-Error exceptions to Error', async () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const result = await executeDag(createTestDeps(), dag, async () => {
      throw 'string error';
    });

    expect(result.success).toBe(false);
    expect(result.results.get('a')?.error).toBeInstanceOf(Error);
    expect(result.results.get('a')?.error?.message).toBe('string error');
  });

  it('handles complex DAG with diamond pattern', async () => {
    //     a
    //    / \
    //   b   c
    //    \ /
    //     d
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['a'] },
      { id: 'd', data: 'D', dependencies: ['b', 'c'] },
    ];
    const executionLog: string[] = [];

    const result = await executeDag(createTestDeps(), dag, async (node) => {
      executionLog.push(node.id);
      return node.id;
    });

    expect(result.success).toBe(true);
    expect(executionLog[0]).toBe('a');
    expect(executionLog[executionLog.length - 1]).toBe('d');
    // 'b' and 'c' should be between 'a' and 'd'
    expect(executionLog.indexOf('b')).toBeGreaterThan(0);
    expect(executionLog.indexOf('b')).toBeLessThan(3);
    expect(executionLog.indexOf('c')).toBeGreaterThan(0);
    expect(executionLog.indexOf('c')).toBeLessThan(3);
  });

  it('handles missing dependency in DAG', async () => {
    // This tests the defensive code path for missing dependencies
    // Normally validation would catch this, but executeDag handles it gracefully
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: ['nonexistent'] }];

    const result = await executeDag(createTestDeps(), dag, async (node) => node.id);

    // The node should be skipped because its dependency doesn't exist
    expect(result.success).toBe(false);
    expect(result.results.get('a')?.status).toBe('skipped');
  });

  it('handles early abort before execution starts', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];
    const controller = new AbortController();
    controller.abort(); // Abort immediately

    const result = await executeDag(createTestDeps(), dag, async () => 'done', {
      signal: controller.signal,
    });

    expect(result.success).toBe(false);
    expect(result.cancelledNodes.length).toBeGreaterThan(0);
  });

  it('reports "Execution cancelled" when skipped due to cancellation not failed dep', async () => {
    // Test the 'Execution cancelled' message path (line 129)
    // This happens when:
    // - shouldCancel is true
    // - failedDep is undefined (all dependencies completed successfully)
    //
    // Scenario:
    // - 'a' (no deps) fails, setting shouldCancel = true
    // - 'b' (no deps) completes successfully
    // - 'c' (depends on 'b') waits for 'b', 'b' succeeds, so failedDep = undefined
    // - 'c' then checks shouldCancel which is true -> 'Execution cancelled'
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];
    const skippedReasons: string[] = [];

    const observer: DagExecutionObserver<string> = {
      onNodeSkipped: (_id, reason) => skippedReasons.push(reason),
    };

    await executeDag(
      createTestDeps(),
      dag,
      async (node) => {
        if (node.id === 'a') {
          // Fail immediately
          throw new Error('Node a failed');
        }
        if (node.id === 'b') {
          // Wait a bit to ensure 'a' has time to fail
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return node.id;
      },
      { failFast: true },
      observer
    );

    // 'c' should be skipped with 'Execution cancelled' because:
    // - Its dependency 'b' completed successfully (failedDep = undefined)
    // - But shouldCancel is true from 'a' failing
    expect(skippedReasons.some((r) => r === 'Execution cancelled')).toBe(true);
  });

  it('reports abort with observer having onNodeSkipped', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];
    const controller = new AbortController();
    const skippedNodes: string[] = [];

    const observer: DagExecutionObserver<string> = {
      onNodeSkipped: (id) => skippedNodes.push(id),
    };

    controller.abort();
    await executeDag(
      createTestDeps(),
      dag,
      async () => 'done',
      { signal: controller.signal },
      observer
    );

    expect(skippedNodes.length).toBeGreaterThan(0);
  });

  it('releases semaphore on cancellation', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: [] },
    ];
    const controller = new AbortController();
    let execCount = 0;

    const resultPromise = executeDag(
      createTestDeps(),
      dag,
      async () => {
        execCount++;
        if (execCount === 1) {
          controller.abort();
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'done';
      },
      { maxConcurrency: 1, signal: controller.signal }
    );

    const result = await resultPromise;

    expect(result.success).toBe(false);
  });

  it('skips nodes when cancellation happens during semaphore wait', async () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: [] },
    ];

    let _shouldCancel = false;
    const result = await executeDag(
      createTestDeps(),
      dag,
      async (node) => {
        if (node.id === 'a') {
          _shouldCancel = true;
          throw new Error('Node a failed');
        }
        // Other nodes might be waiting
        await new Promise((resolve) => setTimeout(resolve, 10));
        return node.id;
      },
      { maxConcurrency: 1, failFast: true }
    );

    expect(result.success).toBe(false);
    expect(result.failedNode).toBe('a');
  });
});
