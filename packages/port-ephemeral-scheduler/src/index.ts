/**
 * @conveaux/port-ephemeral-scheduler
 *
 * Ephemeral scheduler implementation for in-memory task scheduling.
 * All timer dependencies are injected - no globals used.
 *
 * Follows the hermetic primitive port pattern.
 */

import type {
  Cancellable,
  ClearIntervalFn,
  ClearTimeoutFn,
  EphemeralScheduler,
  IntervalOptions,
  ScheduledCallback,
  SetIntervalFn,
  SetTimeoutFn,
  TimerId,
} from '@conveaux/contract-ephemeral-scheduler';

// Re-export contract types for convenience
export type {
  Cancellable,
  ClearIntervalFn,
  ClearTimeoutFn,
  EphemeralScheduler,
  IntervalOptions,
  ScheduledCallback,
  SetIntervalFn,
  SetTimeoutFn,
  TimerId,
} from '@conveaux/contract-ephemeral-scheduler';

/**
 * Dependencies for creating an ephemeral scheduler.
 * Inject the global timer functions at composition time.
 */
export interface EphemeralSchedulerDependencies {
  readonly setTimeout: SetTimeoutFn;
  readonly clearTimeout: ClearTimeoutFn;
  readonly setInterval: SetIntervalFn;
  readonly clearInterval: ClearIntervalFn;
}

/**
 * Options for configuring scheduler behavior.
 * Currently empty, reserved for future options.
 */
export type EphemeralSchedulerOptions = Record<string, never>;

/**
 * Creates an ephemeral scheduler for in-memory task scheduling.
 *
 * @param deps - Required timer dependencies
 * @param options - Optional configuration (reserved for future use)
 * @returns An EphemeralScheduler instance
 *
 * @example
 * ```typescript
 * // Production usage - inject global timers
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
 * // Clean shutdown
 * const cancelled = scheduler.dispose();
 * console.log(`Cancelled ${cancelled} tasks`);
 * ```
 */
export function createEphemeralScheduler(
  deps: EphemeralSchedulerDependencies,
  _options: EphemeralSchedulerOptions = {}
): EphemeralScheduler {
  // Track all pending timeouts and intervals separately
  // (clearTimeout and clearInterval may behave differently on some platforms)
  const pendingTimeouts = new Set<TimerId>();
  const pendingIntervals = new Set<TimerId>();

  const delay = (callback: ScheduledCallback, delayMs: number): Cancellable => {
    let id: TimerId | null = null;

    id = deps.setTimeout(() => {
      if (id !== null) {
        pendingTimeouts.delete(id);
      }
      callback();
    }, delayMs);

    pendingTimeouts.add(id);

    return {
      cancel: () => {
        if (id !== null && pendingTimeouts.has(id)) {
          deps.clearTimeout(id);
          pendingTimeouts.delete(id);
        }
      },
    };
  };

  const interval = (
    callback: ScheduledCallback,
    intervalMs: number,
    options?: IntervalOptions
  ): Cancellable => {
    // Execute immediately if requested
    if (options?.immediate) {
      callback();
    }

    const id = deps.setInterval(callback, intervalMs);
    pendingIntervals.add(id);

    return {
      cancel: () => {
        if (pendingIntervals.has(id)) {
          deps.clearInterval(id);
          pendingIntervals.delete(id);
        }
      },
    };
  };

  const dispose = (): number => {
    const count = pendingTimeouts.size + pendingIntervals.size;

    // Clear all pending timeouts
    for (const id of pendingTimeouts) {
      deps.clearTimeout(id);
    }
    pendingTimeouts.clear();

    // Clear all pending intervals
    for (const id of pendingIntervals) {
      deps.clearInterval(id);
    }
    pendingIntervals.clear();

    return count;
  };

  return {
    delay,
    interval,
    get pendingCount() {
      return pendingTimeouts.size + pendingIntervals.size;
    },
    dispose,
  };
}
