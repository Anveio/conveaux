/**
 * @conveaux/port-control-flow
 *
 * Runtime implementations for control flow primitives:
 * - Error classes with intrinsic exit codes
 * - Result type constructors and utilities
 * - Retry delay computation
 *
 * This port provides all runtime behavior; the contract provides only types.
 */

import type {
  BackoffStrategy,
  Err,
  ExitCode,
  ExitCodeError,
  ExitCodeSymbol,
  Ok,
  Result,
  RetryMetadata,
} from '@conveaux/contract-control-flow';

// Re-export types from contract
export type {
  BackoffStrategy,
  Err,
  ExitCode,
  ExitCodeError,
  ExitCodeSymbol,
  Ok,
  Result,
  RetryMetadata,
};

// =============================================================================
// Exit Code Constants
// =============================================================================

/** Exit code 0: Success */
export const EXIT_SUCCESS = 0 as const;

/** Exit code 1: Non-retryable system/unknown error */
export const EXIT_SYSTEM_ERROR = 1 as const;

/** Exit code 2: User/input/domain error */
export const EXIT_USER_ERROR = 2 as const;

/** Exit code 3: Retryable dependency error */
export const EXIT_RETRYABLE = 3 as const;

// =============================================================================
// Exit Code Symbol
// =============================================================================

/**
 * Symbol for exit code - prevents accidental property collision.
 */
export const EXIT_CODE: ExitCodeSymbol = Symbol.for('conveaux.exitCode') as ExitCodeSymbol;

// =============================================================================
// Result Constructors
// =============================================================================

/**
 * Create a success Result.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create an error Result.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// =============================================================================
// Result Type Guards
// =============================================================================

/**
 * Type guard for success case.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Type guard for error case.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

// =============================================================================
// Result Transformations
// =============================================================================

/**
 * Transform the success value, leaving errors unchanged.
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Transform the error, leaving success unchanged.
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (!result.ok) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * Chain Results - flatMap/bind operation.
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Chain Results with potentially different error types.
 */
export function flatMapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  if (!result.ok) {
    return fn(result.error);
  }
  return result as unknown as Result<T, F>;
}

// =============================================================================
// Result Pattern Matching
// =============================================================================

/**
 * Pattern match on Result - exhaustive handling of both cases.
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  if (result.ok) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}

// =============================================================================
// Result Unwrapping
// =============================================================================

/**
 * Get the value or throw the error.
 * Use sparingly - prefer pattern matching for explicit error handling.
 */
export function unwrap<T, E extends Error>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Get the value or return a default.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.ok) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Get the value or compute a default from the error.
 */
export function unwrapOrElse<T, E>(result: Result<T, E>, fn: (error: E) => T): T {
  if (result.ok) {
    return result.value;
  }
  return fn(result.error);
}

// =============================================================================
// Result Combining
// =============================================================================

/**
 * Combine multiple Results - all must succeed.
 * Returns array of values or first error.
 */
export function all<T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
}

/**
 * Type-safe tuple version of all.
 */
export function allTuple<T extends readonly Result<unknown, unknown>[]>(
  results: [...T]
): Result<
  { [K in keyof T]: T[K] extends Result<infer V, unknown> ? V : never },
  T[number] extends Result<unknown, infer E> ? E : never
> {
  return all(results) as Result<
    { [K in keyof T]: T[K] extends Result<infer V, unknown> ? V : never },
    T[number] extends Result<unknown, infer E> ? E : never
  >;
}

// =============================================================================
// Result Async Support
// =============================================================================

/**
 * Wrap a Promise that may reject into a Result.
 */
export async function fromPromise<T, E = Error>(
  promise: Promise<T>,
  mapError?: (error: unknown) => E
): Promise<Result<T, E>> {
  try {
    const value = await promise;
    return ok(value);
  } catch (error) {
    if (mapError) {
      return err(mapError(error));
    }
    return err(error as E);
  }
}

/**
 * Wrap a sync function that may throw into a Result.
 */
export function fromThrowable<T, E = Error>(
  fn: () => T,
  mapError?: (error: unknown) => E
): Result<T, E> {
  try {
    return ok(fn());
  } catch (error) {
    if (mapError) {
      return err(mapError(error));
    }
    return err(error as E);
  }
}

// =============================================================================
// Retry Utilities
// =============================================================================

/**
 * Default retry metadata for transient errors.
 */
export const DEFAULT_RETRY_METADATA: RetryMetadata = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoff: 'exponential',
  jitterFactor: 0.1,
};

/**
 * Dependencies for computing retry delay with jitter.
 */
export interface ComputeRetryDelayDeps {
  /** Random number generator (0-1), defaults to Math.random */
  readonly random?: () => number;
}

/**
 * Compute delay for a given retry attempt.
 *
 * @param metadata - Retry configuration
 * @param attempt - Zero-indexed attempt number (0 = first retry)
 * @param deps - Optional dependencies for testing
 * @returns Delay in milliseconds
 */
export function computeRetryDelay(
  metadata: RetryMetadata,
  attempt: number,
  deps: ComputeRetryDelayDeps = {}
): number {
  const random = deps.random ?? Math.random;

  let delay: number;

  switch (metadata.backoff) {
    case 'exponential':
      delay = metadata.initialDelayMs * 2 ** attempt;
      break;
    case 'linear':
      delay = metadata.initialDelayMs * (attempt + 1);
      break;
    case 'constant':
      delay = metadata.initialDelayMs;
      break;
  }

  // Apply cap
  delay = Math.min(delay, metadata.maxDelayMs);

  // Apply jitter: random value between -jitterFactor and +jitterFactor
  const jitter = delay * metadata.jitterFactor * (random() * 2 - 1);
  delay = Math.max(0, delay + jitter);

  return Math.round(delay);
}

// =============================================================================
// Error Type Guard
// =============================================================================

/**
 * Type guard to check if an error has an intrinsic exit code.
 */
export function isExitCodeError(error: unknown): error is ExitCodeError {
  return (
    error !== null &&
    typeof error === 'object' &&
    EXIT_CODE in error &&
    typeof (error as Record<symbol, unknown>)[EXIT_CODE] === 'number'
  );
}

// =============================================================================
// Base Error Class
// =============================================================================

/**
 * Base error class for all conveaux errors with intrinsic exit codes.
 *
 * @remarks
 * - Uses Symbol for exitCode to prevent collision with user properties
 * - Abstract class prevents instantiation - force use of specific subclasses
 * - Proper prototype chain for instanceof checks
 */
export abstract class ConveauxError extends Error implements ExitCodeError {
  abstract readonly [EXIT_CODE]: ExitCode;

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convenience getter for exit code (avoids symbol lookup at call sites).
   */
  get exitCode(): ExitCode {
    return this[EXIT_CODE];
  }
}

// =============================================================================
// Exit Code 1: System/Unknown Errors (Non-Retryable)
// =============================================================================

/**
 * Exit code 1: Non-retryable system/unknown errors.
 *
 * Use for:
 * - Unexpected runtime errors
 * - System failures (disk full, memory exhaustion)
 * - Non-retryable dependency failures
 * - Programming errors that shouldn't happen
 */
export abstract class SystemError extends ConveauxError {
  readonly [EXIT_CODE] = 1 as const;
}

/**
 * Unknown/unexpected error - wraps any non-ConveauxError.
 */
export class UnknownError extends SystemError {
  readonly originalError: unknown;

  constructor(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error ? error : undefined;
    super(`Unexpected error: ${message}`, cause ? { cause } : undefined);
    this.originalError = error;
  }
}

/**
 * Internal assertion failure - should never happen in production.
 */
export class AssertionError extends SystemError {
  constructor(message: string) {
    super(`Assertion failed: ${message}`);
  }
}

/**
 * Non-retryable dependency failure (e.g., AWS configuration error).
 */
export class DependencyError extends SystemError {
  readonly service: string;

  constructor(service: string, message: string, options?: ErrorOptions) {
    super(`${service}: ${message}`, options);
    this.service = service;
  }
}

// =============================================================================
// Exit Code 2: User/Input/Domain Errors
// =============================================================================

/**
 * Exit code 2: User/input/domain errors.
 *
 * Use for:
 * - Invalid user input
 * - Validation failures
 * - Unsupported operations
 * - Domain rule violations
 */
export abstract class UserError extends ConveauxError {
  readonly [EXIT_CODE] = 2 as const;
}

/**
 * Input validation error with structured field information.
 */
export class ValidationError extends UserError {
  readonly field?: string;
  readonly constraint: string;

  constructor(options: { message: string; field?: string; constraint: string }) {
    super(options.message);
    this.field = options.field;
    this.constraint = options.constraint;
  }
}

/**
 * Invalid URL error.
 */
export class InvalidURLError extends UserError {
  readonly url: string;

  constructor(url: string, message?: string) {
    super(message ?? `Invalid URL: ${url}`);
    this.url = url;
  }
}

/**
 * Parse error for invalid data formats.
 */
export class ParseError extends UserError {
  readonly format?: string;

  constructor(message: string, format?: string) {
    super(message);
    this.format = format;
  }
}

/**
 * Cardinality error - wrong number of items.
 */
export class CardinalityError extends UserError {
  readonly expected: string;
  readonly actual: number;

  constructor(options: { message: string; expected: string; actual: number }) {
    super(options.message);
    this.expected = options.expected;
    this.actual = options.actual;
  }
}

/**
 * Resource not found error (HTTP 404) - NOT retryable.
 * This is a user error because the resource doesn't exist.
 */
export class NotFoundError extends UserError {
  readonly resource: string;

  constructor(resource: string, message?: string) {
    super(message ?? `Not found: ${resource}`);
    this.resource = resource;
  }
}

/**
 * Unsupported operation error.
 */
export class UnsupportedError extends UserError {
  readonly operation: string;
  readonly reason?: string;

  constructor(operation: string, reason?: string) {
    const message = reason
      ? `Unsupported operation '${operation}': ${reason}`
      : `Unsupported operation: ${operation}`;
    super(message);
    this.operation = operation;
    this.reason = reason;
  }
}

// =============================================================================
// Exit Code 3: Retryable Errors
// =============================================================================

/**
 * Exit code 3: Retryable dependency errors.
 *
 * Use for:
 * - Transient network failures
 * - Rate limiting (429)
 * - Temporary service unavailability
 * - AWS retryable errors
 */
export abstract class RetryableError extends ConveauxError {
  readonly [EXIT_CODE] = 3 as const;

  /** Retry metadata with hints for retry logic */
  abstract readonly retry: RetryMetadata;
}

/**
 * Network fetch error with retry support.
 */
export class FetchError extends RetryableError {
  readonly statusCode?: number;
  readonly retry: RetryMetadata;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      retry?: Partial<RetryMetadata>;
      cause?: Error;
    }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.statusCode = options?.statusCode;
    this.retry = { ...DEFAULT_RETRY_METADATA, ...options?.retry };
  }

  /**
   * Create a FetchError for rate limiting (429).
   * @param retryAfterMs - Optional timestamp in ms when to retry
   */
  static rateLimited(retryAfterMs?: number): FetchError {
    return new FetchError('Rate limited', {
      statusCode: 429,
      retry: {
        ...DEFAULT_RETRY_METADATA,
        retryAfterMs,
      },
    });
  }

  /**
   * Create a FetchError for timeout.
   */
  static timeout(timeoutMs: number): FetchError {
    return new FetchError(`Request timed out after ${timeoutMs}ms`, {
      retry: DEFAULT_RETRY_METADATA,
    });
  }
}

/**
 * AWS-specific retryable error.
 */
export class AWSRetryableError extends RetryableError {
  readonly service: string;
  readonly code: string;
  readonly retry: RetryMetadata;

  constructor(options: {
    service: string;
    code: string;
    message: string;
    retry?: Partial<RetryMetadata>;
    cause?: Error;
  }) {
    super(`${options.service} [${options.code}]: ${options.message}`, {
      cause: options.cause,
    });
    this.service = options.service;
    this.code = options.code;
    this.retry = { ...DEFAULT_RETRY_METADATA, ...options.retry };
  }
}

/**
 * Transient error - generic retryable for temporary failures.
 */
export class TransientError extends RetryableError {
  readonly retry: RetryMetadata;

  constructor(message: string, retry?: Partial<RetryMetadata>) {
    super(message);
    this.retry = { ...DEFAULT_RETRY_METADATA, ...retry };
  }
}

// =============================================================================
// Guards and Utilities
// =============================================================================

/**
 * Get exit code from any error.
 * - ExitCodeError: use intrinsic exit code
 * - Other errors: exit code 1 (system error)
 */
export function getExitCode(error: unknown): ExitCode {
  if (isExitCodeError(error)) {
    return error[EXIT_CODE];
  }
  return EXIT_SYSTEM_ERROR;
}

/**
 * Normalize any error to ExitCodeError.
 * Wraps non-ConveauxError in UnknownError.
 */
export function normalizeError(error: unknown): ExitCodeError {
  if (isExitCodeError(error)) {
    return error;
  }
  return new UnknownError(error);
}

/**
 * Convert a Result to an exit code.
 * Success = 0, Error = intrinsic exit code.
 */
export function resultToExitCode<T, E>(result: Result<T, E>): ExitCode {
  if (result.ok) {
    return EXIT_SUCCESS;
  }
  return getExitCode(result.error);
}
