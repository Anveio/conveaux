/**
 * Create command - create a new package.
 */

import type { Config } from '../config';
import { loadInstructions } from '../instructions';
import { runOuterLoop } from '../loop';
import { output } from '../output';

export interface CreateOptions {
  type?: string;
  description?: string;
  iterations?: number;
  model?: string;
  benchmark?: boolean;
}

/**
 * Execute the create command.
 */
export async function runCreate(
  packageName: string,
  options: CreateOptions,
  config: Config
): Promise<void> {
  const projectRoot = process.cwd();
  const instructions = await loadInstructions(projectRoot);

  output.info('claude-code-works v0.1.0');
  output.dim(`Project root: ${projectRoot}`);
  output.dim(`Instructions loaded: ${instructions.files.length} files`);

  const packageType = options.type ?? 'core';
  const description = options.description ?? `Package ${packageName}`;
  const maxIterations = options.iterations ?? config.createIterations;
  const model = options.model ?? config.model;
  const benchmark = options.benchmark ?? config.benchmark;

  output.info(`\nCreating package: @conveaux/${packageName}`);
  output.dim(`  Type: ${packageType}`);

  if (benchmark) {
    output.dim('Benchmarking: enabled');
    output.dim(`Model: ${model}`);
  }

  const result = await runOuterLoop({
    mode: 'create',
    packageName,
    packageType,
    description,
    projectRoot,
    instructions,
    maxIterations,
    model,
    benchmark,
  });

  if (result.success) {
    output.success('\nPackage created!');
    output.dim(`  Path: ${result.packagePath}`);
    output.dim(`  Iterations: ${result.iterations}`);

    if (benchmark && result.benchmark) {
      const { reportBenchmark } = await import('../benchmark/index');
      reportBenchmark(result.benchmark);
    }
  } else {
    output.error(`\nCreation failed: ${result.error}`);
    process.exit(1);
  }
}
