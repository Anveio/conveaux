import type { EphemeralScheduler } from '@conveaux/contract-ephemeral-scheduler';
import type { Logger } from '@conveaux/contract-logger';
import type { WallClock } from '@conveaux/contract-wall-clock';
import type { GitHubClient } from './github.js';
import type { ApprovalInfo, CheckResult, CheckerConfig, FeedbackInfo, PrInfo } from './types.js';

// ============================================================================
// Checker Dependencies
// ============================================================================

export interface CheckerDeps {
  readonly logger: Logger;
  readonly clock: WallClock;
  readonly github: GitHubClient;
  readonly scheduler: EphemeralScheduler;
}

// ============================================================================
// Helper Functions
// ============================================================================

function makePrInfo(config: CheckerConfig): PrInfo {
  return {
    owner: config.owner,
    repo: config.repo,
    number: config.prNumber,
  };
}

/**
 * Find a comment from the bot (feedback).
 */
function findBotComment(github: GitHubClient, config: CheckerConfig): FeedbackInfo | null {
  const { owner, repo, prNumber, botUsername } = config;

  // Check issue comments (general PR comments)
  const issueComments = github.getIssueComments(owner, repo, prNumber);
  const botComment = issueComments.find((c) => c.user.login === botUsername);

  if (botComment) {
    return {
      commentId: botComment.id,
      author: botComment.user.login,
      body: botComment.body,
      createdAt: botComment.created_at,
    };
  }

  return null;
}

/**
 * Find a thumbs up reaction from the bot on the PR body or any comment.
 */
function findBotApproval(github: GitHubClient, config: CheckerConfig): ApprovalInfo | null {
  const { owner, repo, prNumber, botUsername } = config;

  // Check PR body for bot's thumbs up reaction
  const prReactions = github.getPrReactions(owner, repo, prNumber);
  const prBodyThumbsUp = prReactions.find(
    (r) => r.user.login === botUsername && r.content === '+1'
  );
  if (prBodyThumbsUp) {
    return {
      commentId: prNumber, // Use PR number as identifier for PR body
      commentType: 'pr_body',
      reactedBy: prBodyThumbsUp.user.login,
      reactedAt: prBodyThumbsUp.created_at,
    };
  }

  // Check issue comments for bot's thumbs up
  const issueComments = github.getIssueComments(owner, repo, prNumber);
  for (const comment of issueComments) {
    const reactions = github.getIssueCommentReactions(owner, repo, comment.id);
    const botThumbsUp = reactions.find((r) => r.user.login === botUsername && r.content === '+1');
    if (botThumbsUp) {
      return {
        commentId: comment.id,
        commentType: 'issue',
        reactedBy: botThumbsUp.user.login,
        reactedAt: botThumbsUp.created_at,
      };
    }
  }

  // Check review comments (inline code comments) for bot's thumbs up
  const reviewComments = github.getReviewComments(owner, repo, prNumber);
  for (const comment of reviewComments) {
    const reactions = github.getReviewCommentReactions(owner, repo, comment.id);
    const botThumbsUp = reactions.find((r) => r.user.login === botUsername && r.content === '+1');
    if (botThumbsUp) {
      return {
        commentId: comment.id,
        commentType: 'review',
        reactedBy: botThumbsUp.user.login,
        reactedAt: botThumbsUp.created_at,
      };
    }
  }

  return null;
}

// ============================================================================
// Main Polling Function
// ============================================================================

/**
 * Poll for PR approval from the specified bot.
 *
 * Checks for either:
 * - A thumbs up reaction from the bot on any comment (approved)
 * - A comment from the bot (feedback/needs changes)
 *
 * Feedback takes precedence over approval if both exist.
 */
export async function pollForApproval(
  deps: CheckerDeps,
  config: CheckerConfig
): Promise<CheckResult> {
  const { logger, clock, github, scheduler } = deps;

  // Promisified delay using the injected scheduler
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => scheduler.delay(resolve, ms));
  const log = logger.child({ pr: `${config.owner}/${config.repo}#${config.prNumber}` });

  const pr = makePrInfo(config);
  const startTime = clock.nowMs();
  const deadline = startTime + config.timeoutMs;

  log.info('Starting approval check', {
    bot: config.botUsername,
    timeout: `${Math.round(config.timeoutMs / 60000)}m`,
    interval: `${Math.round(config.intervalMs / 1000)}s`,
  });

  let attempt = 0;

  while (true) {
    attempt++;
    const elapsed = clock.nowMs() - startTime;

    log.debug('Checking for response', { attempt, elapsedMs: Math.round(elapsed) });

    try {
      // Check for bot comment (feedback) - takes precedence over approval
      const feedback = findBotComment(github, config);
      if (feedback) {
        log.info('Feedback received from bot', { commentId: feedback.commentId });
        return { status: 'feedback', pr, feedback };
      }

      // Check all comments for bot's thumbs up reaction
      const approval = findBotApproval(github, config);
      if (approval) {
        log.info('Approval received from bot', { commentId: approval.commentId });
        return { status: 'approved', pr, approval };
      }
    } catch (error) {
      // Log error but continue polling (transient network errors)
      log.warn('API error, will retry', {
        error: error instanceof Error ? error : undefined,
        attempt,
      });
    }

    // Check if this is a single-check run (--once flag)
    if (config.once) {
      log.info('Single check completed, no response found');
      return { status: 'timeout', pr, elapsedMs: clock.nowMs() - startTime };
    }

    // Check timeout before sleeping
    if (clock.nowMs() >= deadline) {
      log.warn('Timeout reached without response', {
        elapsedMs: clock.nowMs() - startTime,
        attempts: attempt,
      });
      return { status: 'timeout', pr, elapsedMs: clock.nowMs() - startTime };
    }

    log.debug('Waiting before next check', { intervalMs: config.intervalMs });
    await delay(config.intervalMs);

    // Check timeout after sleeping
    if (clock.nowMs() >= deadline) {
      log.warn('Timeout reached without response', {
        elapsedMs: clock.nowMs() - startTime,
        attempts: attempt,
      });
      return { status: 'timeout', pr, elapsedMs: clock.nowMs() - startTime };
    }
  }
}
