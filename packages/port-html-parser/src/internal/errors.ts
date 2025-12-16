/**
 * Error utilities for HTML parser port.
 */

import type {
  HtmlParseError,
  HtmlParseErrorCode,
  NotImplementedError,
} from '@conveaux/contract-html-parser';

/**
 * HTML parse error implementation.
 * Thrown for catastrophic failures, not normal parse warnings.
 */
class HtmlParseErrorImpl extends Error implements HtmlParseError {
  readonly name = 'HtmlParseError' as const;
  readonly code: HtmlParseErrorCode;

  constructor(code: HtmlParseErrorCode, message: string) {
    super(message);
    this.code = code;
    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HtmlParseErrorImpl);
    }
  }
}

/**
 * Not implemented error implementation.
 * Thrown when a method is called that hasn't been implemented yet.
 */
class NotImplementedErrorImpl extends Error implements NotImplementedError {
  readonly name = 'NotImplementedError' as const;
  readonly method: string;

  constructor(method: string) {
    super(`Method '${method}' is not implemented in this version of the HTML parser`);
    this.method = method;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotImplementedErrorImpl);
    }
  }
}

/**
 * Create an HtmlParseError.
 */
export function createParseError(code: HtmlParseErrorCode, message: string): HtmlParseError {
  return new HtmlParseErrorImpl(code, message);
}

/**
 * Create a NotImplementedError.
 */
export function createNotImplementedError(method: string): NotImplementedError {
  return new NotImplementedErrorImpl(method);
}

/**
 * Throw a NotImplementedError for a method.
 * Use as a placeholder for methods that will be implemented later.
 */
export function notImplemented(method: string): never {
  throw createNotImplementedError(method);
}
