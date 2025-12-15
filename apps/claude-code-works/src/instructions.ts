/**
 * Instructions Framework Reader
 *
 * Loads and organizes the instructions from /instructions directory.
 * These instructions tell the agent how to behave.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

export interface InstructionFile {
  path: string;
  relativePath: string;
  content: string;
  category: InstructionCategory;
}

export type InstructionCategory =
  | 'bootstrap' // START.md
  | 'loop' // outer-loop.md, completion-gate.md
  | 'meta' // self-improvement.md
  | 'patterns' // reference/patterns/*
  | 'reference' // reference/*
  | 'improvements' // improvements/lessons.md, proposals/
  | 'verification' // verification/*
  | 'skills' // skills/*
  | 'templates' // living-docs/templates/*
  | 'other';

export interface Instructions {
  files: InstructionFile[];
  byCategory: Map<InstructionCategory, InstructionFile[]>;
  projectRoot: string;

  // Quick access to key files
  startMd: string | null;
  outerLoopMd: string | null;
  completionGateMd: string | null;
  selfImprovementMd: string | null;
  lessonsMd: string | null;
  packageSetupMd: string | null;
}

/**
 * Load all instruction files from the instructions directory.
 */
export async function loadInstructions(projectRoot: string): Promise<Instructions> {
  const instructionsDir = join(projectRoot, 'instructions');
  const files: InstructionFile[] = [];

  await walkDirectory(instructionsDir, async (filePath) => {
    if (!filePath.endsWith('.md')) return;

    const content = await readFile(filePath, 'utf-8');
    const relativePath = relative(instructionsDir, filePath);
    const category = categorizeFile(relativePath);

    files.push({
      path: filePath,
      relativePath,
      content,
      category,
    });
  });

  // Organize by category
  const byCategory = new Map<InstructionCategory, InstructionFile[]>();
  for (const file of files) {
    const existing = byCategory.get(file.category) ?? [];
    existing.push(file);
    byCategory.set(file.category, existing);
  }

  // Quick access to key files
  const findFile = (name: string): string | null => {
    const file = files.find((f) => f.relativePath.endsWith(name));
    return file?.content ?? null;
  };

  return {
    files,
    byCategory,
    projectRoot,
    startMd: findFile('START.md'),
    outerLoopMd: findFile('outer-loop.md'),
    completionGateMd: findFile('completion-gate.md'),
    selfImprovementMd: findFile('self-improvement.md'),
    lessonsMd: findFile('lessons.md'),
    packageSetupMd: findFile('package-setup.md'),
  };
}

/**
 * Get context for a specific task type.
 */
export function getContextForTask(instructions: Instructions, task: 'create' | 'improve'): string {
  const parts: string[] = [];

  // Always include bootstrap
  if (instructions.startMd) {
    parts.push(`# Bootstrap Instructions\n\n${instructions.startMd}`);
  }

  // Always include outer loop
  if (instructions.outerLoopMd) {
    parts.push(`# Development Loop\n\n${instructions.outerLoopMd}`);
  }

  // Always include completion gate
  if (instructions.completionGateMd) {
    parts.push(`# Completion Gate\n\n${instructions.completionGateMd}`);
  }

  // For create tasks, include package setup pattern
  if (task === 'create' && instructions.packageSetupMd) {
    parts.push(`# Package Setup Pattern\n\n${instructions.packageSetupMd}`);
  }

  // Include lessons learned
  if (instructions.lessonsMd) {
    parts.push(`# Lessons Learned\n\n${instructions.lessonsMd}`);
  }

  // Include self-improvement meta loop
  if (instructions.selfImprovementMd) {
    parts.push(`# Self-Improvement (Meta Loop)\n\n${instructions.selfImprovementMd}`);
  }

  return parts.join('\n\n---\n\n');
}

/**
 * Get all patterns for reference.
 */
export function getPatterns(instructions: Instructions): InstructionFile[] {
  return instructions.byCategory.get('patterns') ?? [];
}

/**
 * Categorize a file based on its path.
 */
function categorizeFile(relativePath: string): InstructionCategory {
  if (relativePath === 'START.md') return 'bootstrap';
  if (relativePath.startsWith('loop/')) return 'loop';
  if (relativePath.startsWith('meta/')) return 'meta';
  if (relativePath.startsWith('reference/patterns/')) return 'patterns';
  if (relativePath.startsWith('reference/')) return 'reference';
  if (relativePath.startsWith('improvements/')) return 'improvements';
  if (relativePath.startsWith('verification/')) return 'verification';
  if (relativePath.startsWith('skills/')) return 'skills';
  if (relativePath.startsWith('living-docs/templates/')) return 'templates';
  return 'other';
}

/**
 * Recursively walk a directory and call callback for each file.
 */
async function walkDirectory(
  dir: string,
  callback: (filePath: string) => Promise<void>
): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        await walkDirectory(fullPath, callback);
      } else if (entry.isFile()) {
        await callback(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist, skip
  }
}
