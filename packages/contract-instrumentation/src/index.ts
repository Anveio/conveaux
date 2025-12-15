/**
 * @conveaux/contract-instrumentation
 *
 * Instrumentation contract - interfaces for function wrapping with
 * distributed tracing, timing metrics, and error capture.
 */

import type { LogContext } from '@conveaux/contract-logger';

// =============================================================================
// Core Types
// =============================================================================

/**
 * Status of a span execution.
 */
export type SpanStatus = 'running' | 'success' | 'error';

/**
 * Span represents a traced operation with timing and context.
 * Follows distributed tracing conventions (traceId, spanId, parentSpanId).
 */
export interface Span {
  /** Unique identifier for the entire trace (shared across related spans) */
  readonly traceId: string;
  /** Unique identifier for this specific span */
  readonly spanId: string;
  /** Parent span ID for nested operations */
  readonly parentSpanId?: string;
  /** Name of the operation being traced */
  readonly operation: string;
  /** ISO 8601 timestamp when the span started */
  readonly startedAt: string;
  /** ISO 8601 timestamp when the span ended (undefined while running) */
  readonly endedAt?: string;
  /** Duration in milliseconds (undefined while running) */
  readonly durationMs?: number;
  /** Current status of the span */
  readonly status: SpanStatus;
  /** Error that occurred during execution (only if status is 'error') */
  readonly error?: Error;
}

/**
 * Options for instrumenting a function.
 */
export interface InstrumentOptions {
  /**
   * Name of the operation (used in logs and traces).
   * If not provided, uses the function name or 'anonymous'.
   */
  readonly operation?: string;

  /**
   * Additional context to include in logs.
   */
  readonly context?: LogContext;

  /**
   * Parent span for creating nested traces.
   * If provided, the new span inherits the traceId and links to this parent.
   */
  readonly parentSpan?: Span;

  /**
   * Log level for successful operations.
   * @default 'debug'
   */
  readonly successLevel?: 'trace' | 'debug' | 'info';

  /**
   * Log level for failed operations.
   * @default 'error'
   */
  readonly failureLevel?: 'warn' | 'error' | 'fatal';

  /**
   * Whether to rethrow errors after logging.
   * @default true
   */
  readonly rethrow?: boolean;
}

// =============================================================================
// Instrumenter Interface
// =============================================================================

/**
 * Instrumenter wraps functions with tracing, timing, and error capture.
 *
 * @example
 * ```typescript
 * const instrumenter = createInstrumenter({ logger, clock });
 *
 * // Wrap a function for automatic instrumentation
 * const fetchUser = instrumenter.wrap(
 *   async (id: string) => db.users.find(id),
 *   { operation: 'fetchUser' }
 * );
 *
 * // Use normally - tracing happens automatically
 * const user = await fetchUser('123');
 *
 * // Nested spans
 * const processOrder = instrumenter.wrap(async (orderId: string) => {
 *   const parentSpan = instrumenter.getCurrentSpan();
 *   const validate = instrumenter.wrap(
 *     () => validateOrder(orderId),
 *     { operation: 'validate', parentSpan }
 *   );
 *   await validate();
 * }, { operation: 'processOrder' });
 * ```
 */
export interface Instrumenter {
  /**
   * Wrap a function with instrumentation.
   * Returns a new function with the same signature that automatically
   * logs timing, traces, and errors.
   *
   * @param fn - The function to wrap (sync or async)
   * @param options - Instrumentation options
   * @returns Wrapped function with identical signature
   */
  wrap<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn,
    options?: InstrumentOptions
  ): (...args: TArgs) => TReturn;

  /**
   * Execute a function once with instrumentation.
   * Convenience method for one-off operations.
   *
   * @param fn - The function to execute
   * @param options - Instrumentation options
   * @returns The function's return value
   */
  execute<T>(fn: () => T, options?: InstrumentOptions): T;

  /**
   * Execute an async function once with instrumentation.
   * Convenience method for one-off async operations.
   *
   * @param fn - The async function to execute
   * @param options - Instrumentation options
   * @returns Promise resolving to the function's return value
   */
  executeAsync<T>(fn: () => Promise<T>, options?: InstrumentOptions): Promise<T>;

  /**
   * Create a child instrumenter with bound context.
   * All operations from the child include the bound context.
   *
   * @param context - Context to bind to all operations
   * @returns Child instrumenter with bound context
   */
  child(context: LogContext): Instrumenter;

  /**
   * Start a new span manually.
   * Use this for fine-grained control over span lifecycle.
   *
   * @param operation - Name of the operation
   * @param parentSpan - Optional parent span for nesting
   * @returns A running span
   */
  startSpan(operation: string, parentSpan?: Span): Span;

  /**
   * End a span and record its completion.
   * Call this when the operation completes (successfully or with error).
   *
   * @param span - The span to end
   * @param error - Optional error if the operation failed
   * @returns The completed span with timing information
   */
  endSpan(span: Span, error?: Error): Span;

  /**
   * Get the current active span (if any).
   * Useful for creating nested spans within wrapped functions.
   *
   * @returns The current span or undefined if no span is active
   */
  getCurrentSpan(): Span | undefined;
}

// =============================================================================
// Extension Points
// =============================================================================

/**
 * Handler for span lifecycle events.
 * Implement this to send spans to a tracing backend (Jaeger, Zipkin, etc.).
 */
export interface SpanHandler {
  /**
   * Called when a span starts.
   * Implementation should be fast and non-throwing.
   */
  onSpanStart(span: Span): void;

  /**
   * Called when a span ends (success or error).
   * Implementation should be fast and non-throwing.
   */
  onSpanEnd(span: Span): void;
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Options for creating an instrumenter.
 */
export interface InstrumenterOptions {
  /**
   * Default log level for successful operations.
   * @default 'debug'
   */
  readonly defaultSuccessLevel?: 'trace' | 'debug' | 'info';

  /**
   * Default log level for failed operations.
   * @default 'error'
   */
  readonly defaultFailureLevel?: 'warn' | 'error' | 'fatal';

  /**
   * Base context applied to all operations.
   */
  readonly baseContext?: LogContext;
}
