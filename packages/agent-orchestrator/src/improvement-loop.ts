/**
 * The recursive improvement loop that coordinates agents.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { OrchestratorConfig, OrchestratorResult, LessonLearned } from '@conveaux/agent-contracts';
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
  config: OrchestratorConfig
): Promise<OrchestratorResult> {
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

  console.log(`\nStarting improvement loop for: ${config.targetPackage}`);
  console.log(`Max iterations: ${config.maxIterations}`);
  console.log('─'.repeat(50));

  while (iteration < config.maxIterations) {
    iteration++;
    console.log(`\n=== Iteration ${iteration}/${config.maxIterations} ===\n`);

    // 1. ANALYZE
    console.log('📊 Analyzing package...');
    const analysis = await analyzer.run(`
      Analyze the package at: ${config.targetPackage}

      1. First, use glob to find all TypeScript files
      2. Read key files to understand the codebase
      3. Identify the top 3 most impactful improvements

      Output as JSON array:
      [{ "file": "...", "issue": "...", "fix": "...", "priority": "..." }]
    `);

    console.log(`   Tokens used: ${analysis.tokenUsage.input + analysis.tokenUsage.output}`);

    if (!analysis.success) {
      console.log('   ❌ Analysis failed:', analysis.output.slice(0, 200));
      consecutiveFailures++;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.log(`\n⚠️  ${maxConsecutiveFailures} consecutive failures, stopping loop`);
        break;
      }
      continue;
    }

    // Check if there are improvements to make
    if (analysis.output.includes('[]') || analysis.output.includes('No improvements')) {
      console.log('   ✅ No more improvements identified');
      break;
    }

    console.log('   Found improvements:', analysis.output.slice(0, 300));

    // 2. IMPLEMENT
    console.log('\n🔧 Implementing improvements...');
    const implementation = await implementer.run(`
      Implement these improvements in ${config.targetPackage}:

      ${analysis.output}

      For each improvement:
      1. Read the target file
      2. Make the necessary edits
      3. Report what you changed
    `);

    console.log(`   Tokens used: ${implementation.tokenUsage.input + implementation.tokenUsage.output}`);

    if (!implementation.success) {
      console.log('   ❌ Implementation failed:', implementation.output.slice(0, 200));
      consecutiveFailures++;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.log(`\n⚠️  ${maxConsecutiveFailures} consecutive failures, stopping loop`);
        break;
      }
      continue;
    }

    console.log('   Changes made:', implementation.output.slice(0, 300));

    // 3. VERIFY
    console.log('\n🧪 Verifying changes...');
    const verification = await reviewer.run(`
      Verify the changes made to ${config.targetPackage}:

      1. Run: ./verify.sh --ui=false
      2. Report whether all checks pass

      If verification fails, explain what went wrong.
    `);

    console.log(`   Tokens used: ${verification.tokenUsage.input + verification.tokenUsage.output}`);

    if (verification.output.includes('VERIFICATION:PASS')) {
      console.log('   ✅ Verification passed!');
      consecutiveFailures = 0;

      // 4. RECORD LESSON
      const lesson = await recordLesson({
        context: config.targetPackage,
        lesson: `Iteration ${iteration}: ${analysis.output.slice(0, 500)}`,
        evidence: 'Verification passed after implementing improvements',
      });
      lessons.push(lesson);
      console.log(`   📝 Lesson recorded: ${lesson.id}`);
    } else {
      console.log('   ❌ Verification failed');
      console.log('   Rolling back changes...');

      // Rollback using git
      const rollback = await reviewer.run(`
        Run: git checkout -- ${config.targetPackage}
        This will revert the changes we just made.
      `);

      console.log('   Rolled back:', rollback.output.slice(0, 100));
      consecutiveFailures++;

      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.log(`\n⚠️  ${maxConsecutiveFailures} consecutive failures, stopping loop`);
        break;
      }
    }
  }

  console.log('\n' + '─'.repeat(50));
  console.log(`Improvement loop complete`);
  console.log(`  Iterations: ${iteration}`);
  console.log(`  Lessons recorded: ${lessons.length}`);
  console.log('─'.repeat(50));

  return {
    success: true,
    iterations: iteration,
    lessons,
  };
}
