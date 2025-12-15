/**
 * Improve command - improve an existing package.
 */

import type { Config } from '../config';
import { loadInstructions } from '../instructions';
import { runOuterLoop } from '../loop';
import { output } from '../output';

export interface ImproveOptions {
  iterations?: number;
  model?: string;
  benchmark?: boolean;
}

/**
 * Execute the improve command.
 */
export async function runImprove(
  targetPackage: string,
  options: ImproveOptions,
  config: Config
): Promise<void> {
  const projectRoot = process.cwd();
  const instructions = await loadInstructions(projectRoot);

  output.info('claude-code-works v0.1.0');
  output.dim(`Project root: ${projectRoot}`);
  output.dim(`Instructions loaded: ${instructions.files.length} files`);
  output.info(`\nImproving package: ${targetPackage}`);

  const maxIterations = options.iterations ?? config.improveIterations;
  const model = options.model ?? config.model;
  const benchmark = options.benchmark ?? config.benchmark;

  if (benchmark) {
    output.dim('Benchmarking: enabled');
    output.dim(`Model: ${model}`);
  }

  const result = await runOuterLoop({
    mode: 'improve',
    targetPackage,
    projectRoot,
    instructions,
    maxIterations,
    model,
    benchmark,
  });

  if (result.success) {
    output.success('\nImprovement complete!');
    output.dim(`  Iterations: ${result.iterations}`);
    output.dim(`  Lessons recorded: ${result.lessonsRecorded}`);

    if (benchmark && result.benchmark) {
      const { reportBenchmark } = await import('../benchmark/index');
      reportBenchmark(result.benchmark);
    }
  } else {
    output.error(`\nImprovement failed: ${result.error}`);
    process.exit(1);
  }
}
