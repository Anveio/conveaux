/**
 * Harness - orchestrates the three-agent improvement cycle.
 *
 * Based on Anthropic's blog:
 * https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 *
 * Flow:
 * 1. Initializer (once) - scans and creates feature-list.json
 * 2. Coding Agent (loop) - implements ONE feature, self-verifies
 * 3. Reviewer (loop) - approves or rejects
 * 4. Repeat until maxFeatures or no pending features
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Instrumenter } from '@conveaux/contract-instrumentation';
import type { Logger } from '@conveaux/contract-logger';
import {
  CODING_PERMISSION_MODE,
  CODING_PROMPT,
  CODING_TOOLS,
  INITIALIZER_PERMISSION_MODE,
  INITIALIZER_PROMPT,
  INITIALIZER_TOOLS,
  REVIEWER_PERMISSION_MODE,
  REVIEWER_PROMPT,
  REVIEWER_TOOLS,
} from './agents/index.js';
import type { FeatureCategory } from './contracts/index.js';
import type { HumanInputStore } from './human-input-store/index.js';
import { extractSignal } from './signals.js';

/**
 * Dependencies for the harness.
 * Follows contract-port pattern - no direct globals.
 */
export interface HarnessDeps {
  /** Project root directory */
  readonly projectRoot: string;
  /** Structured logger for all output */
  readonly logger: Logger;
  /** Instrumenter for tracing and timing */
  readonly instrumenter: Instrumenter;
  /** Human input store for capturing human messages (optional) */
  readonly humanInputStore?: HumanInputStore;
}

/**
 * Options for the improvement cycle.
 */
export interface HarnessOptions {
  /** Maximum features to complete (default: 5) */
  readonly maxFeatures?: number;
  /** Filter by category */
  readonly category?: FeatureCategory;
}

/**
 * Result of the improvement cycle.
 */
export interface HarnessResult {
  readonly featuresCompleted: number;
  readonly featuresBlocked: number;
  readonly totalIterations: number;
}

/**
 * Maximum iterations multiplier for the improvement cycle.
 *
 * We allow 2x maxFeatures iterations to account for:
 * - Rejected features that need revision (each rejection = 1 extra iteration)
 * - Blocked features that are skipped (each block = 1 iteration without completion)
 *
 * This provides a safety bound while allowing reasonable retry capacity.
 */
const ITERATION_LIMIT_MULTIPLIER = 2;

/**
 * Collect text content from agent messages.
 */
function collectText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';

  const msg = message as Record<string, unknown>;

  // Handle assistant messages with content array
  if (msg.type === 'assistant' && Array.isArray(msg.content)) {
    return msg.content
      .filter((block: unknown) => {
        const b = block as Record<string, unknown>;
        return b.type === 'text' && typeof b.text === 'string';
      })
      .map((block: unknown) => (block as { text: string }).text)
      .join('\n');
  }

  // Handle result messages
  if (msg.type === 'result' && typeof msg.result === 'string') {
    return msg.result;
  }

  return '';
}

/**
 * Run the Initializer agent.
 *
 * @returns Number of features discovered, or -1 on error
 */
async function runInitializer(deps: HarnessDeps): Promise<number> {
  const { logger, instrumenter, projectRoot } = deps;
  const log = logger.child({ agent: 'initializer' });

  log.info('Starting Initializer agent');

  return instrumenter.executeAsync(
    async () => {
      let allText = '';

      for await (const message of query({
        prompt: INITIALIZER_PROMPT,
        options: {
          allowedTools: [...INITIALIZER_TOOLS],
          permissionMode: INITIALIZER_PERMISSION_MODE,
          cwd: projectRoot,
        },
      })) {
        allText += collectText(message);
      }

      const signal = extractSignal(allText, 'INITIALIZATION_COMPLETE');
      if (signal) {
        log.info('Initializer complete', { featureCount: signal.featureCount });
        return signal.featureCount;
      }

      log.warn('Initializer did not emit completion signal');
      return -1;
    },
    { operation: 'runInitializer' }
  );
}

/**
 * Run the Coding agent for one feature.
 *
 * @returns Feature ID if ready for review, null if blocked or no features
 */
async function runCodingAgent(deps: HarnessDeps): Promise<string | null> {
  const { logger, instrumenter, projectRoot } = deps;
  const log = logger.child({ agent: 'coding' });

  log.info('Starting Coding agent');

  return instrumenter.executeAsync(
    async () => {
      let allText = '';

      for await (const message of query({
        prompt: CODING_PROMPT,
        options: {
          allowedTools: [...CODING_TOOLS],
          permissionMode: CODING_PERMISSION_MODE,
          cwd: projectRoot,
        },
      })) {
        allText += collectText(message);
      }

      // Check for ready signal
      const readySignal = extractSignal(allText, 'FEATURE_READY');
      if (readySignal) {
        log.info('Feature ready for review', { featureId: readySignal.featureId });
        return readySignal.featureId;
      }

      // Check for blocked signal
      const blockedSignal = extractSignal(allText, 'FEATURE_BLOCKED');
      if (blockedSignal) {
        log.warn('Feature blocked', {
          featureId: blockedSignal.featureId,
          reason: blockedSignal.reason,
        });
        return null;
      }

      log.warn('Coding Agent did not emit expected signal');
      return null;
    },
    { operation: 'runCodingAgent' }
  );
}

/**
 * Run the Reviewer agent for a specific feature.
 *
 * @returns true if approved, false if rejected
 */
async function runReviewer(deps: HarnessDeps, featureId: string): Promise<boolean> {
  const { logger, instrumenter, projectRoot } = deps;
  const log = logger.child({ agent: 'reviewer', featureId });

  log.info('Starting Reviewer agent');

  return instrumenter.executeAsync(
    async () => {
      let allText = '';

      for await (const message of query({
        prompt: `${REVIEWER_PROMPT}\n\nReview feature: ${featureId}`,
        options: {
          allowedTools: [...REVIEWER_TOOLS],
          permissionMode: REVIEWER_PERMISSION_MODE,
          cwd: projectRoot,
        },
      })) {
        allText += collectText(message);
      }

      // Check for approved signal
      const approvedSignal = extractSignal(allText, 'APPROVED');
      if (approvedSignal && approvedSignal.featureId === featureId) {
        log.info('Feature APPROVED');
        return true;
      }

      // Check for rejected signal
      const rejectedSignal = extractSignal(allText, 'REJECTED');
      if (rejectedSignal) {
        log.warn('Feature REJECTED', { feedback: rejectedSignal.feedback });
        return false;
      }

      log.warn('Reviewer did not emit expected signal');
      return false;
    },
    { operation: 'runReviewer', context: { featureId } }
  );
}

/**
 * Run the complete improvement cycle.
 *
 * @param deps - Harness dependencies
 * @param options - Cycle options
 * @returns Result summary
 */
export async function runImprovementCycle(
  deps: HarnessDeps,
  options: HarnessOptions = {}
): Promise<HarnessResult> {
  const { logger, instrumenter, humanInputStore } = deps;
  const maxFeatures = options.maxFeatures ?? 5;

  const log = logger.child({ component: 'harness' });

  return instrumenter.executeAsync(
    async () => {
      // Start a new session for capturing human inputs
      const sessionId = humanInputStore?.startSession();
      if (sessionId) {
        log.debug('Started human input session', { sessionId });
      }

      log.info('Starting improvement cycle', {
        maxFeatures,
        category: options.category ?? 'all',
      });

      // Phase 1: Initialize
      const featureCount = await runInitializer(deps);
      if (featureCount <= 0) {
        log.warn('No features discovered or initialization failed');
        return {
          featuresCompleted: 0,
          featuresBlocked: 0,
          totalIterations: 0,
        };
      }

      // Phase 2 & 3: Code -> Review loop
      let completed = 0;
      let blocked = 0;
      let iterations = 0;

      while (completed < maxFeatures && iterations < maxFeatures * ITERATION_LIMIT_MULTIPLIER) {
        iterations++;

        log.debug('Starting iteration', { iteration: iterations, completed, blocked });

        // Run Coding Agent
        const featureId = await runCodingAgent(deps);
        if (!featureId) {
          blocked++;
          if (blocked >= 3) {
            log.error('Too many blocked features, stopping cycle', { blocked });
            break;
          }
          continue;
        }

        // Run Reviewer
        const approved = await runReviewer(deps, featureId);
        if (approved) {
          completed++;
          log.info('Feature completed', {
            featureId,
            completed,
            maxFeatures,
          });
        } else {
          log.info('Feature needs revision', { featureId });
        }
      }

      log.info('Cycle complete', {
        featuresCompleted: completed,
        featuresBlocked: blocked,
        totalIterations: iterations,
      });

      return {
        featuresCompleted: completed,
        featuresBlocked: blocked,
        totalIterations: iterations,
      };
    },
    { operation: 'runImprovementCycle', context: { maxFeatures, category: options.category } }
  );
}
