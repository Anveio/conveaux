import { DEFAULT_RETRY_METADATA, RetryableError, UserError } from '@conveaux/port-control-flow';
import type { RetryMetadata } from '@conveaux/port-control-flow';

// ============================================================================
// Exit Code 2: User/Input Errors
// ============================================================================

/**
 * Invalid PR URL format.
 */
export class InvalidPrUrlError extends UserError {
  readonly url: string;

  constructor(url: string) {
    super(
      `Invalid PR URL: ${url}\n\nExpected format: https://github.com/owner/repo/pull/123\n\nExample:\n  pr-approval-checker https://github.com/Anveio/conveaux/pull/73`
    );
    this.name = 'InvalidPrUrlError';
    this.url = url;
  }
}

/**
 * GitHub CLI (gh) not installed.
 */
export class GhNotInstalledError extends UserError {
  constructor() {
    super(
      'GitHub CLI (gh) is not installed or not in PATH.\n\n' +
        'To fix:\n' +
        '  1. Install gh: https://cli.github.com/\n' +
        '  2. macOS: brew install gh\n' +
        '  3. Linux: sudo apt install gh\n' +
        '  4. Windows: winget install GitHub.cli\n' +
        '  5. Verify: gh --version'
    );
    this.name = 'GhNotInstalledError';
  }
}

/**
 * GitHub CLI (gh) not authenticated.
 */
export class GhNotAuthenticatedError extends UserError {
  constructor() {
    super(
      'GitHub CLI (gh) is not authenticated.\n\n' +
        'To fix:\n' +
        '  1. Run: gh auth login\n' +
        '  2. Follow the prompts to authenticate with GitHub\n' +
        '  3. Verify: gh auth status'
    );
    this.name = 'GhNotAuthenticatedError';
  }
}

// ============================================================================
// Exit Code 3: Retryable Errors
// ============================================================================

/**
 * GitHub API request failed (retryable).
 */
export class GitHubApiError extends RetryableError {
  readonly endpoint: string;
  readonly retry: RetryMetadata;

  constructor(endpoint: string, cause?: Error) {
    super(
      `GitHub API request failed: ${endpoint}\n\nThis may be a temporary issue. The checker will retry automatically.`
    );
    this.name = 'GitHubApiError';
    this.endpoint = endpoint;
    this.cause = cause;
    this.retry = DEFAULT_RETRY_METADATA;
  }
}

/**
 * GitHub API rate limit exceeded (retryable with longer delay).
 */
export class GitHubRateLimitError extends RetryableError {
  readonly resetTime: Date;
  readonly retry: RetryMetadata;

  constructor(resetTime: Date) {
    super(
      `GitHub API rate limit exceeded.\n\nLimit resets at: ${resetTime.toISOString()}\nThe checker will wait and retry automatically.`
    );
    this.name = 'GitHubRateLimitError';
    this.resetTime = resetTime;
    this.retry = {
      ...DEFAULT_RETRY_METADATA,
      maxRetries: 10,
      initialDelayMs: Math.max(
        DEFAULT_RETRY_METADATA.initialDelayMs,
        resetTime.getTime() - Date.now()
      ),
    };
  }
}
