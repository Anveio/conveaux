#!/usr/bin/env bun
/**
 * claude-code-works CLI
 *
 * A coding agent that follows the instructions framework to execute
 * recursive self-improvement on a target package.
 *
 * Usage:
 *   claude-code-works improve <package-path>
 *   claude-code-works create <package-name> --type=<type>
 */

import { runOuterLoop } from './loop';
import { loadInstructions } from './instructions';
import { output } from './output';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === '--help' || command === '-h') {
    printHelp();
    process.exit(0);
  }

  // Load instructions framework
  const projectRoot = process.cwd();
  const instructions = await loadInstructions(projectRoot);

  output.info(`claude-code-works v0.1.0`);
  output.dim(`Project root: ${projectRoot}`);
  output.dim(`Instructions loaded: ${instructions.files.length} files`);

  if (command === 'improve') {
    const targetPackage = args[1];
    if (!targetPackage) {
      output.error('Usage: claude-code-works improve <package-path>');
      process.exit(1);
    }

    output.info(`\nImproving package: ${targetPackage}`);

    const result = await runOuterLoop({
      mode: 'improve',
      targetPackage,
      projectRoot,
      instructions,
      maxIterations: parseIntFlag(args, '--iterations', 3),
    });

    if (result.success) {
      output.success(`\nImprovement complete!`);
      output.dim(`  Iterations: ${result.iterations}`);
      output.dim(`  Lessons recorded: ${result.lessonsRecorded}`);
    } else {
      output.error(`\nImprovement failed: ${result.error}`);
      process.exit(1);
    }
  } else if (command === 'create') {
    const packageName = args[1];
    if (!packageName) {
      output.error('Usage: claude-code-works create <package-name> --type=<type>');
      process.exit(1);
    }

    const packageType = parseStringFlag(args, '--type', 'core');
    const description = parseStringFlag(args, '--description', `Package ${packageName}`);

    output.info(`\nCreating package: @conveaux/${packageName}`);
    output.dim(`  Type: ${packageType}`);

    const result = await runOuterLoop({
      mode: 'create',
      packageName,
      packageType,
      description,
      projectRoot,
      instructions,
      maxIterations: parseIntFlag(args, '--iterations', 5),
    });

    if (result.success) {
      output.success(`\nPackage created!`);
      output.dim(`  Path: ${result.packagePath}`);
      output.dim(`  Iterations: ${result.iterations}`);
    } else {
      output.error(`\nCreation failed: ${result.error}`);
      process.exit(1);
    }
  } else {
    output.error(`Unknown command: ${command}`);
    printHelp();
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
claude-code-works - A coding agent that follows instructions for recursive self-improvement

USAGE:
  claude-code-works <command> [options]

COMMANDS:
  improve <package-path>    Improve an existing package
  create <package-name>     Create a new package

OPTIONS:
  --type=<type>            Package type (contract, port, adapter, core, app)
  --description=<desc>     Package description
  --iterations=<n>         Maximum iterations (default: 3 for improve, 5 for create)
  --help, -h               Show this help message

ENVIRONMENT:
  ANTHROPIC_API_KEY        Required. Your Anthropic API key.

EXAMPLES:
  claude-code-works improve packages/agent-core
  claude-code-works create clock --type=port --description="Clock port implementation"
`);
}

function parseStringFlag(args: string[], flag: string, defaultValue: string): string {
  const prefix = `${flag}=`;
  const found = args.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : defaultValue;
}

function parseIntFlag(args: string[], flag: string, defaultValue: number): number {
  const value = parseStringFlag(args, flag, String(defaultValue));
  return parseInt(value, 10) || defaultValue;
}

main().catch((error) => {
  output.error(`Fatal error: ${error.message}`);
  process.exit(1);
});
