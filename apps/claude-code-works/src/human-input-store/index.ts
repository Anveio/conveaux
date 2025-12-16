/**
 * Human Input Store Implementation
 *
 * Captures ALL human messages during improvement cycles.
 * Human input is the alpha - capture now, analyze later.
 */

import type { DurableStorage, Migration } from '@conveaux/contract-durable-storage';

import type {
  AgentPhase,
  HumanInput,
  HumanInputStore,
  InputContextType,
  InputQuery,
  RecordInputParams,
} from './contracts.js';

// Re-export contracts
export * from './contracts.js';

// =============================================================================
// Migrations
// =============================================================================

/**
 * Migrations for the human input store schema.
 */
export const HUMAN_INPUT_STORE_MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'Create human_inputs table',
    up: `
      CREATE TABLE human_inputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sequence_num INTEGER NOT NULL,
        input_text TEXT NOT NULL,
        context_type TEXT NOT NULL CHECK (context_type IN ('prompt', 'correction', 'decision', 'other')),
        agent_phase TEXT CHECK (agent_phase IS NULL OR agent_phase IN ('initializer', 'coding', 'reviewer')),
        feature_id TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX idx_human_inputs_session ON human_inputs(session_id);
      CREATE INDEX idx_human_inputs_created ON human_inputs(created_at DESC);
      CREATE INDEX idx_human_inputs_type ON human_inputs(context_type);
    `,
  },
];

// =============================================================================
// Implementation
// =============================================================================

/**
 * Dependencies for creating the human input store.
 */
export interface HumanInputStoreDeps {
  readonly storage: DurableStorage;
  /** ID generator for sessions (defaults to crypto.randomUUID pattern) */
  readonly generateId?: () => string;
}

/**
 * Create a Human Input Store instance.
 *
 * @param deps - Dependencies including durable storage
 * @returns Human Input Store implementation
 */
export function createHumanInputStore(deps: HumanInputStoreDeps): HumanInputStore {
  const {
    storage,
    generateId = () => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  } = deps;

  // Apply migrations on creation
  storage.migrate(HUMAN_INPUT_STORE_MIGRATIONS);

  // Session state
  let currentSessionId: string | null = null;
  let currentSequence = 0;

  // Prepared statements
  const insertInput = storage.prepare<HumanInputRow>(
    `INSERT INTO human_inputs (session_id, sequence_num, input_text, context_type, agent_phase, feature_id)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`
  );

  const selectInputs = storage.prepare<HumanInputRow>(
    `SELECT * FROM human_inputs
     WHERE (? IS NULL OR context_type = ?)
       AND (? IS NULL OR agent_phase = ?)
       AND (? IS NULL OR session_id = ?)
     ORDER BY id DESC
     LIMIT ?`
  );

  const selectBySession = storage.prepare<HumanInputRow>(
    'SELECT * FROM human_inputs WHERE session_id = ? ORDER BY sequence_num ASC'
  );

  const selectRecent = storage.prepare<HumanInputRow>(
    'SELECT * FROM human_inputs ORDER BY id DESC LIMIT ?'
  );

  const countInputs = storage.prepare<{ count: number }>(
    'SELECT COUNT(*) as count FROM human_inputs'
  );

  const countSessions = storage.prepare<{ count: number }>(
    'SELECT COUNT(DISTINCT session_id) as count FROM human_inputs'
  );

  const _getMaxSequence = storage.prepare<{ max_seq: number | null }>(
    'SELECT MAX(sequence_num) as max_seq FROM human_inputs WHERE session_id = ?'
  );

  return {
    recordInput(input: RecordInputParams): HumanInput {
      // Ensure we have a session
      if (!currentSessionId) {
        currentSessionId = generateId();
        currentSequence = 0;
      }

      // Increment sequence
      currentSequence += 1;

      const row = insertInput.get(
        currentSessionId,
        currentSequence,
        input.inputText,
        input.contextType,
        input.agentPhase ?? null,
        input.featureId ?? null
      );

      return rowToHumanInput(row!);
    },

    getInputs(query: InputQuery = {}): readonly HumanInput[] {
      const rows = selectInputs.all(
        query.contextType ?? null,
        query.contextType ?? null,
        query.agentPhase ?? null,
        query.agentPhase ?? null,
        query.sessionId ?? null,
        query.sessionId ?? null,
        query.limit ?? 100
      );
      return rows.map(rowToHumanInput);
    },

    getRecentInputs(limit = 10): readonly HumanInput[] {
      const rows = selectRecent.all(limit);
      return rows.map(rowToHumanInput);
    },

    getInputsBySession(sessionId: string): readonly HumanInput[] {
      const rows = selectBySession.all(sessionId);
      return rows.map(rowToHumanInput);
    },

    startSession(): string {
      currentSessionId = generateId();
      currentSequence = 0;
      return currentSessionId;
    },

    getCurrentSession(): string | null {
      return currentSessionId;
    },

    getInputCount(): number {
      const row = countInputs.get();
      return row?.count ?? 0;
    },

    getSessionCount(): number {
      const row = countSessions.get();
      return row?.count ?? 0;
    },
  };
}

// =============================================================================
// Internal Types & Helpers
// =============================================================================

interface HumanInputRow {
  id: number;
  session_id: string;
  sequence_num: number;
  input_text: string;
  context_type: string;
  agent_phase: string | null;
  feature_id: string | null;
  created_at: string;
}

function rowToHumanInput(row: HumanInputRow): HumanInput {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequenceNum: row.sequence_num,
    inputText: row.input_text,
    contextType: row.context_type as InputContextType,
    agentPhase: row.agent_phase as AgentPhase | null,
    featureId: row.feature_id,
    createdAt: row.created_at,
  };
}
