/**
 * @conveaux/contract-error
 *
 * Base error classes for domain errors.
 * Provides a hierarchy of typed errors for better error handling.
 */

/**
 * Base error class for all conveaux domain errors.
 * Extends Error with proper prototype chain for instanceof checks.
 */
export class ConveauxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConveauxError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when a URL is invalid or unsupported.
 */
export class InvalidURLError extends ConveauxError {
  readonly url: string;

  constructor(url: string, message?: string) {
    super(message ?? `Invalid URL: ${url}`);
    this.name = 'InvalidURLError';
    this.url = url;
  }
}

/**
 * Error thrown when an HTTP fetch operation fails.
 */
export class FetchError extends ConveauxError {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'FetchError';
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when parsing fails (HTML, JSON, etc.).
 */
export class ParseError extends ConveauxError {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}
