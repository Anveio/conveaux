import { execSync } from 'node:child_process';
import type { Logger } from '@conveaux/contract-logger';
import type { GitHubComment, GitHubReaction } from './types.js';

// ============================================================================
// GitHub Client Interface
// ============================================================================

export interface GitHubClient {
  getIssueComments(owner: string, repo: string, prNumber: number): GitHubComment[];
  getReviewComments(owner: string, repo: string, prNumber: number): GitHubComment[];
  getIssueCommentReactions(owner: string, repo: string, commentId: number): GitHubReaction[];
  getReviewCommentReactions(owner: string, repo: string, commentId: number): GitHubReaction[];
}

// ============================================================================
// GitHub Client Dependencies
// ============================================================================

export interface GitHubClientDeps {
  readonly logger: Logger;
}

// ============================================================================
// GitHub Client Factory
// ============================================================================

/**
 * Create a GitHub client that uses the `gh` CLI for API access.
 *
 * All API calls are logged at debug level for observability.
 */
export function createGitHubClient(deps: GitHubClientDeps): GitHubClient {
  const { logger } = deps;

  function ghApi<T>(endpoint: string): T {
    const startTime = Date.now();
    logger.debug('GitHub API request', { endpoint });

    try {
      const result = execSync(`gh api ${endpoint}`, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB for large PRs
      });

      const durationMs = Date.now() - startTime;
      logger.debug('GitHub API response', { endpoint, durationMs });

      return JSON.parse(result) as T;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      logger.warn('GitHub API error', {
        endpoint,
        durationMs,
        error: error instanceof Error ? error : undefined,
      });
      throw error;
    }
  }

  return {
    getIssueComments: (owner, repo, prNumber) =>
      ghApi<GitHubComment[]>(`repos/${owner}/${repo}/issues/${prNumber}/comments`),

    getReviewComments: (owner, repo, prNumber) =>
      ghApi<GitHubComment[]>(`repos/${owner}/${repo}/pulls/${prNumber}/comments`),

    getIssueCommentReactions: (owner, repo, commentId) =>
      ghApi<GitHubReaction[]>(`repos/${owner}/${repo}/issues/comments/${commentId}/reactions`),

    getReviewCommentReactions: (owner, repo, commentId) =>
      ghApi<GitHubReaction[]>(`repos/${owner}/${repo}/pulls/comments/${commentId}/reactions`),
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if the `gh` CLI is installed.
 */
export function checkGhInstalled(): boolean {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the `gh` CLI is authenticated.
 */
export function checkGhAuthenticated(): boolean {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
