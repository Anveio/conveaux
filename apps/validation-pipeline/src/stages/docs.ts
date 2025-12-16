/**
 * Docs stage - validates CLAUDE.md structure.
 *
 * Ensures:
 * 1. CLAUDE.md exists
 * 2. Contains required sections (Project Rules)
 * 3. References the rsid skill for development workflow
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Stage, StageContext, StageResult } from '../contracts/index.js';

/**
 * Required sections that must appear in CLAUDE.md.
 */
const REQUIRED_SECTIONS = ['## Project Rules'];

/**
 * Skills that should be referenced in CLAUDE.md.
 */
const EXPECTED_SKILLS = ['rsid'];

export const docsStage: Stage = {
  name: 'docs',
  description: 'Validate CLAUDE.md structure',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = context.clock.nowMs();
    const errors: string[] = [];

    const claudeMdPath = join(context.projectRoot, 'CLAUDE.md');

    // 1. Read CLAUDE.md
    let content: string;
    try {
      content = await readFile(claudeMdPath, 'utf-8');
    } catch {
      return {
        success: false,
        message: 'CLAUDE.md not found',
        durationMs: context.clock.nowMs() - startTime,
        errors: ['CLAUDE.md file not found in project root'],
      };
    }

    // 2. Check required sections
    for (const section of REQUIRED_SECTIONS) {
      if (!content.includes(section)) {
        errors.push(`MISSING SECTION: ${section}`);
      }
    }

    // 3. Check expected skills are referenced
    for (const skill of EXPECTED_SKILLS) {
      if (!content.includes(skill)) {
        errors.push(`MISSING SKILL: ${skill} not referenced in CLAUDE.md`);
      }
    }

    // 4. Warn if old-style instruction imports are present (should be archived)
    const instructionImports = content.match(/@instructions\/[^\s]+/g);
    if (instructionImports && instructionImports.length > 0) {
      for (const imp of instructionImports) {
        errors.push(`LEGACY IMPORT: ${imp} - instructions should be archived, use skills instead`);
      }
    }

    const durationMs = context.clock.nowMs() - startTime;

    if (errors.length > 0) {
      return {
        success: false,
        message: `Found ${errors.length} CLAUDE.md issue(s)`,
        durationMs,
        errors,
      };
    }

    return {
      success: true,
      message: 'CLAUDE.md structure validated',
      durationMs,
    };
  },
};
