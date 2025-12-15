#!/usr/bin/env node

/**
 * CLI entry point for validation-pipeline.
 */

import { cwd } from 'node:process';
import { Command } from 'commander';
import { type NamedStageResult, collectBenchmarks, reportBenchmarks } from './benchmark/index.js';
import type { Reporter, StageName, StageResult } from './contracts/index.js';
import { runPipeline } from './pipeline.js';
import { agentReporter, headlessReporter, interactiveReporter } from './reporters/index.js';
import { DEFAULT_STAGE_ORDER } from './stages/index.js';

const program = new Command();

program
  .name('validation-pipeline')
  .description('Run the validation pipeline (check, lint, typecheck, build, test)')
  .version('0.1.0')
  .option('--ui <boolean>', 'Enable interactive UI (default: true)', 'true')
  .option('--stage <name>', 'Run only a specific stage')
  .option('--no-autofix', 'Disable autofix for lint stage')
  .option('--ci', 'Run in CI mode (disables autofix, uses headless output)')
  .option('--agent', 'Agent mode: minimal output optimized for LLM agents')
  .option('--benchmark', 'Enable benchmarking metrics output')
  .option('--sequential', 'Force sequential execution (disable parallel)')
  .option('--no-doctor', 'Skip doctor stage (code health fixes)')
  .action(
    async (options: {
      ui: string;
      stage?: string;
      autofix: boolean;
      ci?: boolean;
      agent?: boolean;
      benchmark?: boolean;
      sequential?: boolean;
      doctor: boolean;
    }) => {
      const ui = options.agent ? false : options.ci ? false : options.ui !== 'false';
      const autofix = options.ci ? false : options.autofix;
      const projectRoot = cwd();

      // Determine which stages to run
      let stages: StageName[] | undefined;
      if (options.stage) {
        const stageName = options.stage as StageName;
        if (!DEFAULT_STAGE_ORDER.includes(stageName)) {
          console.error(`Unknown stage: ${options.stage}`);
          console.error(`Available stages: ${DEFAULT_STAGE_ORDER.join(', ')}`);
          process.exit(2);
        }
        stages = [stageName];
      } else if (!options.doctor) {
        // Skip doctor stage if --no-doctor specified
        stages = DEFAULT_STAGE_ORDER.filter((s) => s !== 'doctor');
      }

      // Select reporter based on mode
      // Priority: --agent > --ci/--ui=false > interactive
      const reporter: Reporter = options.agent
        ? agentReporter
        : ui
          ? interactiveReporter
          : headlessReporter;

      // Report pipeline start (headless only, agent mode is silent)
      if (!(ui || options.agent)) {
        headlessReporter.reportPipelineStart?.();
      }

      // Benchmark collection
      const benchmarkResults: NamedStageResult[] = [];

      // Run pipeline with callbacks for reporting
      const result = await runPipeline({
        projectRoot,
        ci: Boolean(options.ci),
        autofix,
        ui,
        stages,
        sequential: options.sequential,
        onStageStart: (stageName) => {
          reporter.reportStageStart(stageName);
        },
        onStageComplete: (executionResult) => {
          reporter.reportStageResult(executionResult);

          // Collect benchmark data
          if (options.benchmark) {
            const stageResult: StageResult = {
              success: executionResult.success,
              message: executionResult.message,
              durationMs: executionResult.durationMs,
              errors: executionResult.errors,
              output: executionResult.output,
            };
            benchmarkResults.push({ name: executionResult.stage, result: stageResult });
          }
        },
      });

      // Report final result
      reporter.reportPipelineResult(result);

      // Report benchmarks if enabled
      if (options.benchmark) {
        const benchmarks = collectBenchmarks(benchmarkResults);
        reportBenchmarks(benchmarks, ui);
      }

      process.exit(result.success ? 0 : 1);
    }
  );

program.parse();
