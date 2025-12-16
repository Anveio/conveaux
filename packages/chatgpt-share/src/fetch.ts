/**
 * HTTP fetching for ChatGPT share pages.
 */

import type { AbortControllerConstructor } from '@conveaux/contract-abort';
import type { EphemeralScheduler } from '@conveaux/contract-ephemeral-scheduler';
import type { HttpFetch } from '@conveaux/contract-http';
import { FetchError, InvalidURLError } from '@conveaux/port-control-flow';

import type { FetchShareOptions } from './types.js';

/**
 * Dependencies required for fetchSharePage.
 * These must be injected at composition time.
 */
export interface FetchShareDependencies {
  readonly AbortController: AbortControllerConstructor;
  readonly scheduler: EphemeralScheduler;
}

const VALID_URL_PATTERNS = [
  /^https:\/\/chatgpt\.com\/share\/[a-zA-Z0-9-]+$/,
  /^https:\/\/chat\.openai\.com\/share\/[a-zA-Z0-9-]+$/,
];

const DEFAULT_TIMEOUT = 10000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Validates that a URL is a supported ChatGPT share URL.
 */
export function validateURL(url: string): boolean {
  return VALID_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Extracts the share ID from a ChatGPT share URL.
 */
export function extractShareId(url: string): string {
  const match = url.match(/\/share\/([a-zA-Z0-9-]+)$/);
  if (!match?.[1]) {
    throw new InvalidURLError(url);
  }
  return match[1];
}

/**
 * Fetches the HTML content of a ChatGPT share page.
 *
 * @param deps - Required dependencies (AbortController, scheduler)
 * @param url - The ChatGPT share URL
 * @param httpFetch - The fetch function to use (inject globalThis.fetch)
 * @param options - Fetch options
 * @returns The HTML content of the page
 */
export async function fetchSharePage(
  deps: FetchShareDependencies,
  url: string,
  httpFetch: HttpFetch,
  options?: FetchShareOptions
): Promise<string> {
  const { AbortController: AbortControllerCtor, scheduler } = deps;

  if (!validateURL(url)) {
    throw new InvalidURLError(url);
  }

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const controller = new AbortControllerCtor();
  const timeoutHandle = scheduler.delay(() => controller.abort(), timeout);

  try {
    const response = await httpFetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    timeoutHandle.cancel();

    if (response.status === 404) {
      throw new FetchError('Conversation not found (may be private or deleted)', {
        statusCode: 404,
      });
    }

    if (!response.ok) {
      throw new FetchError(`HTTP error: ${response.status}`, {
        statusCode: response.status,
      });
    }

    return await response.text();
  } catch (error) {
    timeoutHandle.cancel();

    if (error instanceof FetchError || error instanceof InvalidURLError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new FetchError('Request timed out');
    }

    throw new FetchError(error instanceof Error ? error.message : 'Unknown fetch error');
  }
}
