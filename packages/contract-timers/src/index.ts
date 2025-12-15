/**
 * @conveaux/contract-timers
 *
 * Timers contract for async scheduling.
 * Provides injectable setTimeout/clearTimeout interfaces.
 *
 * Usage:
 * - Inject the global setTimeout/clearTimeout at composition time
 * - Use for scheduling delayed operations
 */

/**
 * Timer ID type - opaque handle returned by setTimeout.
 * Uses ReturnType to match the platform's timer ID type.
 */
export type TimerId = ReturnType<typeof globalThis.setTimeout>;

/**
 * setTimeout function signature.
 *
 * @example
 * ```typescript
 * // Inject at composition time
 * const deps = { setTimeout: globalThis.setTimeout };
 *
 * // Use in functions
 * const timerId = deps.setTimeout(() => console.log('done'), 1000);
 * ```
 */
export type SetTimeoutFn = (callback: () => void, ms: number) => TimerId;

/**
 * clearTimeout function signature.
 *
 * @example
 * ```typescript
 * // Inject at composition time
 * const deps = { clearTimeout: globalThis.clearTimeout };
 *
 * // Use in functions
 * deps.clearTimeout(timerId);
 * ```
 */
export type ClearTimeoutFn = (id: TimerId) => void;

/**
 * setInterval function signature.
 *
 * @example
 * ```typescript
 * const deps = { setInterval: globalThis.setInterval };
 * const intervalId = deps.setInterval(() => tick(), 1000);
 * ```
 */
export type SetIntervalFn = (callback: () => void, ms: number) => TimerId;

/**
 * clearInterval function signature.
 */
export type ClearIntervalFn = (id: TimerId) => void;

/**
 * Timer dependencies bundle for injection.
 *
 * @example
 * ```typescript
 * const timerDeps: TimerDependencies = {
 *   setTimeout: globalThis.setTimeout,
 *   clearTimeout: globalThis.clearTimeout,
 * };
 * ```
 */
export interface TimerDependencies {
  readonly setTimeout: SetTimeoutFn;
  readonly clearTimeout: ClearTimeoutFn;
}
