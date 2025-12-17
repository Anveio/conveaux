#!/usr/bin/env node
/**
 * CLI entry point for parallel prompt generator.
 *
 * Usage:
 *   ccw parallel lru-cache priority-queue   # Generate specific prompts
 *   ccw parallel --list                      # List available presets
 *   ccw parallel --all                       # Generate all prompts
 */

import { Command } from 'commander';
import { generatePrompts, listPresets } from './index.js';

const program = new Command();

program
  .name('ccw')
  .description('Claude Code Works - Dev tools for parallel agentic programming')
  .version('0.1.0');

program
  .command('parallel [structures...]')
  .description('Generate prompts for parallel data structure implementation')
  .option('-l, --list', 'List available presets')
  .option('-a, --all', 'Generate prompts for all presets')
  .action((structures: string[], options: { list?: boolean; all?: boolean }) => {
    if (options.list) {
      listPresets();
    } else if (options.all) {
      generatePrompts();
    } else if (structures.length > 0) {
      generatePrompts(structures);
    } else {
      console.error('Error: Specify structure names or use --list / --all\n');
      console.error('Examples:');
      console.error('  ccw parallel lru-cache priority-queue');
      console.error('  ccw parallel --list');
      console.error('  ccw parallel --all');
      process.exit(1);
    }
  });

program.parse();
