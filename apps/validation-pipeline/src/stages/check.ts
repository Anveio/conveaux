/**
 * Check stage - validates prerequisites (Node.js, npm, Bun, git).
 */

import type { Stage, StageContext, StageResult } from '../contracts/index.js';
import { capOutput, execCommand } from '../utils/exec.js';
import { type Version, meetsMinimum, parseVersion } from '../utils/version.js';

interface Requirement {
  name: string;
  command: string;
  versionArg: string;
  minimum?: Version;
  optional?: boolean;
}

const REQUIREMENTS: Requirement[] = [
  {
    name: 'Node.js',
    command: 'node',
    versionArg: '--version',
    minimum: { major: 22, minor: 0, patch: 0 },
  },
  {
    name: 'npm',
    command: 'npm',
    versionArg: '--version',
    minimum: { major: 10, minor: 0, patch: 0 },
  },
  {
    name: 'Bun',
    command: 'bun',
    versionArg: '--version',
    optional: true,
  },
  {
    name: 'git',
    command: 'git',
    versionArg: '--version',
  },
];

interface RequirementCheckResult {
  passed: boolean;
  message: string;
  stdout: string;
  stderr: string;
}

async function checkRequirement(req: Requirement, cwd: string): Promise<RequirementCheckResult> {
  const result = await execCommand(`${req.command} ${req.versionArg}`, cwd);

  if (result.exitCode !== 0) {
    if (req.optional) {
      return {
        passed: true,
        message: `${req.name}: not installed (optional)`,
        stdout: result.stdout,
        stderr: result.stderr,
      };
    }
    return {
      passed: false,
      message: `${req.name}: not found`,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  const versionOutput = result.stdout.trim() || result.stderr.trim();
  const version = parseVersion(versionOutput);

  if (!version) {
    return {
      passed: true,
      message: `${req.name}: ${versionOutput}`,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  if (req.minimum && !meetsMinimum(version, req.minimum)) {
    return {
      passed: false,
      message: `${req.name}: ${versionOutput} (requires >= ${req.minimum.major}.${req.minimum.minor}.${req.minimum.patch})`,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  }

  return {
    passed: true,
    message: `${req.name}: ${versionOutput}`,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

export const checkStage: Stage = {
  name: 'check',
  description: 'Validate prerequisites (Node.js, npm, Bun, git)',

  async run(context: StageContext): Promise<StageResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const messages: string[] = [];
    const allStdout: string[] = [];
    const allStderr: string[] = [];

    for (const req of REQUIREMENTS) {
      const result = await checkRequirement(req, context.projectRoot);
      messages.push(result.message);
      allStdout.push(result.stdout);
      allStderr.push(result.stderr);
      if (!result.passed) {
        errors.push(result.message);
      }
    }

    const durationMs = Date.now() - startTime;

    // Capture output for benchmarking
    const capturedOutput = context.benchmark
      ? { stdout: capOutput(allStdout.join('\n')), stderr: capOutput(allStderr.join('\n')) }
      : undefined;

    if (errors.length > 0) {
      return {
        success: false,
        message: `Prerequisite check failed: ${errors.join(', ')}`,
        durationMs,
        errors,
        output: capturedOutput,
      };
    }

    return {
      success: true,
      message: 'All prerequisites satisfied',
      durationMs,
      output: capturedOutput,
    };
  },
};
