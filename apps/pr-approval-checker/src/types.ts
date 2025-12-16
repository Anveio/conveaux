// ============================================================================
// Configuration Types
// ============================================================================

export interface CheckerConfig {
  readonly owner: string;
  readonly repo: string;
  readonly prNumber: number;
  readonly botUsername: string;
  readonly timeoutMs: number;
  readonly intervalMs: number;
  readonly once: boolean;
}

// ============================================================================
// GitHub API Response Types
// ============================================================================

export interface GitHubComment {
  readonly id: number;
  readonly user: { readonly login: string };
  readonly body: string;
  readonly created_at: string;
}

export interface GitHubReaction {
  readonly content: string;
  readonly user: { readonly login: string };
  readonly created_at: string;
}

// ============================================================================
// Output Types
// ============================================================================

export interface PrInfo {
  readonly owner: string;
  readonly repo: string;
  readonly number: number;
}

export interface ApprovalInfo {
  readonly commentId: number;
  readonly commentType: 'issue' | 'review';
  readonly reactedBy: string;
  readonly reactedAt: string;
}

export interface FeedbackInfo {
  readonly commentId: number;
  readonly author: string;
  readonly body: string;
  readonly createdAt: string;
}

export type CheckResult =
  | { readonly status: 'approved'; readonly pr: PrInfo; readonly approval: ApprovalInfo }
  | { readonly status: 'feedback'; readonly pr: PrInfo; readonly feedback: FeedbackInfo }
  | { readonly status: 'timeout'; readonly pr: PrInfo; readonly elapsedMs: number }
  | { readonly status: 'error'; readonly pr: PrInfo | null; readonly message: string };

// ============================================================================
// Exit Codes
// ============================================================================

export const EXIT_APPROVED = 0;
export const EXIT_FEEDBACK = 1;
export const EXIT_TIMEOUT = 2;
export const EXIT_ERROR = 3;

export const EXIT_CODES: Record<CheckResult['status'], number> = {
  approved: EXIT_APPROVED,
  feedback: EXIT_FEEDBACK,
  timeout: EXIT_TIMEOUT,
  error: EXIT_ERROR,
};
