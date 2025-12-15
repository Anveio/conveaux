/**
 * @conveaux/port-clock
 *
 * High-resolution monotonic clock implementation.
 * Follows the firedrill pattern for hermetic primitive ports.
 */

import type { Clock } from '@conveaux/contract-clock';

// Re-export the contract type for convenience
export type { Clock } from '@conveaux/contract-clock';

// =============================================================================
// Duck-Typed Platform Interfaces
// =============================================================================

/**
 * Duck-typed performance interface.
 * Allows injection of mock or alternative performance implementations.
 */
type PerformanceLike = {
  readonly now?: () => number;
};

/**
 * Duck-typed hrtime function signature.
 * Matches Node.js process.hrtime with optional bigint method.
 */
type HrtimeFn = (() => [number, number]) & {
  readonly bigint?: () => bigint;
};

/**
 * Duck-typed process interface.
 * Allows injection of mock or alternative process implementations.
 */
type ProcessLike = {
  readonly hrtime?: HrtimeFn;
};

// =============================================================================
// Environment Types
// =============================================================================

/**
 * Resolved clock environment with concrete values (no undefined).
 */
type ClockEnvironment = {
  readonly performance: PerformanceLike | null;
  readonly process: ProcessLike | null;
  readonly dateNow: () => number;
};

/**
 * Environment overrides for configuring clock sources.
 *
 * Semantics:
 * - `undefined`: Use host default (globalThis.performance, etc.)
 * - `null`: Explicitly disable this source
 * - `value`: Use this override instead of host
 */
export type ClockEnvironmentOverrides = {
  readonly performance?: PerformanceLike | null;
  readonly process?: ProcessLike | null;
  readonly dateNow?: () => number;
};

// =============================================================================
// Options Types
// =============================================================================

type ClockReadMs = () => number;
type ClockReadHrtime = () => bigint | undefined;

/**
 * Options for creating a system clock.
 */
export type ClockOptions = {
  /**
   * Seeds the starting point (in milliseconds). Useful for tests
   * where deterministic offsets are needed.
   */
  readonly originMs?: number;

  /**
   * Overrides the millisecond reader. Defaults to a high-resolution clock
   * when the host provides `performance.now`, otherwise Date.now.
   */
  readonly readMs?: ClockReadMs;

  /**
   * Optional nanosecond reader. Return `undefined` to signal the absence
   * of a dedicated hrtime source, in which case the clock derives
   * precision from the millisecond reader.
   */
  readonly readHrtime?: ClockReadHrtime;

  /**
   * Overrides the host environment used to resolve default monotonic sources.
   * Provide `null` to explicitly disable a source.
   */
  readonly environment?: ClockEnvironmentOverrides;
};

// =============================================================================
// Internal Helpers
// =============================================================================

const MS_TO_NS = 1_000_000n;

type OverrideKey = keyof ClockEnvironmentOverrides;

/**
 * Reads an override value, distinguishing between "not provided" and "provided as undefined/null".
 * Uses Object.hasOwn to detect explicit key presence.
 */
const readOverride = <Key extends OverrideKey>(
  overrides: ClockEnvironmentOverrides | undefined,
  key: Key
): ClockEnvironmentOverrides[Key] | undefined => {
  if (!overrides) {
    return undefined;
  }
  return Object.hasOwn(overrides, key) ? overrides[key] : undefined;
};

/**
 * Resolves the clock environment by merging overrides with host globals.
 * Precedence: override → globalThis → null (disabled)
 */
const resolveEnvironment = (overrides?: ClockEnvironmentOverrides): ClockEnvironment => {
  const globals = globalThis as {
    performance?: PerformanceLike;
    process?: ProcessLike;
  };

  const overridePerformance = readOverride(overrides, 'performance');
  const overrideProcess = readOverride(overrides, 'process');
  const overrideDateNow = readOverride(overrides, 'dateNow');

  const performance =
    overridePerformance !== undefined
      ? (overridePerformance ?? null)
      : (globals.performance ?? null);

  const process =
    overrideProcess !== undefined ? (overrideProcess ?? null) : (globals.process ?? null);

  const dateNow = typeof overrideDateNow === 'function' ? overrideDateNow : Date.now;

  return {
    performance,
    process,
    dateNow,
  };
};

/**
 * Reads high-resolution milliseconds from the best available source.
 * Prefers performance.now (microsecond precision) over Date.now (millisecond precision).
 */
const readHighResMs = (environment: ClockEnvironment): number => {
  const now = environment.performance?.now;
  if (typeof now === 'function') {
    return now.call(environment.performance);
  }
  return environment.dateNow();
};

/**
 * Detects and returns the best available hrtime source.
 * Returns undefined-returning function when no hrtime is available.
 */
const detectHrtimeSource = (environment: ClockEnvironment): ClockReadHrtime => {
  const hrtimeBigint = environment.process?.hrtime?.bigint;
  if (typeof hrtimeBigint === 'function') {
    return () => hrtimeBigint();
  }
  return () => undefined;
};

/**
 * Converts milliseconds to nanoseconds as bigint.
 * Throws for non-finite values.
 */
const msToNs = (value: number): bigint => {
  if (!Number.isFinite(value)) {
    throw new Error(`Cannot convert non-finite milliseconds value (${value}) to nanoseconds.`);
  }
  return BigInt(Math.round(value * Number(MS_TO_NS)));
};

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Creates a high-resolution monotonic clock.
 *
 * @param options - Optional configuration for clock behavior
 * @returns A Clock instance
 *
 * @example
 * ```typescript
 * // Default usage - uses host performance.now and process.hrtime
 * const clock = createSystemClock();
 * console.log(clock.now()); // monotonic ms since creation
 * console.log(clock.hrtime()); // nanoseconds
 * console.log(clock.wallClockMs()); // epoch ms for timestamps
 *
 * // Test usage - inject mock time source
 * let time = 0;
 * const mockClock = createSystemClock({
 *   readMs: () => time++,
 *   readHrtime: () => BigInt(time) * 1_000_000n,
 * });
 *
 * // Disable performance.now, force Date.now fallback
 * const simpleClock = createSystemClock({
 *   environment: { performance: null },
 * });
 * ```
 */
export function createSystemClock(options: ClockOptions = {}): Clock {
  const environment = resolveEnvironment(options.environment);

  const readMs = options.readMs ?? (() => readHighResMs(environment));
  const hrtimeSource = options.readHrtime ?? detectHrtimeSource(environment);

  const originMs = options.originMs ?? readMs();
  let last = 0;

  const now = (): number => {
    const raw = readMs() - originMs;
    if (raw < last) {
      // Guarantee monotonic non-decreasing clock even if underlying source regresses
      last += Number.EPSILON;
      return last;
    }
    last = raw;
    return raw;
  };

  const hrtime = (): bigint => {
    const native = hrtimeSource();
    if (typeof native === 'bigint') {
      return native;
    }
    return msToNs(now());
  };

  const wallClockMs = (): number => {
    return environment.dateNow();
  };

  return {
    now,
    hrtime,
    wallClockMs,
  };
}
