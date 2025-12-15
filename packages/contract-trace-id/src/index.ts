/**
 * @conveaux/contract-trace-id
 *
 * W3C Trace Context compliant ID generation contract.
 * Provides interfaces for generating trace and span IDs.
 *
 * Trace Context Specification:
 * - Trace ID: 16 bytes (128 bits) encoded as 32 lowercase hex characters
 * - Span ID: 8 bytes (64 bits) encoded as 16 lowercase hex characters
 * - IDs must not be all zeros (invalid per W3C spec)
 *
 * @see https://www.w3.org/TR/trace-context/
 */

/**
 * A valid W3C trace ID.
 *
 * - 16 bytes (128 bits) encoded as 32 lowercase hex characters
 * - Must not be all zeros (invalid per W3C spec)
 *
 * Branded type prevents accidental misuse (compile-time safety).
 *
 * @example
 * ```typescript
 * const traceId: TraceId = generator.traceId();
 * // '0af7651916cd43dd8448eb211c80319c'
 * ```
 */
export type TraceId = string & { readonly __brand: 'TraceId' };

/**
 * A valid W3C span ID.
 *
 * - 8 bytes (64 bits) encoded as 16 lowercase hex characters
 * - Must not be all zeros (invalid per W3C spec)
 *
 * Branded type prevents accidental misuse (compile-time safety).
 *
 * @example
 * ```typescript
 * const spanId: SpanId = generator.spanId();
 * // 'b7ad6b7169203331'
 * ```
 */
export type SpanId = string & { readonly __brand: 'SpanId' };

/**
 * ID generator for W3C Trace Context compliant distributed tracing.
 *
 * This abstraction enables:
 * - Deterministic testing with injectable random implementations
 * - Platform portability (Node.js, browsers, edge runtimes)
 * - Type-safe ID handling with branded types
 *
 * @example
 * ```typescript
 * const generator = createTraceIdGenerator();
 *
 * // Generate IDs for a new trace
 * const traceId = generator.traceId(); // '0af7651916cd43dd8448eb211c80319c'
 * const spanId = generator.spanId();   // 'b7ad6b7169203331'
 *
 * // Integration with instrumentation
 * const instrumenter = createInstrumenter({
 *   logger, clock,
 *   generateId: () => generator.spanId(),
 * });
 * ```
 */
export interface TraceIdGenerator {
  /**
   * Generate a new trace ID.
   *
   * Returns 32 lowercase hex characters (128 bits of entropy).
   * Guaranteed to be non-zero (valid per W3C Trace Context).
   *
   * Use this to correlate spans across service boundaries within a single trace.
   */
  traceId(): TraceId;

  /**
   * Generate a new span ID.
   *
   * Returns 16 lowercase hex characters (64 bits of entropy).
   * Guaranteed to be non-zero (valid per W3C Trace Context).
   *
   * Use this to identify individual operations within a trace.
   */
  spanId(): SpanId;
}
