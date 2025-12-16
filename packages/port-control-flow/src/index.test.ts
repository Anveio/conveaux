import { describe, expect, it } from 'vitest';
import {
  AWSRetryableError,
  AssertionError,
  CardinalityError,
  DEFAULT_RETRY_METADATA,
  DependencyError,
  EXIT_CODE,
  EXIT_RETRYABLE,
  // Constants
  EXIT_SUCCESS,
  EXIT_SYSTEM_ERROR,
  EXIT_USER_ERROR,
  FetchError,
  InvalidURLError,
  NotFoundError,
  ParseError,
  TransientError,
  UnknownError,
  UnsupportedError,
  ValidationError,
  // Result combining
  all,
  allTuple,
  // Retry
  computeRetryDelay,
  err,
  flatMap,
  flatMapErr,
  // Result async
  fromPromise,
  fromThrowable,
  // Guards
  getExitCode,
  isErr,
  // Error guard
  isExitCodeError,
  // Result guards
  isOk,
  // Result transformations
  map,
  mapErr,
  match,
  normalizeError,
  // Result constructors
  ok,
  resultToExitCode,
  // Result unwrapping
  unwrap,
  unwrapOr,
  unwrapOrElse,
} from './index.js';

// =============================================================================
// Exit Code Constants
// =============================================================================

describe('Exit Code Constants', () => {
  it('exports correct exit code values', () => {
    expect(EXIT_SUCCESS).toBe(0);
    expect(EXIT_SYSTEM_ERROR).toBe(1);
    expect(EXIT_USER_ERROR).toBe(2);
    expect(EXIT_RETRYABLE).toBe(3);
  });

  it('EXIT_CODE is a symbol', () => {
    expect(typeof EXIT_CODE).toBe('symbol');
    expect(EXIT_CODE.toString()).toBe('Symbol(conveaux.exitCode)');
  });
});

// =============================================================================
// Result Constructors and Guards
// =============================================================================

describe('Result', () => {
  describe('ok/err constructors', () => {
    it('creates success result', () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      expect(result.value).toBe(42);
    });

    it('creates error result', () => {
      const error = new Error('test');
      const result = err(error);
      expect(result.ok).toBe(false);
      expect(result.error).toBe(error);
    });
  });

  describe('isOk/isErr guards', () => {
    it('isOk returns true for success', () => {
      expect(isOk(ok(42))).toBe(true);
      expect(isOk(err('error'))).toBe(false);
    });

    it('isErr returns true for error', () => {
      expect(isErr(err('error'))).toBe(true);
      expect(isErr(ok(42))).toBe(false);
    });
  });

  describe('map', () => {
    it('transforms success value', () => {
      const result = map(ok(5), (x) => x * 2);
      expect(result).toEqual(ok(10));
    });

    it('passes through error unchanged', () => {
      const error = err('error');
      const result = map(error, (x: number) => x * 2);
      expect(result).toBe(error);
    });
  });

  describe('mapErr', () => {
    it('transforms error value', () => {
      const result = mapErr(err('oops'), (e) => new Error(e));
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toBe('oops');
      }
    });

    it('passes through success unchanged', () => {
      const success = ok(42);
      const result = mapErr(success, (e: string) => new Error(e));
      expect(result).toBe(success);
    });
  });

  describe('flatMap', () => {
    it('chains successful results', () => {
      const result = flatMap(ok(5), (x) => ok(x * 2));
      expect(result).toEqual(ok(10));
    });

    it('short-circuits on error', () => {
      const error = err('error');
      const result = flatMap(error, (x: number) => ok(x * 2));
      expect(result).toBe(error);
    });
  });

  describe('flatMapErr', () => {
    it('chains error recovery', () => {
      const result = flatMapErr(err('error'), () => ok(42));
      expect(result).toEqual(ok(42));
    });

    it('passes through success', () => {
      const success = ok(42);
      const result = flatMapErr(success, () => ok(0));
      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });
  });

  describe('match', () => {
    it('calls ok handler on success', () => {
      const result = match(ok(42), {
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(result).toBe('value: 42');
    });

    it('calls err handler on error', () => {
      const result = match(err('oops'), {
        ok: (v) => `value: ${v}`,
        err: (e) => `error: ${e}`,
      });
      expect(result).toBe('error: oops');
    });
  });

  describe('unwrap', () => {
    it('returns value on success', () => {
      expect(unwrap(ok(42))).toBe(42);
    });

    it('throws on error', () => {
      const error = new Error('test');
      expect(() => unwrap(err(error))).toThrow(error);
    });
  });

  describe('unwrapOr', () => {
    it('returns value on success', () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it('returns default on error', () => {
      expect(unwrapOr(err('error'), 0)).toBe(0);
    });
  });

  describe('unwrapOrElse', () => {
    it('returns value on success', () => {
      expect(unwrapOrElse(ok(42), () => 0)).toBe(42);
    });

    it('computes default from error', () => {
      expect(unwrapOrElse(err('test'), (e) => e.length)).toBe(4);
    });
  });

  describe('all', () => {
    it('combines all success results', () => {
      const results = [ok(1), ok(2), ok(3)];
      expect(all(results)).toEqual(ok([1, 2, 3]));
    });

    it('returns first error', () => {
      const error = err('error');
      const results = [ok(1), error, ok(3)];
      expect(all(results)).toBe(error);
    });
  });

  describe('allTuple', () => {
    it('preserves tuple types', () => {
      const result = allTuple([ok(1), ok('two'), ok(true)] as const);
      expect(isOk(result)).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([1, 'two', true]);
      }
    });
  });

  describe('fromPromise', () => {
    it('wraps resolved promise', async () => {
      const result = await fromPromise(Promise.resolve(42));
      expect(result).toEqual(ok(42));
    });

    it('wraps rejected promise', async () => {
      const error = new Error('test');
      const result = await fromPromise(Promise.reject(error));
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('uses mapError function', async () => {
      const result = await fromPromise(Promise.reject('string error'), (e) => new Error(String(e)));
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });

  describe('fromThrowable', () => {
    it('wraps successful function', () => {
      const result = fromThrowable(() => 42);
      expect(result).toEqual(ok(42));
    });

    it('wraps throwing function', () => {
      const error = new Error('test');
      const result = fromThrowable(() => {
        throw error;
      });
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBe(error);
      }
    });

    it('uses mapError function', () => {
      const result = fromThrowable(
        () => {
          throw 'string error';
        },
        (e) => new Error(String(e))
      );
      expect(isErr(result)).toBe(true);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });
  });
});

// =============================================================================
// Retry Utilities
// =============================================================================

describe('Retry', () => {
  describe('DEFAULT_RETRY_METADATA', () => {
    it('has sensible defaults', () => {
      expect(DEFAULT_RETRY_METADATA.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_METADATA.initialDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_METADATA.maxDelayMs).toBe(30000);
      expect(DEFAULT_RETRY_METADATA.backoff).toBe('exponential');
      expect(DEFAULT_RETRY_METADATA.jitterFactor).toBe(0.1);
    });
  });

  describe('computeRetryDelay', () => {
    const noJitter = { random: () => 0.5 }; // Results in 0 jitter

    it('computes exponential backoff', () => {
      const metadata = { ...DEFAULT_RETRY_METADATA, jitterFactor: 0 };
      expect(computeRetryDelay(metadata, 0, noJitter)).toBe(1000);
      expect(computeRetryDelay(metadata, 1, noJitter)).toBe(2000);
      expect(computeRetryDelay(metadata, 2, noJitter)).toBe(4000);
    });

    it('computes linear backoff', () => {
      const metadata = { ...DEFAULT_RETRY_METADATA, backoff: 'linear' as const, jitterFactor: 0 };
      expect(computeRetryDelay(metadata, 0, noJitter)).toBe(1000);
      expect(computeRetryDelay(metadata, 1, noJitter)).toBe(2000);
      expect(computeRetryDelay(metadata, 2, noJitter)).toBe(3000);
    });

    it('computes constant backoff', () => {
      const metadata = { ...DEFAULT_RETRY_METADATA, backoff: 'constant' as const, jitterFactor: 0 };
      expect(computeRetryDelay(metadata, 0, noJitter)).toBe(1000);
      expect(computeRetryDelay(metadata, 1, noJitter)).toBe(1000);
      expect(computeRetryDelay(metadata, 2, noJitter)).toBe(1000);
    });

    it('caps at maxDelayMs', () => {
      const metadata = { ...DEFAULT_RETRY_METADATA, maxDelayMs: 5000, jitterFactor: 0 };
      expect(computeRetryDelay(metadata, 10, noJitter)).toBe(5000);
    });

    it('applies jitter', () => {
      const metadata = { ...DEFAULT_RETRY_METADATA, jitterFactor: 0.1 };
      // With random = 0, jitter = delay * 0.1 * (0 * 2 - 1) = -0.1 * delay
      const withMinJitter = computeRetryDelay(metadata, 0, { random: () => 0 });
      expect(withMinJitter).toBe(900); // 1000 - 100

      // With random = 1, jitter = delay * 0.1 * (1 * 2 - 1) = 0.1 * delay
      const withMaxJitter = computeRetryDelay(metadata, 0, { random: () => 1 });
      expect(withMaxJitter).toBe(1100); // 1000 + 100
    });

    it('never returns negative delay', () => {
      const metadata = { ...DEFAULT_RETRY_METADATA, jitterFactor: 2 }; // Extreme jitter
      const delay = computeRetryDelay(metadata, 0, { random: () => 0 });
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});

// =============================================================================
// Error Classes
// =============================================================================

describe('Error Classes', () => {
  describe('isExitCodeError', () => {
    it('returns true for ConveauxError subclasses', () => {
      expect(isExitCodeError(new UnknownError('test'))).toBe(true);
      expect(isExitCodeError(new AssertionError('test'))).toBe(true);
      expect(
        isExitCodeError(new ValidationError({ message: 'test', constraint: 'required' }))
      ).toBe(true);
      expect(isExitCodeError(new FetchError('test'))).toBe(true);
    });

    it('returns false for regular errors', () => {
      expect(isExitCodeError(new Error('test'))).toBe(false);
      expect(isExitCodeError(null)).toBe(false);
      expect(isExitCodeError(undefined)).toBe(false);
      expect(isExitCodeError('string')).toBe(false);
    });
  });

  describe('SystemError (exit code 1)', () => {
    it('UnknownError wraps unknown errors', () => {
      const original = new Error('original');
      const error = new UnknownError(original);
      expect(error.exitCode).toBe(1);
      expect(error[EXIT_CODE]).toBe(1);
      expect(error.originalError).toBe(original);
      expect(error.message).toContain('original');
      expect(error.cause).toBe(original);
    });

    it('UnknownError handles non-Error values', () => {
      const error = new UnknownError('string error');
      expect(error.message).toContain('string error');
      expect(error.originalError).toBe('string error');
    });

    it('AssertionError has correct message', () => {
      const error = new AssertionError('x > 0');
      expect(error.exitCode).toBe(1);
      expect(error.message).toBe('Assertion failed: x > 0');
    });

    it('DependencyError includes service name', () => {
      const error = new DependencyError('S3', 'bucket not found');
      expect(error.exitCode).toBe(1);
      expect(error.service).toBe('S3');
      expect(error.message).toBe('S3: bucket not found');
    });
  });

  describe('UserError (exit code 2)', () => {
    it('ValidationError includes field and constraint', () => {
      const error = new ValidationError({
        message: 'Invalid email',
        field: 'email',
        constraint: 'email format',
      });
      expect(error.exitCode).toBe(2);
      expect(error.field).toBe('email');
      expect(error.constraint).toBe('email format');
    });

    it('InvalidURLError includes URL', () => {
      const error = new InvalidURLError('not-a-url');
      expect(error.exitCode).toBe(2);
      expect(error.url).toBe('not-a-url');
      expect(error.message).toBe('Invalid URL: not-a-url');
    });

    it('ParseError includes format', () => {
      const error = new ParseError('Invalid JSON', 'json');
      expect(error.exitCode).toBe(2);
      expect(error.format).toBe('json');
    });

    it('CardinalityError includes expected and actual', () => {
      const error = new CardinalityError({
        message: 'Too many items',
        expected: '1-5',
        actual: 10,
      });
      expect(error.exitCode).toBe(2);
      expect(error.expected).toBe('1-5');
      expect(error.actual).toBe(10);
    });

    it('NotFoundError includes resource', () => {
      const error = new NotFoundError('user/123');
      expect(error.exitCode).toBe(2);
      expect(error.resource).toBe('user/123');
      expect(error.message).toBe('Not found: user/123');
    });

    it('UnsupportedError includes operation and reason', () => {
      const error = new UnsupportedError('DELETE', 'read-only mode');
      expect(error.exitCode).toBe(2);
      expect(error.operation).toBe('DELETE');
      expect(error.reason).toBe('read-only mode');
    });
  });

  describe('RetryableError (exit code 3)', () => {
    it('FetchError includes statusCode and retry metadata', () => {
      const error = new FetchError('Connection refused', {
        statusCode: 503,
        retry: { maxRetries: 5 },
      });
      expect(error.exitCode).toBe(3);
      expect(error.statusCode).toBe(503);
      expect(error.retry.maxRetries).toBe(5);
      expect(error.retry.initialDelayMs).toBe(DEFAULT_RETRY_METADATA.initialDelayMs);
    });

    it('FetchError.rateLimited creates 429 error', () => {
      const error = FetchError.rateLimited(1000);
      expect(error.statusCode).toBe(429);
      expect(error.retry.retryAfterMs).toBe(1000);
    });

    it('FetchError.timeout creates timeout error', () => {
      const error = FetchError.timeout(5000);
      expect(error.message).toContain('5000ms');
    });

    it('AWSRetryableError includes service and code', () => {
      const error = new AWSRetryableError({
        service: 'DynamoDB',
        code: 'ProvisionedThroughputExceededException',
        message: 'Rate exceeded',
      });
      expect(error.exitCode).toBe(3);
      expect(error.service).toBe('DynamoDB');
      expect(error.code).toBe('ProvisionedThroughputExceededException');
    });

    it('TransientError is generic retryable', () => {
      const error = new TransientError('Temporary failure');
      expect(error.exitCode).toBe(3);
      expect(error.retry).toEqual(DEFAULT_RETRY_METADATA);
    });
  });
});

// =============================================================================
// Guards and Utilities
// =============================================================================

describe('Guards and Utilities', () => {
  describe('getExitCode', () => {
    it('returns exit code from ExitCodeError', () => {
      expect(getExitCode(new UnknownError('test'))).toBe(1);
      expect(getExitCode(new ValidationError({ message: 'test', constraint: 'x' }))).toBe(2);
      expect(getExitCode(new FetchError('test'))).toBe(3);
    });

    it('returns 1 for non-ExitCodeError', () => {
      expect(getExitCode(new Error('test'))).toBe(1);
      expect(getExitCode('string')).toBe(1);
      expect(getExitCode(null)).toBe(1);
    });
  });

  describe('normalizeError', () => {
    it('returns ExitCodeError as-is', () => {
      const error = new FetchError('test');
      expect(normalizeError(error)).toBe(error);
    });

    it('wraps non-ExitCodeError in UnknownError', () => {
      const original = new Error('test');
      const normalized = normalizeError(original);
      expect(normalized).toBeInstanceOf(UnknownError);
      expect((normalized as UnknownError).originalError).toBe(original);
    });
  });

  describe('resultToExitCode', () => {
    it('returns 0 for success', () => {
      expect(resultToExitCode(ok(42))).toBe(0);
    });

    it('returns error exit code', () => {
      expect(resultToExitCode(err(new UnknownError('test')))).toBe(1);
      expect(resultToExitCode(err(new ValidationError({ message: 't', constraint: 'x' })))).toBe(2);
      expect(resultToExitCode(err(new FetchError('test')))).toBe(3);
    });

    it('returns 1 for non-ExitCodeError', () => {
      expect(resultToExitCode(err(new Error('test')))).toBe(1);
    });
  });
});
