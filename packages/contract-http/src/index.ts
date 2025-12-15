/**
 * @conveaux/contract-http
 *
 * HTTP contract - type alias for native fetch.
 * Use globalThis.fetch at runtime (Node 18+, browsers).
 */

/**
 * Type alias for the native fetch function.
 * Inject globalThis.fetch to satisfy this dependency.
 */
export type HttpFetch = typeof fetch;

/**
 * Options for HTTP fetch operations.
 * Subset of RequestInit focused on common use cases.
 */
export interface FetchOptions {
  /** Request timeout in milliseconds */
  readonly timeout?: number;
  /** Additional headers to include */
  readonly headers?: Record<string, string>;
  /** AbortSignal for cancellation */
  readonly signal?: AbortSignal;
}
