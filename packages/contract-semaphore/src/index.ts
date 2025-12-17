/**
 * @conveaux/contract-semaphore
 *
 * Pure types for semaphore concurrency control primitive.
 * No runtime code - all operations are functions in @conveaux/port-semaphore.
 *
 * A semaphore controls access to a resource pool with a fixed number of permits.
 * Unlike ring buffer which is pure data, semaphore is inherently stateful due to
 * async acquire/release operations, but we keep the interface clean and minimal.
 */

// =============================================================================
// Core Interface
// =============================================================================

/**
 * A semaphore for controlling concurrent access to a resource pool.
 *
 * Maintains a fixed number of permits. Callers acquire permits before accessing
 * the resource and release them when done. If no permits are available, acquire
 * operations wait until a permit becomes available.
 *
 * @example
 * ```typescript
 * import { createSemaphore } from '@conveaux/port-semaphore';
 *
 * const sem = createSemaphore({ permits: 3 });
 *
 * await sem.acquire();
 * try {
 *   // Access shared resource
 * } finally {
 *   sem.release();
 * }
 * ```
 */
export interface Semaphore {
  /**
   * Acquire a permit, waiting if none are available.
   *
   * Blocks until a permit becomes available. Multiple callers waiting
   * for permits are served in FIFO order.
   *
   * @returns Promise that resolves when a permit is acquired
   *
   * @example
   * ```typescript
   * await semaphore.acquire();
   * try {
   *   // Critical section - limited concurrency
   * } finally {
   *   semaphore.release();
   * }
   * ```
   */
  acquire(): Promise<void>;

  /**
   * Release a permit, allowing a waiting acquirer to proceed.
   *
   * If there are waiters, the next waiter in FIFO order is granted the permit.
   * Otherwise, the permit is added back to the available pool.
   *
   * IMPORTANT: Must only be called after a successful acquire(). Calling release()
   * without a corresponding acquire() will corrupt the semaphore state.
   *
   * @example
   * ```typescript
   * await semaphore.acquire();
   * try {
   *   // Use resource
   * } finally {
   *   semaphore.release(); // Always release in finally block
   * }
   * ```
   */
  release(): void;

  /**
   * Try to acquire a permit without waiting.
   *
   * @returns True if a permit was acquired, false if none available
   *
   * @example
   * ```typescript
   * if (semaphore.tryAcquire()) {
   *   try {
   *     // Got permit immediately
   *   } finally {
   *     semaphore.release();
   *   }
   * } else {
   *   // No permit available, do something else
   * }
   * ```
   */
  tryAcquire(): boolean;

  /**
   * Number of permits currently available.
   *
   * This is a snapshot value and may change immediately after being read
   * in concurrent scenarios.
   *
   * @example
   * ```typescript
   * console.log(`${semaphore.availablePermits} permits available`);
   * ```
   */
  readonly availablePermits: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating a semaphore.
 */
export interface SemaphoreOptions {
  /**
   * The number of permits available in the semaphore.
   * Must be a positive integer.
   *
   * @example
   * ```typescript
   * // Allow up to 5 concurrent operations
   * const sem = createSemaphore({ permits: 5 });
   * ```
   */
  readonly permits: number;
}
