/**
 * Human Input Store Contracts
 *
 * Pure types for capturing human messages during improvement cycles.
 * Human input is the alpha - every prompt, correction, and decision is signal.
 */

// =============================================================================
// Core Types
// =============================================================================

/**
 * Context type categorizing the human input.
 */
export type InputContextType = 'prompt' | 'correction' | 'decision' | 'other';

/**
 * Agent phase when the input occurred.
 */
export type AgentPhase = 'initializer' | 'coding' | 'reviewer';

/**
 * A captured human input.
 */
export interface HumanInput {
  readonly id: number;
  readonly sessionId: string;
  readonly sequenceNum: number;
  readonly inputText: string;
  readonly contextType: InputContextType;
  readonly agentPhase: AgentPhase | null;
  readonly featureId: string | null;
  readonly createdAt: string;
}

// =============================================================================
// Input Types
// =============================================================================

/**
 * Parameters for recording a human input.
 */
export interface RecordInputParams {
  /** The human's message text */
  readonly inputText: string;
  /** What type of input this is */
  readonly contextType: InputContextType;
  /** Which agent phase was active */
  readonly agentPhase?: AgentPhase;
  /** Related feature ID if applicable */
  readonly featureId?: string;
}

/**
 * Query parameters for retrieving inputs.
 */
export interface InputQuery {
  /** Filter by context type */
  readonly contextType?: InputContextType;
  /** Filter by agent phase */
  readonly agentPhase?: AgentPhase;
  /** Filter by session ID */
  readonly sessionId?: string;
  /** Maximum results to return */
  readonly limit?: number;
}

// =============================================================================
// Store Interface
// =============================================================================

/**
 * Human Input Store for capturing human messages.
 *
 * Every human message is valuable signal for future learning.
 */
export interface HumanInputStore {
  // === Recording ===

  /**
   * Record a human input.
   * Automatically assigns to current session with next sequence number.
   */
  recordInput(input: RecordInputParams): HumanInput;

  // === Querying ===

  /**
   * Get inputs matching the query.
   */
  getInputs(query?: InputQuery): readonly HumanInput[];

  /**
   * Get recent inputs across all sessions.
   */
  getRecentInputs(limit?: number): readonly HumanInput[];

  /**
   * Get all inputs from a specific session.
   */
  getInputsBySession(sessionId: string): readonly HumanInput[];

  // === Session Management ===

  /**
   * Start a new session.
   * @returns The new session ID
   */
  startSession(): string;

  /**
   * Get the current session ID.
   * @returns Current session ID or null if no session active
   */
  getCurrentSession(): string | null;

  // === Statistics ===

  /**
   * Get count of inputs in the store.
   */
  getInputCount(): number;

  /**
   * Get count of sessions.
   */
  getSessionCount(): number;
}
