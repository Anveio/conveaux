import {
  FetchError,
  type FetchOptions,
  type HttpFetcher,
  InvalidURLError,
} from '@conveaux/contracts';

const VALID_URL_PATTERNS = [
  /^https:\/\/chatgpt\.com\/share\/[a-zA-Z0-9-]+$/,
  /^https:\/\/chat\.openai\.com\/share\/[a-zA-Z0-9-]+$/,
];

const DEFAULT_TIMEOUT = 10000;

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function validateURL(url: string): boolean {
  return VALID_URL_PATTERNS.some((pattern) => pattern.test(url));
}

export function extractShareId(url: string): string {
  const match = url.match(/\/share\/([a-zA-Z0-9-]+)$/);
  if (!match) {
    throw new InvalidURLError(url);
  }
  return match[1];
}

export async function fetchSharePage(url: string, options?: FetchOptions): Promise<string> {
  if (!validateURL(url)) {
    throw new InvalidURLError(url);
  }

  const timeout = options?.timeout ?? DEFAULT_TIMEOUT;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (response.status === 404) {
      throw new FetchError('Conversation not found (may be private or deleted)');
    }

    if (!response.ok) {
      throw new FetchError(`HTTP error: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof FetchError || error instanceof InvalidURLError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new FetchError(`Request timed out after ${timeout / 1000} seconds`);
      }
      throw new FetchError(`Network error: ${error.message}`);
    }

    throw new FetchError('Unknown network error');
  }
}

export function createHttpFetcher(): HttpFetcher {
  return {
    fetch: fetchSharePage,
  };
}
