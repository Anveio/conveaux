/**
 * @conveaux/contract-control-flow
 *
 * Pure type definitions for control flow primitives.
 * This package contains NO runtime code - only types.
 *
 * Exit codes:
 * - 0: Success
 * - 1: Non-retryable system error
 * - 2: User/input/domain error
 * - 3: Retryable dependency error
 */

// =============================================================================
// Exit Codes
// =============================================================================

/**
 * Exit code type - union of valid exit codes.
 *
 * @remarks
 * - 0: Success
 * - 1: Non-retryable failure (system error, unknown error, non-retryable dependency)
 * - 2: User/input/domain error (validation, cardinality, unsupported operation)
 * - 3: Retryable dependency error (transient network, rate limit, AWS retryable)
 */
export type ExitCode = 0 | 1 | 2 | 3;

// =============================================================================
// Result Type
// =============================================================================

/**
 * Discriminated union for success case.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Discriminated union for error case.
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - explicit success/failure with type-safe error handling.
 *
 * @remarks
 * - Discriminated union using `ok` boolean
 * - Immutable (readonly properties)
 * - Error type E is generic - can be any type, not just Error
 * - Value type T is generic - supports any success type
 */
export type Result<T, E> = Ok<T> | Err<E>;

// =============================================================================
// Retry Metadata
// =============================================================================

/**
 * Backoff strategy for retry attempts.
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'constant';

/**
 * Retry metadata for retryable errors.
 * Provides hints to callers about how to retry.
 */
export interface RetryMetadata {
  /** Suggested maximum retry attempts */
  readonly maxRetries: number;

  /** Initial delay in milliseconds before first retry */
  readonly initialDelayMs: number;

  /** Maximum delay in milliseconds (caps exponential backoff) */
  readonly maxDelayMs: number;

  /** Backoff strategy to use */
  readonly backoff: BackoffStrategy;

  /** Jitter factor (0-1) to add randomness to delays */
  readonly jitterFactor: number;

  /** Optional: When to retry - timestamp in ms (from Retry-After header) */
  readonly retryAfterMs?: number;
}

// =============================================================================
// Error Contract
// =============================================================================

/**
 * Symbol key for exit code on errors.
 * Declared as unique symbol type for type safety.
 */
export declare const EXIT_CODE: unique symbol;

/**
 * Interface for errors with intrinsic exit codes.
 * Used for type narrowing and CLI boundary handling.
 */
export interface ExitCodeError {
  readonly [EXIT_CODE]: ExitCode;
  readonly name: string;
  readonly message: string;
}
