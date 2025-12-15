/**
 * @conveaux/port-high-resolution-clock
 *
 * High-resolution monotonic clock implementation.
 * Follows the firedrill pattern for hermetic primitive ports.
 */

import type { HighResolutionClock } from '@conveaux/contract-high-resolution-clock';

// Re-export the contract type for convenience
export type { HighResolutionClock } from '@conveaux/contract-high-resolution-clock';

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
type HighResolutionClockEnvironment = {
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
export type HighResolutionClockEnvironmentOverrides = {
  readonly performance?: PerformanceLike | null;
  readonly process?: ProcessLike | null;
  readonly dateNow?: () => number;
};

// =============================================================================
// Options Types
// =============================================================================

type HighResolutionClockReadMs = () => number;
type HighResolutionClockReadHrtime = () => bigint | undefined;

/**
 * Options for creating a high-resolution clock.
 */
export type HighResolutionClockOptions = {
  /**
   * Seeds the starting point (in milliseconds). Useful for tests
   * where deterministic offsets are needed.
   */
  readonly originMs?: number;

  /**
   * Overrides the millisecond reader. Defaults to a high-resolution clock
   * when the host provides `performance.now`, otherwise Date.now.
   */
  readonly readMs?: HighResolutionClockReadMs;

  /**
   * Optional nanosecond reader. Return `undefined` to signal the absence
   * of a dedicated hrtime source, in which case the clock derives
   * precision from the millisecond reader.
   */
  readonly readHrtime?: HighResolutionClockReadHrtime;

  /**
   * Overrides the host environment used to resolve default monotonic sources.
   * Provide `null` to explicitly disable a source.
   */
  readonly environment?: HighResolutionClockEnvironmentOverrides;
};

// =============================================================================
// Internal Helpers
// =============================================================================

const MS_TO_NS = 1_000_000n;

type OverrideKey = keyof HighResolutionClockEnvironmentOverrides;

/**
 * Reads an override value, distinguishing between "not provided" and "provided as undefined/null".
 * Uses Object.hasOwn to detect explicit key presence.
 */
const readOverride = <Key extends OverrideKey>(
  overrides: HighResolutionClockEnvironmentOverrides | undefined,
  key: Key
): HighResolutionClockEnvironmentOverrides[Key] | undefined => {
  if (!overrides) {
    return undefined;
  }
  return Object.hasOwn(overrides, key) ? overrides[key] : undefined;
};

/**
 * Resolves the clock environment by merging overrides with host globals.
 * Precedence: override → globalThis → null (disabled)
 */
const resolveEnvironment = (
  overrides?: HighResolutionClockEnvironmentOverrides
): HighResolutionClockEnvironment => {
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
const readHighResMs = (environment: HighResolutionClockEnvironment): number => {
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
const detectHrtimeSource = (
  environment: HighResolutionClockEnvironment
): HighResolutionClockReadHrtime => {
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
 * @returns A HighResolutionClock instance
 *
 * @example
 * ```typescript
 * // Default usage - uses host performance.now and process.hrtime
 * const clock = createHighResolutionClock();
 * console.log(clock.now()); // monotonic ms since creation
 * console.log(clock.hrtime()); // nanoseconds
 * console.log(clock.wallClockMs()); // epoch ms for timestamps
 *
 * // Test usage - inject mock time source
 * let time = 0;
 * const mockClock = createHighResolutionClock({
 *   readMs: () => time++,
 *   readHrtime: () => BigInt(time) * 1_000_000n,
 * });
 *
 * // Disable performance.now, force Date.now fallback
 * const simpleClock = createHighResolutionClock({
 *   environment: { performance: null },
 * });
 * ```
 */
export function createHighResolutionClock(
  options: HighResolutionClockOptions = {}
): HighResolutionClock {
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

  const nowNs = (): bigint => {
    return msToNs(now());
  };

  const wallClockMs = (): number => {
    return environment.dateNow();
  };

  return {
    now,
    hrtime,
    nowNs,
    wallClockMs,
  };
}
