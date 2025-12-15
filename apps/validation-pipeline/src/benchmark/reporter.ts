/**
 * Benchmark results reporter.
 * Formats benchmark data for interactive (table) or headless (machine-readable) output.
 */

import type { BenchmarkResults } from './contracts.js';

/**
 * Format a duration in milliseconds to a human-readable string.
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Format a number with thousands separators.
 */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/**
 * Pad a string to a given length.
 */
function pad(str: string, length: number, align: 'left' | 'right' = 'left'): string {
  if (align === 'right') {
    return str.padStart(length);
  }
  return str.padEnd(length);
}

/**
 * Report benchmark results in interactive mode (formatted table).
 */
function reportInteractive(results: BenchmarkResults): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('BENCHMARK RESULTS');
  lines.push('='.repeat(40));
  lines.push(`${pad('Stage', 12)} | ${pad('Duration', 10)} | ${pad('Tokens', 9, 'right')}`);
  lines.push(`${'-'.repeat(12)}-+-${'-'.repeat(10)}-+-${'-'.repeat(9)}`);

  for (const stage of results.stages) {
    const duration = pad(formatDuration(stage.durationMs), 10);
    const tokens = pad(formatNumber(stage.tokens.inputTokens), 9, 'right');

    lines.push(`${pad(stage.stage, 12)} | ${duration} | ${tokens}`);
  }

  lines.push(`${'-'.repeat(12)}-+-${'-'.repeat(10)}-+-${'-'.repeat(9)}`);

  // Totals row
  const totalDuration = pad(formatDuration(results.totalDurationMs), 10);
  const totalTokens = pad(formatNumber(results.totalTokens), 9, 'right');

  lines.push(`${pad('TOTAL', 12)} | ${totalDuration} | ${totalTokens}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Report benchmark results in headless mode (machine-readable).
 */
function reportHeadless(results: BenchmarkResults): string {
  const lines: string[] = [];

  lines.push('BENCHMARK:START');

  for (const stage of results.stages) {
    lines.push(
      `BENCHMARK:STAGE:${stage.stage}:duration_ms=${stage.durationMs}:tokens=${stage.tokens.inputTokens}`
    );
  }

  lines.push(
    `BENCHMARK:TOTAL:duration_ms=${results.totalDurationMs}:tokens=${results.totalTokens}`
  );
  lines.push('BENCHMARK:END');

  return lines.join('\n');
}

/**
 * Report benchmark results to stdout.
 *
 * @param results - Benchmark results to report
 * @param ui - Whether interactive mode is enabled
 */
export function reportBenchmarks(results: BenchmarkResults, ui: boolean): void {
  const output = ui ? reportInteractive(results) : reportHeadless(results);
  console.log(output);
}
