/**
 * @conveaux/contract-abort
 *
 * Abort contract for request cancellation.
 * Provides injectable AbortController constructor interface.
 *
 * Usage:
 * - Inject the global AbortController constructor at composition time
 * - Use for cancellable async operations (fetch, streams, etc.)
 */

/**
 * AbortController constructor interface.
 *
 * Returns full AbortController instances because:
 * - Consumer code (like fetch) expects full AbortSignal functionality
 * - At composition time, the real AbortController is injected
 * - Mocks can return real AbortController instances
 *
 * @example
 * ```typescript
 * // Inject at composition time
 * const deps = { AbortController: globalThis.AbortController };
 *
 * // Use in functions
 * function fetchWithTimeout(
 *   url: string,
 *   AbortController: AbortControllerConstructor
 * ) {
 *   const controller = new AbortController();
 *   // ... use controller.signal with fetch
 * }
 * ```
 */
export interface AbortControllerConstructor {
  new (): AbortController;
}
