/**
 * @conveaux/claude-code-works
 *
 * Autonomous coding agent using the Claude Agent SDK.
 * Implements the three-agent pattern for long-running improvement cycles.
 */

// Contracts (pure types)
export * from './contracts/index.js';

// Harness (orchestration)
export { runImprovementCycle } from './harness.js';
export type { HarnessDeps, HarnessOptions, HarnessResult } from './harness.js';

// Signals (parsing utilities)
export { parseSignalLine, parseSignals, extractSignal } from './signals.js';

// Agent prompts and configuration
export * from './agents/index.js';
