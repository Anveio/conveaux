/**
 * Docs stage - validates CLAUDE.md imports match instructions/ directory.
 *
 * Ensures:
 * 1. All instruction files are imported (no missing)
 * 2. No imports reference non-existent files (no extra)
 * 3. Exclusion patterns are respected (proposals, templates)
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Stage, StageContext, StageResult } from '../contracts/index.js';

/**
 * Patterns for files that should NOT be imported into CLAUDE.md.
 * These are intentionally excluded to avoid context bloat.
 */
const EXCLUSION_PATTERNS: RegExp[] = [
  /^instructions\/improvements\/proposals\/.+\.md$/, // Historical IPs
  /\.tmpl$/, // Template files
];

/**
 * Check if a file path matches any exclusion pattern.
 */
function isExcluded(filePath: string): boolean {
  return EXCLUSION_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Recursively find all .md files in a directory.
 */
async function findMarkdownFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relativePath = fullPath.slice(baseDir.length + 1); // Remove base dir prefix

    if (entry.isDirectory()) {
      const subFiles = await findMarkdownFiles(fullPath, baseDir);
      results.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      // Use forward slashes for consistency
      results.push(relativePath.replace(/\\/g, '/'));
    }
  }

  return results;
}

/**
 * Extract @instructions/... imports from CLAUDE.md content.
 */
function extractImports(content: string): string[] {
  const matches = content.match(/@instructions\/[^\s]+/g);
  if (!matches) {
    return [];
  }
  // Remove @ prefix and return unique paths
  return [...new Set(matches.map((match) => match.slice(1)))];
}

/**
 * Check if a file exists.
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export const docsStage: Stage = {
  name: 'docs',
  description: 'Validate CLAUDE.md instruction imports',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    const claudeMdPath = join(context.projectRoot, 'CLAUDE.md');
    const instructionsDir = join(context.projectRoot, 'instructions');

    // 1. Read CLAUDE.md
    let claudeMdContent: string;
    try {
      claudeMdContent = await readFile(claudeMdPath, 'utf-8');
    } catch {
      return {
        success: false,
        message: 'CLAUDE.md not found',
        durationMs: Date.now() - startTime,
        errors: ['CLAUDE.md file not found in project root'],
      };
    }

    // 2. Extract imports from CLAUDE.md
    const imports = extractImports(claudeMdContent);

    // 3. Find all .md files in instructions/
    let allInstructionFiles: string[];
    try {
      const rawFiles = await findMarkdownFiles(instructionsDir);
      // Prefix with 'instructions/' to match import format
      allInstructionFiles = rawFiles.map((f) => `instructions/${f}`);
    } catch {
      return {
        success: false,
        message: 'instructions/ directory not found',
        durationMs: Date.now() - startTime,
        errors: ['instructions/ directory not found in project root'],
      };
    }

    // 4. Filter out excluded files
    const expectedFiles = allInstructionFiles.filter((f) => !isExcluded(f));

    // 5. Find missing imports (files exist but not imported)
    const missing = expectedFiles.filter((f) => !imports.includes(f));
    for (const file of missing) {
      errors.push(`MISSING: ${file} exists but is not imported in CLAUDE.md`);
    }

    // 6. Find extra imports (imported but don't exist)
    for (const imp of imports) {
      if (!imp.startsWith('instructions/')) {
        continue; // Skip non-instruction imports
      }

      const fullPath = join(context.projectRoot, imp);
      const exists = await fileExists(fullPath);

      if (!exists) {
        errors.push(`EXTRA: ${imp} is imported in CLAUDE.md but file does not exist`);
      }
    }

    const durationMs = Date.now() - startTime;

    if (errors.length > 0) {
      return {
        success: false,
        message: `Found ${errors.length} instruction import issue(s)`,
        durationMs,
        errors,
      };
    }

    return {
      success: true,
      message: `Verified ${imports.length} instruction imports`,
      durationMs,
    };
  },
};
