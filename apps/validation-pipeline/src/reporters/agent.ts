/**
 * Agent reporter - minimal output optimized for LLM agents.
 *
 * Design principles:
 * - Success produces exactly 1 line (~30 tokens)
 * - Failure produces structured, actionable output
 * - No intermediate progress noise
 */

import type { PipelineResult, StageExecutionResult, StageName } from '../contracts/index.js';

/**
 * Report the start of the pipeline.
 * Agent mode: silent (no output).
 */
export function reportPipelineStart(): void {
  // Silent - agents don't need progress indication
}

/**
 * Report the start of a stage.
 * Agent mode: silent (no output).
 */
export function reportStageStart(_stageName: StageName): void {
  // Silent - agents don't need per-stage progress
}

/**
 * Report a stage result.
 * Agent mode: silent for success, structured for failure.
 */
export function reportStageResult(_result: StageExecutionResult): void {
  // Silent - all output deferred to reportPipelineResult
}

/**
 * Report pipeline result summary.
 * This is the ONLY output in agent mode.
 */
export function reportPipelineResult(result: PipelineResult): void {
  if (result.success) {
    // Single line output for success - minimal tokens
    console.log(`VERIFY:PASS:duration_ms=${result.totalDurationMs}`);
  } else {
    // Structured failure output for agent parsing
    console.log(`VERIFY:FAIL:stage=${result.failedStage}:duration_ms=${result.totalDurationMs}`);

    // Find the failed stage result
    const failedResult = result.stages.find((s) => s.stage === result.failedStage);
    if (failedResult?.errors && failedResult.errors.length > 0) {
      // Output each error on its own line with structured format
      for (const error of failedResult.errors) {
        // Try to extract file:line from common error formats
        const structured = parseErrorLine(error);
        if (structured) {
          console.log(structured);
        } else {
          console.log(`ERROR:${error}`);
        }
      }
    }

    // Provide actionable hint based on failed stage
    const hint = getStageHint(result.failedStage);
    if (hint) {
      console.log(`HINT:${hint}`);
    }
  }
}

/**
 * Parse an error line into structured format.
 * Returns null if the line doesn't match known patterns.
 */
function parseErrorLine(line: string): string | null {
  // TypeScript error: src/foo.ts(42,5): error TS2345: ...
  const tsMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/);
  if (tsMatch) {
    const [, file, lineNum, col, code, message] = tsMatch;
    return `ERROR:file=${file}:line=${lineNum}:col=${col}:code=${code}:${message}`;
  }

  // TypeScript error (alternative): src/foo.ts:42:5 - error TS2345: ...
  const tsMatch2 = line.match(/^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/);
  if (tsMatch2) {
    const [, file, lineNum, col, code, message] = tsMatch2;
    return `ERROR:file=${file}:line=${lineNum}:col=${col}:code=${code}:${message}`;
  }

  // Biome lint error: src/foo.ts:42:5 lint/... FIXABLE
  const biomeMatch = line.match(/^(.+?):(\d+):(\d+)\s+(lint\/\S+)/);
  if (biomeMatch) {
    const [, file, lineNum, col, rule] = biomeMatch;
    return `ERROR:file=${file}:line=${lineNum}:col=${col}:rule=${rule}`;
  }

  // Jest/Vitest failure: FAIL src/foo.test.ts
  const testMatch = line.match(/^FAIL\s+(.+\.(?:test|spec)\.[jt]sx?)$/);
  if (testMatch) {
    const [, file] = testMatch;
    return `ERROR:file=${file}:test_failed`;
  }

  return null;
}

/**
 * Get an actionable hint for a failed stage.
 */
function getStageHint(stage: StageName | undefined): string | null {
  switch (stage) {
    case 'check':
      return 'run=node --version && npm --version';
    case 'install':
      return 'run=npm install';
    case 'lint':
      return 'run=npm run lint';
    case 'typecheck':
      return 'run=npm run typecheck';
    case 'build':
      return 'run=npm run build';
    case 'test':
      return 'run=npm run test';
    default:
      return null;
  }
}
