/**
 * @conveaux/contract-ephemeral-scheduler
 *
 * Ephemeral scheduler contract for in-memory task scheduling.
 * Provides lifecycle-managed scheduling beyond raw setTimeout/setInterval.
 *
 * This package contains NO runtime code - only types.
 *
 * Usage:
 * - Inject an EphemeralScheduler at composition time
 * - Use delay() for one-shot callbacks
 * - Use interval() for recurring callbacks
 * - Call dispose() for clean shutdown
 */

// =============================================================================
// Low-level Timer Types
// =============================================================================

/**
 * Timer ID type - opaque handle returned by setTimeout/setInterval.
 * Uses ReturnType to match the platform's timer ID type.
 */
export type TimerId = ReturnType<typeof globalThis.setTimeout>;

/**
 * setTimeout function signature.
 *
 * @example
 * ```typescript
 * const deps = { setTimeout: globalThis.setTimeout };
 * const id = deps.setTimeout(() => console.log('done'), 1000);
 * ```
 */
export type SetTimeoutFn = (callback: () => void, ms: number) => TimerId;

/**
 * clearTimeout function signature.
 */
export type ClearTimeoutFn = (id: TimerId) => void;

/**
 * setInterval function signature.
 */
export type SetIntervalFn = (callback: () => void, ms: number) => TimerId;

/**
 * clearInterval function signature.
 */
export type ClearIntervalFn = (id: TimerId) => void;

// =============================================================================
// High-level Scheduler Interface
// =============================================================================

/**
 * Cancellable handle returned by scheduling operations.
 * Call cancel() to abort the scheduled task before execution.
 */
export interface Cancellable {
  /**
   * Cancel the scheduled task.
   * Safe to call multiple times (idempotent).
   * No-op if task already executed or cancelled.
   */
  cancel(): void;
}

/**
 * Callback for scheduled tasks.
 * Void return - side effects only.
 */
export type ScheduledCallback = () => void;

/**
 * Options for interval scheduling.
 */
export interface IntervalOptions {
  /**
   * If true, execute callback immediately before starting interval.
   * @default false
   */
  readonly immediate?: boolean;
}

/**
 * Scheduler for ephemeral (in-memory) task scheduling.
 *
 * All scheduled tasks are tracked and can be cancelled via dispose().
 * This enables clean shutdown without leaked timers.
 *
 * "Ephemeral" means:
 * - In-memory only (no persistence)
 * - Lost on process restart
 * - Lightweight, no external dependencies
 *
 * @example
 * ```typescript
 * const scheduler = createEphemeralScheduler({
 *   setTimeout: globalThis.setTimeout,
 *   clearTimeout: globalThis.clearTimeout,
 *   setInterval: globalThis.setInterval,
 *   clearInterval: globalThis.clearInterval,
 * });
 *
 * // One-shot delay
 * const handle = scheduler.delay(() => console.log('done'), 1000);
 * handle.cancel(); // Cancel before execution
 *
 * // Recurring interval
 * const ticker = scheduler.interval(() => tick(), 100);
 *
 * // Clean shutdown - cancels all pending
 * const cancelled = scheduler.dispose();
 * console.log(`Cancelled ${cancelled} tasks`);
 * ```
 */
export interface EphemeralScheduler {
  /**
   * Schedule a one-shot callback after a delay.
   *
   * @param callback - Function to execute after delay
   * @param delayMs - Delay in milliseconds
   * @returns Cancellable handle
   */
  delay(callback: ScheduledCallback, delayMs: number): Cancellable;

  /**
   * Schedule a recurring callback at fixed intervals.
   *
   * @param callback - Function to execute on each interval
   * @param intervalMs - Interval in milliseconds
   * @param options - Optional interval configuration
   * @returns Cancellable handle
   */
  interval(callback: ScheduledCallback, intervalMs: number, options?: IntervalOptions): Cancellable;

  /**
   * Number of currently pending scheduled tasks.
   * Useful for observability and graceful shutdown checks.
   */
  readonly pendingCount: number;

  /**
   * Cancel all pending scheduled tasks.
   * Safe to call multiple times (idempotent).
   * After dispose(), the scheduler can still be used (new tasks allowed).
   *
   * @returns Number of tasks that were cancelled
   */
  dispose(): number;
}
