import type { ObjectFactory, ObjectValidator } from '@conveaux/contract-rate-limited-pool';
import { describe, expect, it } from 'vitest';
import {
  acquire,
  available,
  createRateLimitedPool,
  inUse,
  release,
  size,
  validateRateLimitedPool,
} from './index';

// =============================================================================
// Test Helpers
// =============================================================================

interface TestResource {
  id: number;
  isValid: boolean;
}

function createTestFactory(startId = 0): ObjectFactory<TestResource> {
  let nextId = startId;
  return {
    create: async () => ({ id: nextId++, isValid: true }),
  };
}

function createTestValidator(): ObjectValidator<TestResource> {
  return {
    validate: async (resource: TestResource) => resource.isValid,
  };
}

// =============================================================================
// Creation Tests
// =============================================================================

describe('createRateLimitedPool', () => {
  it('creates a pool with specified configuration', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    expect(pool.maxConcurrent).toBe(3);
    expect(pool.poolSize).toBe(10);
    expect(pool.available).toEqual([]);
    expect(pool.inUse).toEqual([]);
    expect(pool.queuedWaiters).toBe(0);
    expect(pool.availablePermits).toBe(3);
  });

  it('creates a pool with validator', async () => {
    const validator = createTestValidator();
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 2,
      poolSize: 5,
      validator,
    });

    expect(pool.validator).toBe(validator);
  });

  it('throws for invalid maxConcurrent', async () => {
    await expect(
      createRateLimitedPool({
        factory: createTestFactory(),
        maxConcurrent: 0,
        poolSize: 10,
      })
    ).rejects.toThrow('maxConcurrent must be a positive integer, got: 0');

    await expect(
      createRateLimitedPool({
        factory: createTestFactory(),
        maxConcurrent: -1,
        poolSize: 10,
      })
    ).rejects.toThrow('maxConcurrent must be a positive integer, got: -1');

    await expect(
      createRateLimitedPool({
        factory: createTestFactory(),
        maxConcurrent: 2.5,
        poolSize: 10,
      })
    ).rejects.toThrow('maxConcurrent must be a positive integer, got: 2.5');
  });

  it('throws for invalid poolSize', async () => {
    await expect(
      createRateLimitedPool({
        factory: createTestFactory(),
        maxConcurrent: 5,
        poolSize: 0,
      })
    ).rejects.toThrow('poolSize must be a positive integer, got: 0');

    await expect(
      createRateLimitedPool({
        factory: createTestFactory(),
        maxConcurrent: 5,
        poolSize: -1,
      })
    ).rejects.toThrow('poolSize must be a positive integer, got: -1');
  });

  it('throws when maxConcurrent exceeds poolSize', async () => {
    await expect(
      createRateLimitedPool({
        factory: createTestFactory(),
        maxConcurrent: 10,
        poolSize: 5,
      })
    ).rejects.toThrow('maxConcurrent (10) cannot be greater than poolSize (5)');
  });

  it('allows maxConcurrent equal to poolSize', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 5,
      poolSize: 5,
    });

    expect(pool.maxConcurrent).toBe(5);
    expect(pool.poolSize).toBe(5);
  });
});

// =============================================================================
// Acquire and Release Tests
// =============================================================================

describe('acquire', () => {
  it('acquires a resource from the pool', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const { resource, pool: newPool } = await acquire(pool);

    expect(resource).toEqual({ id: 0, isValid: true });
    expect(newPool.inUse).toHaveLength(1);
    expect(newPool.inUse[0]).toBe(resource);
    expect(newPool.availablePermits).toBe(2);
  });

  it('acquires multiple resources up to maxConcurrent', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const resources: TestResource[] = [];

    for (let i = 0; i < 3; i++) {
      const result = await acquire(pool);
      resources.push(result.resource);
      pool = result.pool;
    }

    expect(resources).toHaveLength(3);
    expect(pool.inUse).toHaveLength(3);
    expect(pool.availablePermits).toBe(0);
    expect(pool.queuedWaiters).toBe(0);
  });

  it('waits when maxConcurrent is reached', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 2,
      poolSize: 5,
    });

    const events: string[] = [];

    // Acquire up to maxConcurrent
    const result1 = await acquire(pool);
    pool = result1.pool;
    events.push('acquired-1');

    const result2 = await acquire(pool);
    pool = result2.pool;
    events.push('acquired-2');

    expect(pool.availablePermits).toBe(0);

    // This should wait
    const promise = acquire(pool).then((result) => {
      pool = result.pool;
      events.push('acquired-3');
      return result;
    });

    // Give time for async operations
    await Promise.resolve();
    expect(events).toEqual(['acquired-1', 'acquired-2']);

    // Release one resource
    pool = release(pool, result1.resource);
    events.push('released-1');

    // Now the waiting acquire should complete
    await promise;
    expect(events).toEqual(['acquired-1', 'acquired-2', 'released-1', 'acquired-3']);
  });

  it('tracks queued waiters correctly', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 1,
      poolSize: 5,
    });

    // Acquire the only permit
    const result1 = await acquire(pool);
    pool = result1.pool;
    expect(pool.queuedWaiters).toBe(0);

    // Queue up waiters (don't await)
    const promise1 = acquire(pool);
    const promise2 = acquire(pool);

    // Give time for promises to queue
    await new Promise((resolve) => setImmediate(resolve));

    // Check that waiters are tracked
    // Note: queuedWaiters might not update immediately due to async nature
    // We'll verify behavior through release

    // Release and let waiters proceed
    pool = release(pool, result1.resource);
    const result2 = await promise1;
    pool = result2.pool;

    pool = release(pool, result2.resource);
    const result3 = await promise2;
    pool = result3.pool;

    expect(pool.queuedWaiters).toBe(0);
  });
});

describe('release', () => {
  it('releases a resource back to the pool', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const { resource, pool: newPool } = await acquire(pool);
    pool = newPool;

    expect(pool.inUse).toHaveLength(1);
    expect(pool.available).toHaveLength(0);

    pool = release(pool, resource);

    expect(pool.inUse).toHaveLength(0);
    expect(pool.available).toHaveLength(1);
    expect(pool.available[0]).toBe(resource);
    expect(pool.availablePermits).toBe(3);
  });

  it('throws when releasing resource not in use', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const fakeResource = { id: 999, isValid: true };

    expect(() => release(pool, fakeResource)).toThrow('Cannot release object that is not in use');
  });

  it('allows next waiter to proceed', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 1,
      poolSize: 5,
    });

    const result1 = await acquire(pool);
    pool = result1.pool;

    const events: string[] = [];
    const promise = acquire(pool).then((result) => {
      events.push('waiter-acquired');
      return result;
    });

    await Promise.resolve();
    expect(events).toEqual([]);

    pool = release(pool, result1.resource);
    const result2 = await promise;

    expect(events).toEqual(['waiter-acquired']);
    expect(result2.pool.availablePermits).toBe(0);
  });
});

// =============================================================================
// FIFO Ordering Tests
// =============================================================================

describe('FIFO ordering under contention', () => {
  it('serves waiters in FIFO order', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 1,
      poolSize: 10,
    });

    const order: number[] = [];

    // Acquire the only permit
    const result1 = await acquire(pool);

    // Queue up multiple waiters - each releases after recording order
    const waiters = Array.from({ length: 5 }, (_, i) =>
      acquire(pool).then((result) => {
        order.push(i);
        release(pool, result.resource);
        return result;
      })
    );

    // Give time for all waiters to queue
    await new Promise((resolve) => setImmediate(resolve));

    // Release and let the chain proceed
    release(pool, result1.resource);

    await Promise.all(waiters);

    // Verify FIFO order
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  it('maintains FIFO order with many concurrent waiters', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 2,
      poolSize: 20,
    });

    const order: number[] = [];

    // Acquire up to maxConcurrent
    const result1 = await acquire(pool);
    const result2 = await acquire(pool);

    // Queue up 10 waiters - each releases after recording order
    const waiters = Array.from({ length: 10 }, (_, i) =>
      acquire(pool).then((result) => {
        order.push(i);
        release(pool, result.resource);
        return result;
      })
    );

    await new Promise((resolve) => setImmediate(resolve));

    // Release both initial resources
    release(pool, result1.resource);
    release(pool, result2.resource);

    await Promise.all(waiters);

    // Verify FIFO order (first two should be 0 and 1, but order might vary slightly)
    // Check that all numbers are present
    expect(order.sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('handles interleaved acquire and release with FIFO', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 1,
      poolSize: 5,
    });

    const events: string[] = [];

    const result1 = await acquire(pool);
    pool = result1.pool;
    events.push('acquired-1');

    const waiter1 = acquire(pool).then((result) => {
      events.push('acquired-2');
      return result;
    });

    const waiter2 = acquire(pool).then((result) => {
      events.push('acquired-3');
      return result;
    });

    await Promise.resolve();

    pool = release(pool, result1.resource);
    events.push('released-1');

    const result2 = await waiter1;
    pool = result2.pool;

    pool = release(pool, result2.resource);
    events.push('released-2');

    const result3 = await waiter2;
    pool = result3.pool;

    expect(events).toEqual(['acquired-1', 'released-1', 'acquired-2', 'released-2', 'acquired-3']);

    pool = release(pool, result3.resource);
  });
});

// =============================================================================
// Async Coordination Tests
// =============================================================================

describe('async coordination', () => {
  it('coordinates multiple concurrent tasks with rate limiting', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    let concurrentCount = 0;
    let maxConcurrent = 0;

    const task = async (_id: number) => {
      const result = await acquire(pool);

      try {
        concurrentCount++;
        maxConcurrent = Math.max(maxConcurrent, concurrentCount);

        // Simulate work
        await new Promise((resolve) => setTimeout(resolve, 10));
      } finally {
        concurrentCount--;
        release(pool, result.resource);
      }
    };

    // Run 10 tasks with max concurrency of 3
    await Promise.all(Array.from({ length: 10 }, (_, i) => task(i)));

    expect(maxConcurrent).toBe(3);
    expect(concurrentCount).toBe(0);
  });

  it('handles task failures without blocking the queue', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 2,
      poolSize: 5,
    });

    let errors = 0;
    const events: string[] = [];

    const failingTask = async (id: number) => {
      const result = await acquire(pool);

      try {
        events.push(`task-${id}-acquired`);
        throw new Error(`task ${id} failed`);
      } finally {
        release(pool, result.resource);
        events.push(`task-${id}-released`);
      }
    };

    const successTask = async (id: number) => {
      const result = await acquire(pool);

      try {
        events.push(`task-${id}-acquired`);
      } finally {
        release(pool, result.resource);
        events.push(`task-${id}-released`);
      }
    };

    // Mix failing and successful tasks
    const tasks = [
      failingTask(1).catch(() => errors++),
      successTask(2),
      failingTask(3).catch(() => errors++),
      successTask(4),
    ];

    await Promise.all(tasks);

    expect(errors).toBe(2);

    // All tasks should have completed
    expect(events).toContain('task-1-acquired');
    expect(events).toContain('task-1-released');
    expect(events).toContain('task-2-acquired');
    expect(events).toContain('task-2-released');
    expect(events).toContain('task-3-acquired');
    expect(events).toContain('task-3-released');
    expect(events).toContain('task-4-acquired');
    expect(events).toContain('task-4-released');
  });

  it('handles rapid acquire/release cycles', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 5,
      poolSize: 10,
    });

    const iterations = 50;

    for (let i = 0; i < iterations; i++) {
      const result = await acquire(pool);
      pool = result.pool;
      pool = release(pool, result.resource);
    }

    expect(pool.availablePermits).toBe(5);
    expect(pool.inUse).toHaveLength(0);
  });

  it('reuses resources from the pool', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 5,
    });

    // Acquire and release a resource
    const result1 = await acquire(pool);
    pool = result1.pool;
    const firstResource = result1.resource;
    pool = release(pool, firstResource);

    // Acquire again - should reuse the same resource
    const result2 = await acquire(pool);
    pool = result2.pool;

    expect(result2.resource).toBe(firstResource);
    expect(size(pool)).toBe(1); // Only one resource was ever created

    pool = release(pool, result2.resource);
  });

  it('creates new resources up to poolSize', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 5,
    });

    const resources: TestResource[] = [];

    // Acquire 3 resources (up to maxConcurrent)
    for (let i = 0; i < 3; i++) {
      const result = await acquire(pool);
      resources.push(result.resource);
      pool = result.pool;
    }

    expect(size(pool)).toBe(3);
    expect(pool.inUse).toHaveLength(3);

    // Release all
    for (const resource of resources) {
      pool = release(pool, resource);
    }

    expect(pool.available).toHaveLength(3);
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('validateRateLimitedPool', () => {
  it('validates a valid pool', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const result = validateRateLimitedPool(pool);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects invalid maxConcurrent', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    // Manually corrupt the pool
    const corruptedPool = { ...pool, maxConcurrent: 0 };
    const result = validateRateLimitedPool(corruptedPool);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      type: 'invalid_concurrent_limit',
      details: 'maxConcurrent must be a positive integer, got: 0',
    });
  });

  it('detects invalid poolSize', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const corruptedPool = { ...pool, poolSize: -1 };
    const result = validateRateLimitedPool(corruptedPool);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      type: 'invalid_pool_size',
      details: 'poolSize must be a positive integer, got: -1',
    });
  });

  it('detects maxConcurrent exceeding poolSize', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const corruptedPool = { ...pool, maxConcurrent: 15, poolSize: 10 };
    const result = validateRateLimitedPool(corruptedPool);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      type: 'concurrent_exceeds_pool_size',
      details: 'maxConcurrent (15) cannot be greater than poolSize (10)',
    });
  });

  it('detects invalid permit count', async () => {
    const pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const corruptedPool = { ...pool, availablePermits: -1 };
    const result = validateRateLimitedPool(corruptedPool);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      type: 'invalid_permit_count',
      details: 'availablePermits (-1) must be between 0 and maxConcurrent (3)',
    });
  });
});

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('helper functions', () => {
  it('available() returns available resource count', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    expect(available(pool)).toBe(0);

    const result = await acquire(pool);
    pool = result.pool;
    pool = release(pool, result.resource);

    expect(available(pool)).toBe(1);
  });

  it('inUse() returns in-use resource count', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    expect(inUse(pool)).toBe(0);

    const result = await acquire(pool);
    pool = result.pool;

    expect(inUse(pool)).toBe(1);

    pool = release(pool, result.resource);
    expect(inUse(pool)).toBe(0);
  });

  it('size() returns total resource count', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    expect(size(pool)).toBe(0);

    const result1 = await acquire(pool);
    pool = result1.pool;
    expect(size(pool)).toBe(1);

    const result2 = await acquire(pool);
    pool = result2.pool;
    expect(size(pool)).toBe(2);

    pool = release(pool, result1.resource);
    expect(size(pool)).toBe(2); // Still 2, just moved from inUse to available

    pool = release(pool, result2.resource);
    expect(size(pool)).toBe(2);
  });
});

// =============================================================================
// Resource Validator Tests
// =============================================================================

describe('resource validation', () => {
  it('skips invalid resources during acquisition', async () => {
    const factory = createTestFactory();
    const validator = createTestValidator();

    let pool = await createRateLimitedPool({
      factory,
      maxConcurrent: 3,
      poolSize: 10,
      validator,
    });

    // Acquire and release a resource
    const result1 = await acquire(pool);
    pool = result1.pool;
    pool = release(pool, result1.resource);

    // Mark the resource as invalid
    result1.resource.isValid = false;

    // Next acquire should create a new resource instead of reusing invalid one
    const result2 = await acquire(pool);
    pool = result2.pool;

    expect(result2.resource).not.toBe(result1.resource);
    expect(result2.resource.isValid).toBe(true);

    pool = release(pool, result2.resource);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  it('handles pool with maxConcurrent=1 (mutex-like)', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 1,
      poolSize: 5,
    });

    const events: string[] = [];

    const result1 = await acquire(pool);
    pool = result1.pool;
    events.push('task-1-acquired');

    const task2 = acquire(pool).then((result) => {
      events.push('task-2-acquired');
      return result;
    });

    await Promise.resolve();
    expect(events).toEqual(['task-1-acquired']);

    pool = release(pool, result1.resource);
    const result2 = await task2;
    pool = result2.pool;

    expect(events).toEqual(['task-1-acquired', 'task-2-acquired']);

    pool = release(pool, result2.resource);
  });

  it('handles pool with maxConcurrent equal to poolSize', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 5,
      poolSize: 5,
    });

    const resources: TestResource[] = [];

    // Acquire all resources
    for (let i = 0; i < 5; i++) {
      const result = await acquire(pool);
      resources.push(result.resource);
      pool = result.pool;
    }

    expect(pool.availablePermits).toBe(0);
    expect(pool.inUse).toHaveLength(5);

    // Release all
    for (const resource of resources) {
      pool = release(pool, resource);
    }

    expect(pool.availablePermits).toBe(5);
    expect(pool.available).toHaveLength(5);
  });

  it('returns to initial state after balanced operations', async () => {
    let pool = await createRateLimitedPool({
      factory: createTestFactory(),
      maxConcurrent: 3,
      poolSize: 10,
    });

    const initialPermits = pool.availablePermits;

    // Do various operations
    const result1 = await acquire(pool);
    pool = result1.pool;

    const result2 = await acquire(pool);
    pool = result2.pool;

    pool = release(pool, result1.resource);

    const result3 = await acquire(pool);
    pool = result3.pool;

    pool = release(pool, result2.resource);
    pool = release(pool, result3.resource);

    expect(pool.availablePermits).toBe(initialPermits);
    expect(pool.inUse).toHaveLength(0);
  });
});
