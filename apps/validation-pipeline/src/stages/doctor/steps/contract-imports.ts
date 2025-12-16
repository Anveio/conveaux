/**
 * Contract imports doctor step - detects runtime imports of contract packages.
 *
 * Contract packages (@conveaux/contract-*) should ONLY be imported with
 * `import type`. Runtime imports like `import()` or `typeof import()` violate
 * the contract-port architecture pattern.
 *
 * This step cannot autofix - violations require manual review to understand
 * the proper fix (usually exporting a type alias from the contract).
 */

import { execCommand } from '../../../utils/exec.js';
import type { DoctorContext, DoctorIssue, DoctorStep, DoctorStepResult } from '../types.js';

/**
 * Patterns that indicate improper contract imports.
 * These should never appear in source files.
 */
const FORBIDDEN_PATTERNS = [
  // Dynamic import of contract packages
  String.raw`import\(['"]@conveaux/contract-`,
  // typeof import() - should use proper type imports
  String.raw`typeof import\(['"]@conveaux/contract-`,
];

/**
 * Parse ripgrep output to extract file:line:content format.
 */
function parseGrepOutput(output: string): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ripgrep format: file:line:column:content
    const match = trimmed.match(/^(.+?):(\d+):\d+:(.*)$/);
    if (match) {
      const [, file, lineNum, content] = match;
      const contentStr = content ?? '';
      issues.push({
        file: file,
        description: `Line ${lineNum}: Runtime contract import - use \`import type\` instead: ${contentStr.trim().slice(0, 60)}...`,
        fixed: false,
      });
    }
  }

  return issues;
}

export const contractImportsStep: DoctorStep = {
  name: 'contract-imports',
  description: 'Detect runtime imports of contract packages (should be type-only)',

  async run(context: DoctorContext): Promise<DoctorStepResult> {
    const startTime = context.clock.nowMs();

    // Build ripgrep command to search for forbidden patterns
    // Exclude .d.ts files, node_modules, dist
    const pattern = FORBIDDEN_PATTERNS.join('|');
    const command = [
      'npx rg',
      '--no-ignore', // Don't use gitignore (we want to check all source)
      '--type ts',
      `--glob '!*.d.ts'`,
      `--glob '!node_modules/**'`,
      `--glob '!dist/**'`,
      '--line-number',
      '--column',
      `'${pattern}'`,
      'packages/',
      'apps/',
    ].join(' ');

    const result = await execCommand(command, context.projectRoot);
    const durationMs = context.clock.nowMs() - startTime;

    // ripgrep exits with 1 when no matches found (which is success for us)
    // exits with 0 when matches are found (which means violations)
    if (result.exitCode === 1 && result.stdout.trim() === '') {
      return {
        success: true,
        message: 'No runtime contract imports found',
        issues: [],
        durationMs,
      };
    }

    // Exit code 0 or non-empty output means violations found
    if (result.exitCode === 0 || result.stdout.trim()) {
      const issues = parseGrepOutput(result.stdout);

      // This step cannot autofix - violations require manual code changes
      return {
        success: false,
        message: `Found ${issues.length} runtime contract import(s) - contracts should only be imported with \`import type\``,
        issues,
        durationMs,
      };
    }

    // Exit code 2+ indicates an error with ripgrep itself
    if (result.exitCode >= 2) {
      return {
        success: false,
        message: `Error running contract import check: ${result.stderr}`,
        issues: [],
        durationMs,
      };
    }

    // Default case - no issues
    return {
      success: true,
      message: 'No runtime contract imports found',
      issues: [],
      durationMs,
    };
  },
};
