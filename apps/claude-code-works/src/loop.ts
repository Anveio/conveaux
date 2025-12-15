/**
 * The Outer Loop Implementation
 *
 * Follows the instructions framework: PLAN -> IMPLEMENT -> VERIFY -> DECIDE
 *
 * This is the core of the coding agent. It coordinates the Claude agent
 * through the development loop, consulting patterns and recording lessons.
 */

import { runAgent } from './agent';
import { getContextForTask, type Instructions } from './instructions';
import { output } from './output';
import { getErrorMessage } from './type-guards';

export interface LoopConfig {
  mode: 'create' | 'improve';
  projectRoot: string;
  instructions: Instructions;
  maxIterations: number;

  // For 'improve' mode
  targetPackage?: string;

  // For 'create' mode
  packageName?: string;
  packageType?: string;
  description?: string;
}

export interface LoopResult {
  success: boolean;
  iterations: number;
  lessonsRecorded: number;
  packagePath?: string;
  error?: string;
}

/**
 * Run the outer loop: PLAN -> IMPLEMENT -> VERIFY -> DECIDE
 */
export async function runOuterLoop(config: LoopConfig): Promise<LoopResult> {
  const instructionContext = getContextForTask(config.instructions, config.mode);

  // Build the system prompt
  const systemPrompt = buildSystemPrompt(config, instructionContext);

  // Build the initial task
  const task = buildTask(config);

  output.header('OUTER LOOP START');
  output.info(`Mode: ${config.mode}`);
  output.info(`Max iterations: ${config.maxIterations}`);

  let iterations = 0;
  let lessonsRecorded = 0;
  let lastError: string | undefined;

  while (iterations < config.maxIterations) {
    iterations++;
    output.header(`ITERATION ${iterations}`);

    // Run the agent with the task
    const result = await runAgent(
      iterations === 1 ? task : `Continue with the next step. Current iteration: ${iterations}/${config.maxIterations}`,
      {
        systemPrompt,
        maxIterations: 30, // Tool call iterations within a single outer loop iteration
      }
    );

    if (!result.success) {
      output.error(`Agent failed: ${result.error}`);
      lastError = result.error;

      // Check if we should retry
      if (iterations < config.maxIterations) {
        output.warn('Retrying...');
        continue;
      }
      break;
    }

    // Parse the agent's output for signals
    const signals = parseSignals(result.output);

    if (signals.lessonLearned) {
      lessonsRecorded++;
      output.success(`Lesson recorded: ${signals.lessonLearned}`);
    }

    if (signals.verificationPassed) {
      output.success('Verification passed!');
    }

    if (signals.milestoneComplete) {
      output.success('Milestone complete!');

      return {
        success: true,
        iterations,
        lessonsRecorded,
        packagePath: config.mode === 'create'
          ? `${config.projectRoot}/packages/${config.packageName}`
          : config.targetPackage,
      };
    }

    if (signals.blocked) {
      output.warn(`Blocked: ${signals.blocked}`);
      lastError = signals.blocked;
      break;
    }

    // Check if more work needed
    if (!signals.moreWorkNeeded) {
      // Agent didn't indicate more work, might be done
      output.dim('Agent completed iteration without explicit continuation signal');
    }
  }

  // If we got here without success, determine outcome
  const verifyResult = await runVerification(config.projectRoot);

  if (verifyResult.passed) {
    return {
      success: true,
      iterations,
      lessonsRecorded,
      packagePath: config.mode === 'create'
        ? `${config.projectRoot}/packages/${config.packageName}`
        : config.targetPackage,
    };
  }

  return {
    success: false,
    iterations,
    lessonsRecorded,
    error: lastError ?? 'Loop completed without achieving milestone',
  };
}

/**
 * Build the system prompt from instructions.
 */
function buildSystemPrompt(config: LoopConfig, instructionContext: string): string {
  return `You are claude-code-works, an autonomous coding agent that follows the instructions framework for recursive self-improvement.

## Your Environment

- Project root: ${config.projectRoot}
- Mode: ${config.mode}
- You have access to file system tools: read_file, write_file, list_files, run_command, grep

## The Outer Loop

You follow this loop strictly:
1. PLAN: Create/update PLAN.md with your approach
2. IMPLEMENT: Make changes (code, tests, docs)
3. VERIFY: Run ./verify.sh --ui=false
4. DECIDE: Is the milestone complete?

## Completion Gate

You are "done" ONLY when:
1. MILESTONE.md contains: Status: done
2. ./verify.sh --ui=false exits with code 0

## Output Signals

When you complete key steps, output these markers so the orchestrator can track progress:
- [VERIFICATION:PASS] when ./verify.sh passes
- [VERIFICATION:FAIL] when ./verify.sh fails
- [MILESTONE:COMPLETE] when the milestone is done
- [LESSON:...] when you learn something worth recording
- [BLOCKED:...] when you cannot proceed
- [MORE_WORK_NEEDED] when you need another iteration

## Instructions Framework

${instructionContext}
`;
}

/**
 * Build the initial task based on mode.
 */
function buildTask(config: LoopConfig): string {
  if (config.mode === 'improve') {
    return `Improve the package at: ${config.targetPackage}

Your task:
1. First, read the package to understand its current state
2. Identify improvements (code quality, tests, types, docs)
3. Follow the outer loop: PLAN -> IMPLEMENT -> VERIFY -> DECIDE
4. Run ./verify.sh --ui=false and ensure it passes
5. Record any lessons learned

Start by reading the package's key files.`;
  }

  return `Create a new package: @conveaux/${config.packageName}

Package type: ${config.packageType}
Description: ${config.description}

Your task:
1. First, read instructions/reference/patterns/package-setup.md to understand the pattern
2. Create the package structure following the pattern exactly
3. Follow the outer loop: PLAN -> IMPLEMENT -> VERIFY -> DECIDE
4. Run ./verify.sh --ui=false and ensure it passes
5. Record any lessons learned

Start by reading the package setup pattern.`;
}

/**
 * Parse signals from agent output.
 */
function parseSignals(agentOutput: string): {
  verificationPassed: boolean;
  milestoneComplete: boolean;
  lessonLearned: string | null;
  blocked: string | null;
  moreWorkNeeded: boolean;
} {
  return {
    verificationPassed: agentOutput.includes('[VERIFICATION:PASS]'),
    milestoneComplete: agentOutput.includes('[MILESTONE:COMPLETE]'),
    lessonLearned: extractBracketContent(agentOutput, 'LESSON'),
    blocked: extractBracketContent(agentOutput, 'BLOCKED'),
    moreWorkNeeded: agentOutput.includes('[MORE_WORK_NEEDED]'),
  };
}

/**
 * Extract content from [TAG:content] markers.
 */
function extractBracketContent(text: string, tag: string): string | null {
  // Escape special regex characters in tag to prevent injection
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\[${escapedTag}:([^\\]]+)\\]`);
  const match = text.match(regex);
  return match ? match[1]?.trim() ?? null : null;
}

/**
 * Run verification and return result.
 */
async function runVerification(projectRoot: string): Promise<{ passed: boolean; output: string }> {
  const { exec } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execAsync = promisify(exec);

  try {
    const { stdout, stderr } = await execAsync('./verify.sh --ui=false', {
      cwd: projectRoot,
      timeout: 300000, // 5 minutes
    });

    const output = stdout + stderr;
    const passed = output.includes('VERIFICATION:PASS');

    return { passed, output };
  } catch (error) {
    // Extract stdout/stderr from exec error if available
    const execError = error as { stdout?: string; stderr?: string };
    const parts = [
      execError.stdout,
      execError.stderr,
      getErrorMessage(error),
    ].filter(Boolean);
    return {
      passed: false,
      output: parts.join('\n'),
    };
  }
}
