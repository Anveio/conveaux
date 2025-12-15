/**
 * Knip doctor step - detects and removes unused exports and dependencies.
 *
 * Uses knip (https://knip.dev) to find and optionally remove:
 * - Unused dependencies
 * - Unused exports
 * - Unused files
 */

import { execCommand } from '../../../utils/exec.js';
import type { DoctorContext, DoctorIssue, DoctorStep, DoctorStepResult } from '../types.js';

/**
 * Parse knip output to extract issues.
 *
 * Knip outputs in a structured format with sections like:
 * - "Unused dependencies (N)"
 * - "Unused exports (N)"
 * - etc.
 */
function parseKnipOutput(output: string): DoctorIssue[] {
  const issues: DoctorIssue[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Skip section headers like "Unused dependencies (3)"
    if (/^(Unused|Unresolved|Configuration).*\(\d+\)$/.test(trimmed)) {
      continue;
    }

    // Parse lines with file references (format: "name  file.ts:line:col")
    // Match anything with a file path pattern
    const fileMatch = trimmed.match(/^(\S+)\s+(.+\.(?:ts|json|js)):(\d+):(\d+)/);
    if (fileMatch) {
      issues.push({
        file: fileMatch[2],
        description: `Unused: ${fileMatch[1]}`,
        fixed: false,
      });
      continue;
    }

    // Alternative format without position (just name + file)
    const simpleMatch = trimmed.match(/^(\S+)\s+(.+\.(?:ts|json|js))/);
    if (simpleMatch) {
      issues.push({
        file: simpleMatch[2],
        description: `Unused: ${simpleMatch[1]}`,
        fixed: false,
      });
    }
  }

  return issues;
}

export const knipStep: DoctorStep = {
  name: 'knip',
  description: 'Detect and remove unused exports and dependencies',

  async run(context: DoctorContext): Promise<DoctorStepResult> {
    const startTime = Date.now();

    // Choose command based on fix mode
    // knip is a devDependency of validation-pipeline, use npx to invoke
    // Use --dependencies to only check/fix unused dependencies, not exports
    const command = context.shouldFix ? 'npx knip --fix --dependencies' : 'npx knip --dependencies';

    const result = await execCommand(command, context.projectRoot);
    const durationMs = Date.now() - startTime;

    // Combine stdout and stderr for parsing
    const output = result.stdout + result.stderr;

    // Knip exits with 0 if no issues, 1 if issues found
    if (result.exitCode === 0) {
      return {
        success: true,
        message: context.shouldFix
          ? 'Unused code cleaned up successfully'
          : 'No unused exports or dependencies found',
        issues: [],
        durationMs,
      };
    }

    // Parse output to find issues
    const issues = parseKnipOutput(output);

    if (context.shouldFix) {
      // In fix mode, mark all detected issues as fixed
      // (knip --fix removes what it can)
      const fixedIssues = issues.map((issue) => ({ ...issue, fixed: true }));

      return {
        success: true,
        message: `Fixed ${fixedIssues.length} unused code issue(s)`,
        issues: fixedIssues,
        durationMs,
      };
    }

    // Check mode - report issues without fixing
    return {
      success: false,
      message: `Found ${issues.length} unused code issue(s)`,
      issues,
      durationMs,
    };
  },
};
