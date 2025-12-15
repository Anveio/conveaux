/**
 * Hermetic stage - detects disallowed global references in packages.
 *
 * Enforces the hermetic primitive port pattern by flagging direct usage
 * of platform globals that should be abstracted through contracts.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput } from '../utils/exec.js';
import { scanFileForGlobals } from './hermetic/scanner.js';
import type { HermeticViolation } from './hermetic/types.js';

/**
 * Hardcoded list of globals that should not be used directly in packages.
 * These should be abstracted through runtime-agnostic contracts.
 */
const BLOCKED_GLOBALS = new Set([
  // Encoding
  'TextEncoder',
  'TextDecoder',
  // Networking
  'fetch',
  'Request',
  'Response',
  'Headers',
  // Timers
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval',
  // URLs
  'URL',
  'URLSearchParams',
  // Crypto (Web Crypto API global)
  'crypto',
  // Process/Buffer
  'Buffer',
  'process',
  // I/O
  'console',
  // Abort
  'AbortController',
  'AbortSignal',
  // Time
  'Date',
  'performance',
]);

export const hermeticStage: Stage = {
  name: 'hermetic',
  description: 'Detect disallowed global references in packages',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();

    // Find all TypeScript files in packages/*/src
    const packagesDir = path.join(context.projectRoot, 'packages');
    const filesToScan = await findTypeScriptFiles(packagesDir);

    const violations: HermeticViolation[] = [];

    // Scan files in parallel for speed
    await Promise.all(
      filesToScan.map(async (filePath) => {
        const content = await fs.readFile(filePath, 'utf-8');
        const fileViolations = scanFileForGlobals(filePath, content, BLOCKED_GLOBALS);
        violations.push(...fileViolations);
      })
    );

    const durationMs = Date.now() - startTime;

    if (violations.length > 0) {
      const errors = violations.map((v) => formatViolation(v, context.projectRoot));

      return {
        success: false,
        message: `Found ${violations.length} disallowed global reference(s)`,
        durationMs,
        errors: errors.slice(0, 20), // Cap at 20 errors to avoid overwhelming output
        output: context.benchmark
          ? { stdout: capOutput(errors.join('\n')), stderr: '' }
          : undefined,
      };
    }

    return {
      success: true,
      message: `Hermetic check passed (${filesToScan.length} files scanned)`,
      durationMs,
      output: context.benchmark
        ? { stdout: `Scanned ${filesToScan.length} files`, stderr: '' }
        : undefined,
    };
  },
};

/**
 * Recursively find all TypeScript files in packages/[name]/src directories.
 * Excludes test files and declaration files.
 */
async function findTypeScriptFiles(packagesDir: string): Promise<string[]> {
  const files: string[] = [];

  let packageDirs: string[];
  try {
    packageDirs = await fs.readdir(packagesDir);
  } catch {
    // packages directory doesn't exist - nothing to scan
    return files;
  }

  for (const packageName of packageDirs) {
    const srcDir = path.join(packagesDir, packageName, 'src');

    try {
      await fs.access(srcDir);
    } catch {
      // No src directory in this package
      continue;
    }

    await collectTypeScriptFiles(srcDir, files);
  }

  return files;
}

/**
 * Recursively collect TypeScript files from a directory.
 */
async function collectTypeScriptFiles(dir: string, files: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip __tests__ directories
      if (entry.name === '__tests__') continue;
      await collectTypeScriptFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      // Skip test and declaration files
      if (entry.name.endsWith('.test.ts')) continue;
      if (entry.name.endsWith('.spec.ts')) continue;
      if (entry.name.endsWith('.d.ts')) continue;

      files.push(fullPath);
    }
  }
}

/**
 * Format a violation as a human-readable error message.
 */
function formatViolation(v: HermeticViolation, projectRoot: string): string {
  const relativePath = path.relative(projectRoot, v.filePath);
  return `${relativePath}:${v.line}:${v.column} - Use of global '${v.globalName}' not allowed. To fix: create a runtime-agnostic contract package or depend on an existing one.`;
}
