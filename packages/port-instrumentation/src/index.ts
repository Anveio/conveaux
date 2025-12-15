/**
 * @conveaux/port-instrumentation
 *
 * Instrumentation port - function wrapping with distributed tracing,
 * timing metrics, and error capture.
 */

import type { DateConstructor } from '@conveaux/contract-date';
import type { TraceIdGenerator } from '@conveaux/contract-id';
import type {
  InstrumentOptions,
  Instrumenter,
  InstrumenterOptions,
  Span,
  SpanHandler,
} from '@conveaux/contract-instrumentation';
import type { LogContext, Logger, TraceContext } from '@conveaux/contract-logger';
import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export all contract types for convenience
export type { DateConstructor } from '@conveaux/contract-date';
export type { TraceIdGenerator } from '@conveaux/contract-id';
export type {
  Instrumenter,
  InstrumentOptions,
  InstrumenterOptions,
  Span,
  SpanHandler,
  SpanStatus,
} from '@conveaux/contract-instrumentation';

// =============================================================================
// Dependencies
// =============================================================================

/**
 * Dependencies required by the instrumenter.
 */
export interface InstrumenterDependencies {
  /** Date constructor for timestamp formatting */
  readonly Date: DateConstructor;
  /** Logger for emitting instrumentation logs */
  readonly logger: Logger;
  /** Clock for timestamps */
  readonly clock: WallClock;
  /** ID generator for W3C Trace Context compliant trace/span IDs */
  readonly ids: TraceIdGenerator;
  /** Optional: Handler for span lifecycle events */
  readonly spanHandler?: SpanHandler;
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Creates an instrumenter for wrapping functions with tracing and logging.
 *
 * @param deps - Injected dependencies
 * @param options - Optional configuration
 * @returns An Instrumenter instance
 *
 * @example
 * ```typescript
 * import { createInstrumenter } from '@conveaux/port-instrumentation';
 * import { createLogger } from '@conveaux/port-logger';
 * import { createWallClock } from '@conveaux/port-wall-clock';
 * import { createOutChannel } from '@conveaux/port-outchannel';
 * import { createTraceIdGenerator } from '@conveaux/port-id';
 *
 * const clock = createWallClock();
 * const instrumenter = createInstrumenter({
 *   Date,
 *   logger: createLogger({
 *     channel: createOutChannel({ stream: process.stderr }),
 *     clock,
 *   }),
 *   clock,
 *   ids: createTraceIdGenerator(),
 * });
 *
 * // Wrap a function
 * const fetchUser = instrumenter.wrap(
 *   async (id: string) => db.users.find(id),
 *   { operation: 'fetchUser' }
 * );
 *
 * // Now fetchUser logs timing and errors automatically
 * const user = await fetchUser('123');
 * ```
 */
export function createInstrumenter(
  deps: InstrumenterDependencies,
  options?: InstrumenterOptions
): Instrumenter {
  const { Date: DateCtor, logger, clock, ids, spanHandler } = deps;
  const {
    defaultSuccessLevel = 'debug',
    defaultFailureLevel = 'error',
    baseContext = {},
  } = options ?? {};

  /**
   * Creates an instrumenter instance with optional bound context.
   * Used for both root instrumenter and child instrumenters.
   */
  const createInstrumenterWithContext = (boundContext: LogContext): Instrumenter => {
    // Track current span for getCurrentSpan()
    let currentSpan: Span | undefined;

    const mergedContext = { ...baseContext, ...boundContext };

    /**
     * Create a span object.
     */
    const createSpan = (operation: string, parentSpan?: Span): Span => {
      const spanId = ids.spanId();
      const traceId = parentSpan?.traceId ?? ids.traceId();
      const startedAt = new DateCtor(clock.nowMs()).toISOString();

      return {
        traceId,
        spanId,
        parentSpanId: parentSpan?.spanId,
        operation,
        startedAt,
        status: 'running',
      };
    };

    /**
     * Complete a span with success or error status.
     */
    const completeSpan = (span: Span, error?: Error): Span => {
      const endMs = clock.nowMs();
      const startMs = new DateCtor(span.startedAt).getTime();
      const durationMs = endMs - startMs;
      const endedAt = new DateCtor(endMs).toISOString();

      const completedSpan: Span = {
        ...span,
        endedAt,
        durationMs,
        status: error ? 'error' : 'success',
        ...(error ? { error } : {}),
      };

      return completedSpan;
    };

    /**
     * Build TraceContext from a Span for logging.
     */
    const spanToTraceContext = (span: Span): TraceContext => ({
      traceId: span.traceId,
      spanId: span.spanId,
      parentSpanId: span.parentSpanId,
      sampled: true,
    });

    /**
     * Log a completed span.
     */
    const logSpan = (span: Span, opts: InstrumentOptions): void => {
      const level =
        span.status === 'success'
          ? (opts.successLevel ?? defaultSuccessLevel)
          : (opts.failureLevel ?? defaultFailureLevel);

      const context: LogContext = {
        ...mergedContext,
        ...opts.context,
        operation: span.operation,
        durationMs: span.durationMs,
        success: span.status === 'success',
        trace: spanToTraceContext(span),
        ...(span.error ? { error: span.error } : {}),
      };

      const message =
        span.status === 'success' ? `${span.operation} completed` : `${span.operation} failed`;

      logger[level](message, context);
    };

    /**
     * Wrap implementation - core instrumentation logic.
     */
    const wrapImpl = <TArgs extends unknown[], TReturn>(
      fn: (...args: TArgs) => TReturn,
      opts: InstrumentOptions = {}
    ): ((...args: TArgs) => TReturn) => {
      const operation = opts.operation ?? (fn.name || 'anonymous');

      // Use regular function to preserve `this` binding
      return function instrumentedFn(this: unknown, ...args: TArgs): TReturn {
        const span = createSpan(operation, opts.parentSpan);
        const previousSpan = currentSpan;
        currentSpan = span;

        spanHandler?.onSpanStart(span);

        const finalize = (error?: Error): Span => {
          const completedSpan = completeSpan(span, error);
          currentSpan = previousSpan;
          logSpan(completedSpan, opts);
          spanHandler?.onSpanEnd(completedSpan);
          return completedSpan;
        };

        try {
          const result = fn.apply(this, args);

          // Handle async functions (Promise)
          if (result instanceof Promise) {
            return result.then(
              (value) => {
                finalize();
                return value;
              },
              (error: unknown) => {
                const err = error instanceof Error ? error : new Error(String(error));
                finalize(err);
                if (opts.rethrow !== false) {
                  throw error;
                }
                return undefined as Awaited<TReturn>;
              }
            ) as TReturn;
          }

          // Sync function success
          finalize();
          return result;
        } catch (error: unknown) {
          // Sync function failure
          const err = error instanceof Error ? error : new Error(String(error));
          finalize(err);
          if (opts.rethrow !== false) {
            throw error;
          }
          return undefined as TReturn;
        }
      };
    };

    return {
      wrap: wrapImpl,

      execute<T>(fn: () => T, opts?: InstrumentOptions): T {
        return wrapImpl(fn, opts)();
      },

      executeAsync<T>(fn: () => Promise<T>, opts?: InstrumentOptions): Promise<T> {
        return wrapImpl(fn, opts)();
      },

      child(context: LogContext): Instrumenter {
        return createInstrumenterWithContext({ ...mergedContext, ...context });
      },

      startSpan(operation: string, parentSpan?: Span): Span {
        const span = createSpan(operation, parentSpan);
        const previousSpan = currentSpan;
        currentSpan = span;
        spanHandler?.onSpanStart(span);

        // Store previous span for restoration on endSpan
        (span as { _previousSpan?: Span })._previousSpan = previousSpan;

        return span;
      },

      endSpan(span: Span, error?: Error): Span {
        const completedSpan = completeSpan(span, error);

        // Restore previous span
        const spanWithPrev = span as { _previousSpan?: Span };
        currentSpan = spanWithPrev._previousSpan;

        // Log the span
        logSpan(completedSpan, {});
        spanHandler?.onSpanEnd(completedSpan);

        return completedSpan;
      },

      getCurrentSpan(): Span | undefined {
        return currentSpan;
      },
    };
  };

  return createInstrumenterWithContext({});
}
