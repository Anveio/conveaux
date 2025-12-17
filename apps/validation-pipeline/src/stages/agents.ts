/**
 * Agents stage - validates agent skill assignments.
 *
 * Ensures:
 * 1. All agent files have valid YAML frontmatter
 * 2. Skills referenced by agents exist in .claude/skills/
 * 3. Each agent has required skills for its role
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Stage, StageContext, StageResult } from '../contracts/index.js';

/**
 * Parse YAML-like frontmatter from a markdown file.
 * Returns the parsed fields as key-value pairs.
 */
function parseFrontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = match[1];
  if (!frontmatter) return {};
  const result: Record<string, string> = {};

  for (const line of frontmatter.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      result[key] = value;
    }
  }

  return result;
}

/**
 * Parse comma-separated skills list from frontmatter value.
 */
function parseSkillsList(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Get all skill names from .claude/skills directory.
 */
async function getAvailableSkills(projectRoot: string): Promise<Set<string>> {
  const skillsDir = join(projectRoot, '.claude', 'skills');
  const skills = new Set<string>();

  try {
    const entries = await readdir(skillsDir);
    for (const entry of entries) {
      const skillPath = join(skillsDir, entry);
      const skillStat = await stat(skillPath);
      if (skillStat.isDirectory()) {
        // Check if SKILL.md exists
        try {
          await stat(join(skillPath, 'SKILL.md'));
          skills.add(entry);
        } catch {
          // No SKILL.md, not a valid skill directory
        }
      }
    }
  } catch {
    // Skills directory doesn't exist
  }

  return skills;
}

/**
 * Get all agent files from .claude/agents directory.
 */
async function getAgentFiles(projectRoot: string): Promise<string[]> {
  const agentsDir = join(projectRoot, '.claude', 'agents');
  const agentFiles: string[] = [];

  try {
    const entries = await readdir(agentsDir);
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        agentFiles.push(join(agentsDir, entry));
      }
    }
  } catch {
    // Agents directory doesn't exist
  }

  return agentFiles;
}

/**
 * Expected skills for specific agent types.
 * Agents should have at minimum these skills based on their role.
 *
 * Structure follows the role/task/kpi skill framework:
 * - role-* skills define job responsibilities
 * - task-* skills define procedural workflows
 * - kpi-* skills define measurable targets
 * - Domain skills (no prefix) provide reference knowledge
 */
const EXPECTED_AGENT_SKILLS: Record<string, string[]> = {
  'software-engineer': [
    'role-software-engineer',
    'task-coding-loop',
    'coding-patterns',
    'task-effective-git',
    'task-verification-pipeline',
    'task-pull-request',
    'task-rsid',
    'kpi-pr-throughput',
  ],
  'tsc-reviewer': [
    'role-code-reviewer',
    'coding-patterns',
    'task-effective-git',
    'task-pull-request',
    'kpi-verification-pass-rate',
  ],
  'lint-fixer': [
    'role-software-engineer',
    'typescript-coding',
    'task-verification-pipeline',
    'task-lint-fixer',
    'kpi-code-quality',
  ],
};

export const agentsStage: Stage = {
  name: 'agents',
  description: 'Validate agent skill assignments',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = context.clock.nowMs();
    const errors: string[] = [];

    // 1. Get available skills
    const availableSkills = await getAvailableSkills(context.projectRoot);
    if (availableSkills.size === 0) {
      return {
        success: false,
        message: 'No skills found in .claude/skills/',
        durationMs: context.clock.nowMs() - startTime,
        errors: ['No skill directories with SKILL.md found'],
      };
    }

    // 2. Get all agent files
    const agentFiles = await getAgentFiles(context.projectRoot);
    if (agentFiles.length === 0) {
      return {
        success: true,
        message: 'No agents found to validate',
        durationMs: context.clock.nowMs() - startTime,
      };
    }

    // 3. Validate each agent
    for (const agentPath of agentFiles) {
      const agentName = agentPath.split('/').pop()?.replace('.md', '') ?? 'unknown';

      let content: string;
      try {
        content = await readFile(agentPath, 'utf-8');
      } catch {
        errors.push(`${agentName}: Could not read agent file`);
        continue;
      }

      // Parse frontmatter
      const frontmatter = parseFrontmatter(content);

      // Check for skills field
      if (!frontmatter.skills) {
        errors.push(`${agentName}: Missing 'skills' field in frontmatter`);
        continue;
      }

      // Parse and validate skills
      const agentSkills = parseSkillsList(frontmatter.skills);

      for (const skill of agentSkills) {
        if (!availableSkills.has(skill)) {
          errors.push(`${agentName}: References non-existent skill '${skill}'`);
        }
      }

      // Check expected skills for known agent types
      const expectedSkills = EXPECTED_AGENT_SKILLS[agentName];
      if (expectedSkills) {
        for (const expectedSkill of expectedSkills) {
          if (!agentSkills.includes(expectedSkill)) {
            errors.push(`${agentName}: Missing expected skill '${expectedSkill}'`);
          }
        }
      }
    }

    const durationMs = context.clock.nowMs() - startTime;

    if (errors.length > 0) {
      return {
        success: false,
        message: `Found ${errors.length} agent skill issue(s)`,
        durationMs,
        errors,
      };
    }

    return {
      success: true,
      message: `Validated ${agentFiles.length} agent(s) against ${availableSkills.size} available skills`,
      durationMs,
    };
  },
};
