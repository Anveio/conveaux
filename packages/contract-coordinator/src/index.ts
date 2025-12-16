/**
 * @conveaux/contract-coordinator
 *
 * Pure types for multi-agent coordination.
 *
 * FUTURE DECOMPOSITION CANDIDATES:
 * - TODO: Extract WorktreeConfig/WorktreeResult → contract-worktree
 * - TODO: Extract ProcessConfig/ProcessResult → contract-process-runner
 * - TODO: Extract AgentType/ClassifiedTask → contract-task-classification
 * - TODO: Extract Signal types → contract-coordinator-signal (if protocol grows)
 */

// =============================================================================
// Agent Types
// =============================================================================

/**
 * Specialized agent types for different improvement tasks.
 */
export type AgentType =
  | 'initializer'
  | 'coding'
  | 'reviewer'
  | 'lint'
  | 'test'
  | 'docs'
  | 'refactor';

/**
 * Current status of an agent.
 */
export type AgentStatus = 'idle' | 'spawning' | 'running' | 'completed' | 'failed' | 'blocked';

/**
 * State of a single agent instance.
 */
export interface AgentState {
  readonly id: string;
  readonly type: AgentType;
  readonly status: AgentStatus;
  readonly taskId?: string;
  readonly worktreePath?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
}

// =============================================================================
// Task Classification
// TODO: Consider extracting to contract-task-classification if routing grows
// =============================================================================

/**
 * Feature impact level for prioritization.
 */
export type Impact = 'high' | 'medium' | 'low';

/**
 * A feature classified with its target agent type.
 */
export interface ClassifiedTask {
  readonly featureId: string;
  readonly agentType: AgentType;
  readonly files: readonly string[];
  readonly priority: number;
  readonly prompt: string;
}

/**
 * Rule for classifying features to agent types.
 * Port implements the matching logic.
 */
export interface ClassificationRule {
  readonly agentType: AgentType;
  readonly priority: number;
}

// =============================================================================
// Execution Planning
// =============================================================================

/**
 * A wave of tasks that can execute in parallel (no file conflicts).
 */
export interface ExecutionWave {
  readonly index: number;
  readonly tasks: readonly ClassifiedTask[];
}

/**
 * Status of a wave during execution.
 */
export type WaveStatus = 'pending' | 'running' | 'completed';

/**
 * Runtime state of a wave.
 */
export interface WaveState {
  readonly index: number;
  readonly status: WaveStatus;
  readonly taskIds: readonly string[];
  readonly completedCount: number;
  readonly failedCount: number;
}

// =============================================================================
// Process Execution
// TODO: Consider extracting to contract-process-runner
// =============================================================================

/**
 * Configuration for spawning a CLI process.
 */
export interface ProcessConfig {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Result of a CLI process execution.
 */
export interface ProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly timedOut: boolean;
}

// =============================================================================
// Worktree Management
// TODO: Consider extracting to contract-worktree
// =============================================================================

/**
 * Configuration for creating a git worktree.
 */
export interface WorktreeConfig {
  readonly basePath: string;
  readonly branchName: string;
  readonly worktreePath: string;
}

/**
 * Result of worktree operations.
 */
export interface WorktreeResult {
  readonly success: boolean;
  readonly path: string;
  readonly branch: string;
  readonly error?: string;
}

// =============================================================================
// Task Execution Result
// =============================================================================

/**
 * Result of executing a single task.
 */
export interface TaskResult {
  readonly taskId: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly agentType: AgentType;
  readonly worktreeBranch?: string;
  readonly processResult?: ProcessResult;
  readonly error?: string;
}

// =============================================================================
// Coordinator Result
// =============================================================================

/**
 * Final result of a coordinated improvement cycle.
 */
export interface CoordinatorResult {
  readonly success: boolean;
  readonly totalTasks: number;
  readonly completedTasks: number;
  readonly failedTasks: number;
  readonly blockedTasks: number;
  readonly durationMs: number;
  readonly waves: readonly WaveState[];
  readonly taskResults: readonly TaskResult[];
  readonly mergedBranches: readonly string[];
}

// =============================================================================
// Coordinator Options
// =============================================================================

/**
 * Options for running a coordinated cycle.
 */
export interface CoordinatorOptions {
  readonly maxConcurrency?: number;
  readonly maxFeatures?: number;
  readonly timeoutPerAgentMs?: number;
  readonly autoMerge?: boolean;
}
