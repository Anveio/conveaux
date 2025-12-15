/**
 * The recursive improvement loop that coordinates agents.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LessonLearned,
  OrchestratorConfig,
  OrchestratorResult,
  Ports,
} from '@conveaux/agent-contracts';
import { createAnalyzer, createImplementer, createReviewer } from './agents/index.js';
import { recordLesson } from './lesson-recorder.js';

/**
 * Run the improvement loop on a target package.
 *
 * The loop:
 * 1. ANALYZE: Identify improvements
 * 2. IMPLEMENT: Apply changes
 * 3. VERIFY: Run tests
 * 4. RECORD: Save lessons learned
 *
 * Repeats until maxIterations or no more improvements found.
 */
export async function runImprovementLoop(
  config: OrchestratorConfig,
  ports: Ports
): Promise<OrchestratorResult> {
  const { logger } = ports;

  const client = new Anthropic({
    apiKey: config.anthropicApiKey,
  });

  const analyzer = createAnalyzer(client);
  const implementer = createImplementer(client);
  const reviewer = createReviewer(client);

  const lessons: LessonLearned[] = [];
  let iteration = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  logger.info(`\nStarting improvement loop for: ${config.targetPackage}`);
  logger.info(`Max iterations: ${config.maxIterations}`);
  logger.info('─'.repeat(50));

  while (iteration < config.maxIterations) {
    iteration++;
    logger.info(`\n=== Iteration ${iteration}/${config.maxIterations} ===\n`);

    // 1. ANALYZE
    logger.info('Analyzing package...');
    const analysis = await analyzer.run(`
      Analyze the package at: ${config.targetPackage}

      1. First, use glob to find all TypeScript files
      2. Read key files to understand the codebase
      3. Identify the top 3 most impactful improvements

      Output as JSON array:
      [{ "file": "...", "issue": "...", "fix": "...", "priority": "..." }]
    `);

    logger.info(`   Tokens used: ${analysis.tokenUsage.input + analysis.tokenUsage.output}`);

    if (!analysis.success) {
      logger.warn(`   Analysis failed: ${analysis.output.slice(0, 200)}`);
      consecutiveFailures++;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        logger.warn(`\n${maxConsecutiveFailures} consecutive failures, stopping loop`);
        break;
      }
      continue;
    }

    // Check if there are improvements to make
    if (analysis.output.includes('[]') || analysis.output.includes('No improvements')) {
      logger.info('   No more improvements identified');
      break;
    }

    logger.info(`   Found improvements: ${analysis.output.slice(0, 300)}`);

    // 2. IMPLEMENT
    logger.info('\nImplementing improvements...');
    const implementation = await implementer.run(`
      Implement these improvements in ${config.targetPackage}:

      ${analysis.output}

      For each improvement:
      1. Read the target file
      2. Make the necessary edits
      3. Report what you changed
    `);

    logger.info(
      `   Tokens used: ${implementation.tokenUsage.input + implementation.tokenUsage.output}`
    );

    if (!implementation.success) {
      logger.warn(`   Implementation failed: ${implementation.output.slice(0, 200)}`);
      consecutiveFailures++;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        logger.warn(`\n${maxConsecutiveFailures} consecutive failures, stopping loop`);
        break;
      }
      continue;
    }

    logger.info(`   Changes made: ${implementation.output.slice(0, 300)}`);

    // 3. VERIFY
    logger.info('\nVerifying changes...');
    const verification = await reviewer.run(`
      Verify the changes made to ${config.targetPackage}:

      1. Run: ./verify.sh --ui=false
      2. Report whether all checks pass

      If verification fails, explain what went wrong.
    `);

    logger.info(
      `   Tokens used: ${verification.tokenUsage.input + verification.tokenUsage.output}`
    );

    if (verification.output.includes('VERIFICATION:PASS')) {
      logger.info('   Verification passed!');
      consecutiveFailures = 0;

      // 4. RECORD LESSON
      const lesson = await recordLesson({
        context: config.targetPackage,
        lesson: `Iteration ${iteration}: ${analysis.output.slice(0, 500)}`,
        evidence: 'Verification passed after implementing improvements',
        ports,
      });
      lessons.push(lesson);
      logger.info(`   Lesson recorded: ${lesson.id}`);
    } else {
      logger.warn('   Verification failed');
      logger.info('   Rolling back changes...');

      // Rollback using git
      const rollback = await reviewer.run(`
        Run: git checkout -- ${config.targetPackage}
        This will revert the changes we just made.
      `);

      logger.info(`   Rolled back: ${rollback.output.slice(0, 100)}`);
      consecutiveFailures++;

      if (consecutiveFailures >= maxConsecutiveFailures) {
        logger.warn(`\n${maxConsecutiveFailures} consecutive failures, stopping loop`);
        break;
      }
    }
  }

  logger.info(`\n${'─'.repeat(50)}`);
  logger.info('Improvement loop complete');
  logger.info(`  Iterations: ${iteration}`);
  logger.info(`  Lessons recorded: ${lessons.length}`);
  logger.info('─'.repeat(50));

  return {
    success: true,
    iterations: iteration,
    lessons,
  };
}
