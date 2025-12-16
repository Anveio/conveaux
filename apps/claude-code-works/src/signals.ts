/**
 * Signal parsing utilities.
 *
 * Parses structured text output from agents into typed coordination signals.
 * Agents output signals in a simple KEY:value format that's easy to parse.
 *
 * Signal formats:
 * - INITIALIZATION_COMPLETE:featureCount=5
 * - FEATURE_READY:id=F001
 * - FEATURE_BLOCKED:id=F001:reason=verification failed
 * - APPROVED:id=F001
 * - REJECTED:id=F001:feedback=missing test coverage
 */

import type { CoordinationSignal } from './contracts/index.js';

/**
 * Safely get a match group, returning empty string if undefined.
 */
function getMatchGroup(match: RegExpMatchArray, index: number): string {
  return match[index] ?? '';
}

/**
 * Parse a single line of agent output for a signal.
 *
 * @param line - A single line of agent output
 * @returns The parsed signal, or null if no signal found
 */
export function parseSignalLine(line: string): CoordinationSignal | null {
  const trimmed = line.trim();

  // INITIALIZATION_COMPLETE:featureCount=N
  const initMatch = trimmed.match(/^INITIALIZATION_COMPLETE:featureCount=(\d+)$/);
  if (initMatch) {
    return {
      type: 'INITIALIZATION_COMPLETE',
      featureCount: Number.parseInt(getMatchGroup(initMatch, 1), 10),
    };
  }

  // FEATURE_READY:id=XXX
  const readyMatch = trimmed.match(/^FEATURE_READY:id=(\S+)$/);
  if (readyMatch) {
    return {
      type: 'FEATURE_READY',
      featureId: getMatchGroup(readyMatch, 1),
    };
  }

  // FEATURE_BLOCKED:id=XXX:reason=YYY
  const blockedMatch = trimmed.match(/^FEATURE_BLOCKED:id=(\S+):reason=(.+)$/);
  if (blockedMatch) {
    return {
      type: 'FEATURE_BLOCKED',
      featureId: getMatchGroup(blockedMatch, 1),
      reason: getMatchGroup(blockedMatch, 2),
    };
  }

  // APPROVED:id=XXX
  const approvedMatch = trimmed.match(/^APPROVED:id=(\S+)$/);
  if (approvedMatch) {
    return {
      type: 'APPROVED',
      featureId: getMatchGroup(approvedMatch, 1),
    };
  }

  // REJECTED:id=XXX:feedback=YYY
  const rejectedMatch = trimmed.match(/^REJECTED:id=(\S+):feedback=(.+)$/);
  if (rejectedMatch) {
    return {
      type: 'REJECTED',
      featureId: getMatchGroup(rejectedMatch, 1),
      feedback: getMatchGroup(rejectedMatch, 2),
    };
  }

  return null;
}

/**
 * Parse all signals from agent output text.
 *
 * @param output - Full agent output (may contain multiple lines)
 * @returns Array of all signals found
 */
export function parseSignals(output: string): CoordinationSignal[] {
  const signals: CoordinationSignal[] = [];

  for (const line of output.split('\n')) {
    const signal = parseSignalLine(line);
    if (signal) {
      signals.push(signal);
    }
  }

  return signals;
}

/**
 * Extract a specific signal type from agent output.
 *
 * @param output - Full agent output
 * @param type - Signal type to find
 * @returns The first matching signal, or null if not found
 */
export function extractSignal<T extends CoordinationSignal['type']>(
  output: string,
  type: T
): Extract<CoordinationSignal, { type: T }> | null {
  const signals = parseSignals(output);
  const found = signals.find((s) => s.type === type);
  // Convert undefined to null for consistent null return type
  return (found ?? null) as Extract<CoordinationSignal, { type: T }> | null;
}
