/**
 * @conveaux/port-semaphore
 *
 * Implementation of semaphore concurrency control primitive.
 * Provides FIFO waiting queue for fair permit distribution.
 */

import type { Semaphore, SemaphoreOptions } from '@conveaux/contract-semaphore';

// Re-export contract types for convenience
export type { Semaphore, SemaphoreOptions } from '@conveaux/contract-semaphore';

// =============================================================================
// Internal Types
// =============================================================================

/**
 * A waiter in the queue, with a resolve function to signal permit grant.
 * @internal
 */
interface Waiter {
  resolve: () => void;
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new semaphore with the specified number of permits.
 *
 * @param options - Configuration options for the semaphore
 * @returns A new Semaphore instance
 * @throws Error if permits is not a positive integer
 *
 * @example
 * ```typescript
 * // Allow up to 3 concurrent operations
 * const semaphore = createSemaphore({ permits: 3 });
 *
 * // Use in concurrent code
 * await semaphore.acquire();
 * try {
 *   await doWork();
 * } finally {
 *   semaphore.release();
 * }
 * ```
 */
export function createSemaphore(options: SemaphoreOptions): Semaphore {
  const { permits } = options;

  if (permits < 1 || !Number.isInteger(permits)) {
    throw new Error(`Permits must be a positive integer, got: ${permits}`);
  }

  let availablePermits = permits;
  const waiters: Waiter[] = [];

  return {
    async acquire(): Promise<void> {
      if (availablePermits > 0) {
        availablePermits--;
        return Promise.resolve();
      }

      // No permits available, queue up
      return new Promise<void>((resolve) => {
        waiters.push({ resolve });
      });
    },

    release(): void {
      // If there are waiters, grant permit to the next one (FIFO)
      const waiter = waiters.shift();
      if (waiter) {
        waiter.resolve();
      } else {
        // No waiters, add permit back to pool
        availablePermits++;
      }
    },

    tryAcquire(): boolean {
      if (availablePermits > 0) {
        availablePermits--;
        return true;
      }
      return false;
    },

    get availablePermits(): number {
      return availablePermits;
    },
  };
}
