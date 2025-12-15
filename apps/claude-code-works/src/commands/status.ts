/**
 * Status command - show repository state, lessons, IPs, and verification status.
 */

import { exec } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { output } from '../output';

const execAsync = promisify(exec);

/**
 * Execute the status command.
 */
export async function runStatus(): Promise<void> {
  const projectRoot = process.cwd();

  output.header('REPOSITORY STATUS');

  // Git status
  await showGitStatus(projectRoot);

  // Lessons count
  showLessonsStatus(projectRoot);

  // Improvement proposals
  showIPStatus(projectRoot);

  // Verification status
  await showVerificationStatus(projectRoot);

  // Config status
  showConfigStatus(projectRoot);
}

async function showGitStatus(projectRoot: string): Promise<void> {
  output.info('\nGit Status:');

  try {
    const { stdout: branch } = await execAsync('git branch --show-current', {
      cwd: projectRoot,
    });
    output.dim(`  Branch: ${branch.trim()}`);

    const { stdout: status } = await execAsync('git status --porcelain', {
      cwd: projectRoot,
    });
    const changes = status.trim().split('\n').filter(Boolean).length;
    output.dim(`  Uncommitted changes: ${changes}`);

    const { stdout: log } = await execAsync('git log -1 --format="%h %s"', {
      cwd: projectRoot,
    });
    output.dim(`  Last commit: ${log.trim()}`);
  } catch {
    output.warn('  Unable to get git status');
  }
}

function showLessonsStatus(projectRoot: string): void {
  output.info('\nLessons:');

  const lessonsPath = join(projectRoot, 'instructions/improvements/lessons.md');
  if (!existsSync(lessonsPath)) {
    output.dim('  No lessons.md found');
    return;
  }

  try {
    const content = readFileSync(lessonsPath, 'utf-8');
    const lessonMatches = content.match(/### L-\d+:/g);
    const count = lessonMatches?.length ?? 0;
    output.dim(`  Recorded lessons: ${count}`);

    // Extract domains
    const domainMatch = content.match(
      /## Index\n\n\|[^|]+\|[^|]+\|[^|]+\|\n\|[^|]+\|[^|]+\|[^|]+\|\n([\s\S]*?)\n\n---/
    );
    if (domainMatch) {
      const domains = domainMatch[1]
        .split('\n')
        .filter((line) => line.startsWith('|'))
        .map((line) => {
          const parts = line.split('|').filter(Boolean);
          return parts[0]?.trim();
        })
        .filter(Boolean);
      if (domains.length > 0) {
        output.dim(`  Domains: ${domains.join(', ')}`);
      }
    }
  } catch {
    output.warn('  Unable to read lessons.md');
  }
}

function showIPStatus(projectRoot: string): void {
  output.info('\nImprovement Proposals:');

  const proposalsPath = join(projectRoot, 'instructions/improvements/proposals');
  if (!existsSync(proposalsPath)) {
    output.dim('  No proposals directory found');
    return;
  }

  try {
    const files = readdirSync(proposalsPath).filter(
      (f) => f.startsWith('IP-') && f.endsWith('.md')
    );

    if (files.length === 0) {
      output.dim('  No proposals found');
      return;
    }

    let draftCount = 0;
    let implementedCount = 0;

    for (const file of files) {
      const content = readFileSync(join(proposalsPath, file), 'utf-8');
      if (content.includes('Status**: draft') || content.includes('Status: draft')) {
        draftCount++;
      } else if (
        content.includes('Status**: implemented') ||
        content.includes('Status: implemented')
      ) {
        implementedCount++;
      }
    }

    output.dim(`  Total: ${files.length}`);
    output.dim(`  Draft: ${draftCount}`);
    output.dim(`  Implemented: ${implementedCount}`);
  } catch {
    output.warn('  Unable to read proposals');
  }
}

async function showVerificationStatus(projectRoot: string): Promise<void> {
  output.info('\nVerification:');

  const verifyPath = join(projectRoot, 'verify.sh');
  if (!existsSync(verifyPath)) {
    output.dim('  No verify.sh found');
    return;
  }

  output.dim('  verify.sh: present');
  output.dim('  Run ./verify.sh --ui=false to check status');
}

function showConfigStatus(projectRoot: string): void {
  output.info('\nConfiguration:');

  const configPath = join(projectRoot, '.claude-code-works.json');
  if (existsSync(configPath)) {
    output.dim('  Config file: .claude-code-works.json');
    try {
      const content = JSON.parse(readFileSync(configPath, 'utf-8'));
      if (content.model) {
        output.dim(`  Model: ${content.model}`);
      }
    } catch {
      output.dim('  Config file: present (parse error)');
    }
  } else {
    output.dim('  Config file: not found (using defaults)');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  output.dim(`  ANTHROPIC_API_KEY: ${apiKey ? 'set' : 'NOT SET'}`);
}
