import { describe, expect, it } from 'vitest';
import { createSemaphore } from './index';

describe('createSemaphore', () => {
  describe('creation', () => {
    it('creates a semaphore with specified permits', () => {
      const sem = createSemaphore({ permits: 5 });
      expect(sem.availablePermits).toBe(5);
    });

    it('throws for non-positive permits', () => {
      expect(() => createSemaphore({ permits: 0 })).toThrow(
        'Permits must be a positive integer, got: 0'
      );
      expect(() => createSemaphore({ permits: -1 })).toThrow(
        'Permits must be a positive integer, got: -1'
      );
    });

    it('throws for non-integer permits', () => {
      expect(() => createSemaphore({ permits: 2.5 })).toThrow(
        'Permits must be a positive integer, got: 2.5'
      );
    });
  });

  describe('acquire', () => {
    it('acquires permit immediately when available', async () => {
      const sem = createSemaphore({ permits: 3 });

      await sem.acquire();
      expect(sem.availablePermits).toBe(2);

      await sem.acquire();
      expect(sem.availablePermits).toBe(1);

      await sem.acquire();
      expect(sem.availablePermits).toBe(0);
    });

    it('waits when no permits available', async () => {
      const sem = createSemaphore({ permits: 1 });
      const events: string[] = [];

      // Acquire the only permit
      await sem.acquire();
      expect(sem.availablePermits).toBe(0);
      events.push('acquired-1');

      // This should block
      const promise = sem.acquire().then(() => {
        events.push('acquired-2');
      });

      // Give time for async operations
      await Promise.resolve();
      expect(events).toEqual(['acquired-1']);

      // Release the permit
      sem.release();
      events.push('released');

      // Now the waiting acquire should complete
      await promise;
      expect(events).toEqual(['acquired-1', 'released', 'acquired-2']);
      expect(sem.availablePermits).toBe(0);
    });

    it('serves multiple waiters in FIFO order', async () => {
      const sem = createSemaphore({ permits: 1 });
      const events: string[] = [];

      // Acquire the only permit
      await sem.acquire();

      // Queue up three waiters
      const p1 = sem.acquire().then(() => events.push('waiter-1'));
      const p2 = sem.acquire().then(() => events.push('waiter-2'));
      const p3 = sem.acquire().then(() => events.push('waiter-3'));

      // Give time for promises to register
      await new Promise((resolve) => setImmediate(resolve));
      expect(events).toEqual([]);

      // Release permits one by one
      sem.release();
      await p1;
      expect(events).toEqual(['waiter-1']);

      sem.release();
      await p2;
      expect(events).toEqual(['waiter-1', 'waiter-2']);

      sem.release();
      await p3;
      expect(events).toEqual(['waiter-1', 'waiter-2', 'waiter-3']);
    });

    it('handles multiple concurrent acquires', async () => {
      const sem = createSemaphore({ permits: 3 });
      const results: number[] = [];

      // Start 5 concurrent tasks, but only 3 can run at once
      const tasks = Array.from({ length: 5 }, async (_, i) => {
        await sem.acquire();
        results.push(i);
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10));
        sem.release();
      });

      await Promise.all(tasks);
      expect(results).toHaveLength(5);
      expect(new Set(results)).toEqual(new Set([0, 1, 2, 3, 4]));
    });
  });

  describe('release', () => {
    it('increases available permits when no waiters', () => {
      const sem = createSemaphore({ permits: 3 });
      expect(sem.availablePermits).toBe(3);

      sem.release();
      expect(sem.availablePermits).toBe(4);

      sem.release();
      expect(sem.availablePermits).toBe(5);
    });

    it('wakes up waiting acquirer instead of increasing permits', async () => {
      const sem = createSemaphore({ permits: 1 });
      const events: string[] = [];

      // Acquire the only permit
      await sem.acquire();
      expect(sem.availablePermits).toBe(0);

      // Queue a waiter
      const promise = sem.acquire().then(() => {
        events.push('acquired');
      });

      await Promise.resolve();

      // Release should wake the waiter, not increase permits
      sem.release();
      await promise;

      expect(events).toEqual(['acquired']);
      expect(sem.availablePermits).toBe(0); // Waiter got the permit
    });

    it('maintains correct permit count with acquire/release cycles', async () => {
      const sem = createSemaphore({ permits: 2 });

      await sem.acquire();
      await sem.acquire();
      expect(sem.availablePermits).toBe(0);

      sem.release();
      expect(sem.availablePermits).toBe(1);

      sem.release();
      expect(sem.availablePermits).toBe(2);

      await sem.acquire();
      expect(sem.availablePermits).toBe(1);

      sem.release();
      expect(sem.availablePermits).toBe(2);
    });
  });

  describe('tryAcquire', () => {
    it('acquires permit when available', () => {
      const sem = createSemaphore({ permits: 3 });

      expect(sem.tryAcquire()).toBe(true);
      expect(sem.availablePermits).toBe(2);

      expect(sem.tryAcquire()).toBe(true);
      expect(sem.availablePermits).toBe(1);
    });

    it('returns false when no permits available', () => {
      const sem = createSemaphore({ permits: 1 });

      expect(sem.tryAcquire()).toBe(true);
      expect(sem.availablePermits).toBe(0);

      expect(sem.tryAcquire()).toBe(false);
      expect(sem.availablePermits).toBe(0);
    });

    it('does not wait like acquire()', () => {
      const sem = createSemaphore({ permits: 1 });

      sem.tryAcquire();
      expect(sem.availablePermits).toBe(0);

      // tryAcquire returns immediately with false
      const result = sem.tryAcquire();
      expect(result).toBe(false);
      expect(sem.availablePermits).toBe(0);
    });

    it('can be mixed with acquire/release', async () => {
      const sem = createSemaphore({ permits: 2 });

      expect(sem.tryAcquire()).toBe(true);
      await sem.acquire();
      expect(sem.availablePermits).toBe(0);

      expect(sem.tryAcquire()).toBe(false);

      sem.release();
      expect(sem.tryAcquire()).toBe(true);
      expect(sem.availablePermits).toBe(0);

      sem.release();
      sem.release();
      expect(sem.availablePermits).toBe(2);
    });
  });

  describe('availablePermits', () => {
    it('reflects current permit count', async () => {
      const sem = createSemaphore({ permits: 3 });
      expect(sem.availablePermits).toBe(3);

      await sem.acquire();
      expect(sem.availablePermits).toBe(2);

      await sem.acquire();
      expect(sem.availablePermits).toBe(1);

      sem.release();
      expect(sem.availablePermits).toBe(2);
    });

    it('does not count queued waiters', async () => {
      const sem = createSemaphore({ permits: 1 });

      await sem.acquire();
      expect(sem.availablePermits).toBe(0);

      // Queue up waiters
      const p1 = sem.acquire();
      const p2 = sem.acquire();

      await Promise.resolve();
      expect(sem.availablePermits).toBe(0); // Still 0, not negative

      sem.release();
      await Promise.resolve();
      expect(sem.availablePermits).toBe(0); // Waiter got it

      sem.release();
      await p2;
      expect(sem.availablePermits).toBe(0);
    });

    it('can exceed initial permits after extra releases', () => {
      const sem = createSemaphore({ permits: 3 });

      sem.release();
      expect(sem.availablePermits).toBe(4);

      sem.release();
      sem.release();
      expect(sem.availablePermits).toBe(6);
    });
  });

  describe('complex scenarios', () => {
    it('handles interleaved acquire, tryAcquire, and release', async () => {
      const sem = createSemaphore({ permits: 2 });

      await sem.acquire(); // 1 left
      expect(sem.tryAcquire()).toBe(true); // 0 left
      expect(sem.tryAcquire()).toBe(false); // still 0

      sem.release(); // 1 left
      expect(sem.tryAcquire()).toBe(true); // 0 left

      // Queue up a waiter
      const waiter = sem.acquire();

      // Release to let waiter proceed
      sem.release();
      await waiter;

      expect(sem.availablePermits).toBe(0);
    });

    it('works with semaphore of 1 (binary semaphore/mutex)', async () => {
      const sem = createSemaphore({ permits: 1 });
      const events: string[] = [];

      await sem.acquire();
      events.push('task-1-acquired');

      const task2 = sem.acquire().then(() => {
        events.push('task-2-acquired');
      });

      await Promise.resolve();
      expect(events).toEqual(['task-1-acquired']);

      sem.release();
      await task2;
      expect(events).toEqual(['task-1-acquired', 'task-2-acquired']);
    });

    it('controls concurrency for resource pool', async () => {
      const sem = createSemaphore({ permits: 3 });
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const task = async (id: number) => {
        await sem.acquire();
        try {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          // Simulate work
          await new Promise((resolve) => setTimeout(resolve, 10));
        } finally {
          concurrentCount--;
          sem.release();
        }
      };

      // Run 10 tasks with max concurrency of 3
      await Promise.all(Array.from({ length: 10 }, (_, i) => task(i)));

      expect(maxConcurrent).toBe(3);
      expect(concurrentCount).toBe(0);
      expect(sem.availablePermits).toBe(3);
    });

    it('handles rapid acquire/release cycles', async () => {
      const sem = createSemaphore({ permits: 5 });
      const iterations = 100;

      for (let i = 0; i < iterations; i++) {
        await sem.acquire();
        sem.release();
      }

      expect(sem.availablePermits).toBe(5);
    });

    it('supports timeout pattern with Promise.race', async () => {
      const sem = createSemaphore({ permits: 1 });
      await sem.acquire(); // Take the only permit

      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 50)
      );

      const acquireWithTimeout = Promise.race([sem.acquire(), timeout]);

      await expect(acquireWithTimeout).rejects.toThrow('timeout');
      expect(sem.availablePermits).toBe(0);
    });

    it('maintains FIFO order with many waiters', async () => {
      const sem = createSemaphore({ permits: 1 });
      const order: number[] = [];

      await sem.acquire(); // Take the permit

      // Queue up 10 waiters
      const waiters = Array.from({ length: 10 }, (_, i) =>
        sem.acquire().then(() => {
          order.push(i);
          sem.release();
        })
      );

      sem.release(); // Start the chain
      await Promise.all(waiters);

      expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });

    it('works correctly when used with async/await and try/finally', async () => {
      const sem = createSemaphore({ permits: 2 });
      let errors = 0;

      const failingTask = async () => {
        await sem.acquire();
        try {
          throw new Error('task failed');
        } finally {
          sem.release();
        }
      };

      const successTask = async () => {
        await sem.acquire();
        try {
          // success
        } finally {
          sem.release();
        }
      };

      // Run mix of failing and successful tasks
      const tasks = [
        failingTask().catch(() => errors++),
        successTask(),
        failingTask().catch(() => errors++),
        successTask(),
      ];

      await Promise.all(tasks);

      expect(errors).toBe(2);
      expect(sem.availablePermits).toBe(2); // All permits released
    });
  });

  describe('edge cases', () => {
    it('handles immediate acquire after tryAcquire fails', async () => {
      const sem = createSemaphore({ permits: 1 });

      sem.tryAcquire(); // Takes the permit
      expect(sem.tryAcquire()).toBe(false);

      const acquirePromise = sem.acquire();
      sem.release();
      await acquirePromise;

      expect(sem.availablePermits).toBe(0);
    });

    it('handles multiple releases before any acquire', () => {
      const sem = createSemaphore({ permits: 1 });

      sem.release();
      sem.release();
      sem.release();

      expect(sem.availablePermits).toBe(4);
    });

    it('returns to initial state after balanced operations', async () => {
      const sem = createSemaphore({ permits: 5 });

      // Do some operations
      await sem.acquire();
      await sem.acquire();
      sem.release();
      await sem.acquire();
      sem.release();
      sem.release();

      expect(sem.availablePermits).toBe(5);
    });
  });
});
