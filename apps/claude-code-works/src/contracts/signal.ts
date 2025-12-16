/**
 * Signal contracts - coordination signals between agents.
 *
 * Agents communicate via structured text output that the harness parses.
 * These signals coordinate the Initializer -> Coding -> Reviewer workflow.
 */

/**
 * Signal emitted when the Initializer completes scanning and creates feature-list.json.
 */
export interface InitializationCompleteSignal {
  readonly type: 'INITIALIZATION_COMPLETE';
  readonly featureCount: number;
}

/**
 * Signal emitted when the Coding Agent completes a feature and is ready for review.
 */
export interface FeatureReadySignal {
  readonly type: 'FEATURE_READY';
  readonly featureId: string;
  /** Impact level for gatekeeper routing (low = skip reviewer) */
  readonly impact?: string;
}

/**
 * Signal emitted when the Coding Agent is blocked on a feature.
 */
export interface FeatureBlockedSignal {
  readonly type: 'FEATURE_BLOCKED';
  readonly featureId: string;
  readonly reason: string;
}

/**
 * Signal emitted when the Reviewer approves a feature.
 */
export interface ApprovedSignal {
  readonly type: 'APPROVED';
  readonly featureId: string;
}

/**
 * Signal emitted when the Reviewer rejects a feature.
 */
export interface RejectedSignal {
  readonly type: 'REJECTED';
  readonly featureId: string;
  readonly feedback: string;
}

/**
 * Union of all coordination signals.
 */
export type CoordinationSignal =
  | InitializationCompleteSignal
  | FeatureReadySignal
  | FeatureBlockedSignal
  | ApprovedSignal
  | RejectedSignal;

/**
 * Signal type discriminator.
 */
export type SignalType = CoordinationSignal['type'];
