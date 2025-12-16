/**
 * Doctor command - validate environment setup.
 */

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { getAppEnv } from '../env';
import { output } from '../output';

const execAsync = promisify(exec);

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
  required: boolean;
}

/**
 * Execute the doctor command.
 */
export async function runDoctor(): Promise<void> {
  const projectRoot = process.cwd();
  const checks: CheckResult[] = [];

  output.header('ENVIRONMENT CHECK');

  // Check ANTHROPIC_API_KEY
  checks.push(await checkApiKey());

  // Check Bun
  checks.push(await checkBun());

  // Check Node.js
  checks.push(await checkNode());

  // Check Git
  checks.push(await checkGit());

  // Check verify.sh
  checks.push(checkVerifyScript(projectRoot));

  // Check instructions directory
  checks.push(checkInstructionsDir(projectRoot));

  // Report results
  output.info('\nResults:');

  let allPassed = true;
  let requiredFailed = false;

  for (const check of checks) {
    const status = check.passed ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
    const required = check.required ? '' : ' (optional)';
    output.dim(`  ${status} ${check.name}${required}`);
    output.dim(`      ${check.message}`);

    if (!check.passed) {
      allPassed = false;
      if (check.required) {
        requiredFailed = true;
      }
    }
  }

  // Summary
  output.info('');
  if (allPassed) {
    output.success('All checks passed! Environment is ready.');
  } else if (requiredFailed) {
    output.error('Required checks failed. Please fix the issues above.');
    process.exit(1);
  } else {
    output.warn('Some optional checks failed. Core functionality should work.');
  }
}

async function checkApiKey(): Promise<CheckResult> {
  const env = await getAppEnv();
  const apiKey = env.get('ANTHROPIC_API_KEY');
  return {
    name: 'ANTHROPIC_API_KEY',
    passed: Boolean(apiKey),
    message: apiKey
      ? `Set (${apiKey.slice(0, 8)}...)`
      : 'Not set. Export ANTHROPIC_API_KEY or add to .env.local',
    required: true,
  };
}

async function checkBun(): Promise<CheckResult> {
  try {
    const { stdout } = await execAsync('bun --version');
    const version = stdout.trim();
    return {
      name: 'Bun runtime',
      passed: true,
      message: `v${version}`,
      required: true,
    };
  } catch {
    return {
      name: 'Bun runtime',
      passed: false,
      message: 'Not found. Install from https://bun.sh',
      required: true,
    };
  }
}

async function checkNode(): Promise<CheckResult> {
  try {
    const { stdout } = await execAsync('node --version');
    const version = stdout.trim().replace('v', '');
    const major = Number.parseInt(version.split('.')[0], 10);
    const passed = major >= 22;
    return {
      name: 'Node.js',
      passed,
      message: passed ? `v${version}` : `v${version} (requires >= 22 for verify.sh)`,
      required: false,
    };
  } catch {
    return {
      name: 'Node.js',
      passed: false,
      message: 'Not found',
      required: false,
    };
  }
}

async function checkGit(): Promise<CheckResult> {
  try {
    const { stdout } = await execAsync('git --version');
    const match = stdout.match(/git version (\d+\.\d+\.\d+)/);
    const version = match?.[1] ?? 'unknown';
    return {
      name: 'Git',
      passed: true,
      message: `v${version}`,
      required: true,
    };
  } catch {
    return {
      name: 'Git',
      passed: false,
      message: 'Not found. Install git.',
      required: true,
    };
  }
}

function checkVerifyScript(projectRoot: string): CheckResult {
  const verifyPath = join(projectRoot, 'verify.sh');
  const exists = existsSync(verifyPath);
  return {
    name: 'verify.sh',
    passed: exists,
    message: exists
      ? 'Present at project root'
      : 'Not found. The agent needs this to verify changes.',
    required: true,
  };
}

function checkInstructionsDir(projectRoot: string): CheckResult {
  const instructionsPath = join(projectRoot, 'instructions');
  const exists = existsSync(instructionsPath);
  return {
    name: 'Instructions directory',
    passed: exists,
    message: exists
      ? 'Present at project root'
      : 'Not found. Create instructions/ directory for the agent.',
    required: true,
  };
}
