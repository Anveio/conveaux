/**
 * Harness - orchestrates the three-agent improvement cycle.
 *
 * Based on Anthropic's blog:
 * https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
 *
 * Flow:
 * 1. Initializer (once) - scans and creates feature-list.json
 * 2. Coding Agent (loop) - implements ONE feature, self-verifies
 * 3. Reviewer (gatekeeper) - only for HIGH/MEDIUM impact
 * 4. Repeat until maxFeatures or consecutive blocks limit
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
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
import { extractSignal } from './signals.js';

/**
 * Configuration for long-running autonomous operation.
 */
const CONFIG = {
  /** Maximum retries per feature before blocking */
  maxRetriesPerFeature: 3,
  /** Stop session after this many consecutive blocks */
  maxConsecutiveBlocks: 3,
  /** Timeout per agent call in ms (10 minutes) */
  agentTimeoutMs: 10 * 60 * 1000,
} as const;

/**
 * Dependencies for the harness.
 */
export interface HarnessDeps {
  readonly projectRoot: string;
  readonly logger: Logger;
}

/**
 * Options for the improvement cycle.
 */
export interface HarnessOptions {
  readonly maxFeatures?: number;
  /** Limit scope to specific paths (e.g., ['packages/port-logger']) */
  readonly scope?: readonly string[];
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
 * Wrap an async operation with timeout protection.
 */
async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    operation()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Collect text content from agent messages.
 */
function collectText(message: unknown): string {
  if (!message || typeof message !== 'object') return '';

  const msg = message as Record<string, unknown>;

  if (msg.type === 'assistant' && Array.isArray(msg.content)) {
    return msg.content
      .filter((block: unknown) => {
        const b = block as Record<string, unknown>;
        return b.type === 'text' && typeof b.text === 'string';
      })
      .map((block: unknown) => (block as { text: string }).text)
      .join('\n');
  }

  if (msg.type === 'result' && typeof msg.result === 'string') {
    return msg.result;
  }

  return '';
}

/**
 * Build scope-aware prompt for the Initializer.
 */
function buildInitializerPrompt(scope?: readonly string[]): string {
  if (!scope || scope.length === 0) {
    return INITIALIZER_PROMPT;
  }

  const scopeDirective = `
## SCOPE RESTRICTION
IMPORTANT: Only scan and generate features for these paths:
${scope.map((p) => `- ${p}`).join('\n')}

Ignore all other directories. Focus your improvement discovery on these specific packages.
`;

  return INITIALIZER_PROMPT + scopeDirective;
}

/**
 * Run the Initializer agent.
 */
async function runInitializer(deps: HarnessDeps, scope?: readonly string[]): Promise<number> {
  const { logger, projectRoot } = deps;
  const log = logger.child({ agent: 'initializer' });

  log.info('Starting Initializer agent', { scope: scope ?? 'all' });

  const run = async () => {
    let allText = '';

    for await (const message of query({
      prompt: buildInitializerPrompt(scope),
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
  };

  try {
    return await withTimeout(run, CONFIG.agentTimeoutMs, 'Initializer');
  } catch (err) {
    log.error('Initializer failed', { error: err instanceof Error ? err : new Error(String(err)) });
    return -1;
  }
}

/**
 * Run the Coding agent for one feature.
 *
 * @returns Object with featureId and impact if ready for review, null if blocked
 */
async function runCodingAgent(
  deps: HarnessDeps
): Promise<{ featureId: string; impact: string } | null> {
  const { logger, projectRoot } = deps;
  const log = logger.child({ agent: 'coding' });

  log.info('Starting Coding agent');

  const run = async () => {
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

    const readySignal = extractSignal(allText, 'FEATURE_READY');
    if (readySignal) {
      log.info('Feature ready for review', {
        featureId: readySignal.featureId,
        impact: readySignal.impact,
      });
      return { featureId: readySignal.featureId, impact: readySignal.impact ?? 'medium' };
    }

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
  };

  try {
    return await withTimeout(run, CONFIG.agentTimeoutMs, 'CodingAgent');
  } catch (err) {
    log.error('Coding Agent failed', {
      error: err instanceof Error ? err : new Error(String(err)),
    });
    return null;
  }
}

/**
 * Run the Reviewer agent for a specific feature.
 */
async function runReviewer(deps: HarnessDeps, featureId: string): Promise<boolean> {
  const { logger, projectRoot } = deps;
  const log = logger.child({ agent: 'reviewer', featureId });

  log.info('Starting Reviewer agent');

  const run = async () => {
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

    const approvedSignal = extractSignal(allText, 'APPROVED');
    if (approvedSignal && approvedSignal.featureId === featureId) {
      log.info('Feature APPROVED');
      return true;
    }

    const rejectedSignal = extractSignal(allText, 'REJECTED');
    if (rejectedSignal) {
      log.warn('Feature REJECTED', { feedback: rejectedSignal.feedback });
      return false;
    }

    log.warn('Reviewer did not emit expected signal');
    return false;
  };

  try {
    return await withTimeout(run, CONFIG.agentTimeoutMs, 'Reviewer');
  } catch (err) {
    log.error('Reviewer failed', { error: err instanceof Error ? err : new Error(String(err)) });
    return false;
  }
}

/**
 * Run the complete improvement cycle.
 */
export async function runImprovementCycle(
  deps: HarnessDeps,
  options: HarnessOptions = {}
): Promise<HarnessResult> {
  const { logger } = deps;
  const maxFeatures = options.maxFeatures ?? 5;
  const scope = options.scope;

  const log = logger.child({ component: 'harness' });

  log.info('Starting improvement cycle', { maxFeatures, scope: scope ?? 'all' });

  // Phase 1: Initialize
  const featureCount = await runInitializer(deps, scope);
  if (featureCount <= 0) {
    log.warn('No features discovered or initialization failed');
    return { featuresCompleted: 0, featuresBlocked: 0, totalIterations: 0 };
  }

  // Phase 2 & 3: Code -> Review loop
  let completed = 0;
  let blocked = 0;
  let consecutiveBlocks = 0;
  let iterations = 0;

  while (completed < maxFeatures && consecutiveBlocks < CONFIG.maxConsecutiveBlocks) {
    iterations++;

    log.debug('Starting iteration', { iteration: iterations, completed, blocked });

    // Run Coding Agent
    const result = await runCodingAgent(deps);
    if (!result) {
      blocked++;
      consecutiveBlocks++;
      log.warn('Feature blocked', {
        consecutiveBlocks,
        maxConsecutive: CONFIG.maxConsecutiveBlocks,
      });
      continue;
    }

    // Reset consecutive block counter on success
    consecutiveBlocks = 0;

    const { featureId, impact } = result;

    // Gatekeeper pattern: skip Reviewer for LOW impact features
    if (impact === 'low') {
      log.info('LOW impact feature auto-approved (skipping Reviewer)', { featureId });
      completed++;
      continue;
    }

    // HIGH/MEDIUM: run Reviewer
    const approved = await runReviewer(deps, featureId);
    if (approved) {
      completed++;
      log.info('Feature completed', { featureId, completed, maxFeatures });
    } else {
      log.info('Feature needs revision', { featureId });
    }
  }

  if (consecutiveBlocks >= CONFIG.maxConsecutiveBlocks) {
    log.error('Stopping: too many consecutive blocks', { consecutiveBlocks });
  }

  log.info('Cycle complete', {
    featuresCompleted: completed,
    featuresBlocked: blocked,
    totalIterations: iterations,
  });

  return { featuresCompleted: completed, featuresBlocked: blocked, totalIterations: iterations };
}
