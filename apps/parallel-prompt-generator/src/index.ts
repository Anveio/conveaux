/**
 * Core logic for parallel prompt generation.
 */

import { renderDataStructurePrompt } from '@conveaux/domain-prompt-template';
import { PRESETS, PRESET_NAMES } from './presets.js';

/**
 * List available presets to stdout.
 */
export function listPresets(): void {
  console.log('Available presets:\n');
  for (const name of PRESET_NAMES) {
    const preset = PRESETS[name]!;
    console.log(`  ${name.padEnd(16)} - ${preset.displayName}`);
  }
  console.log(`\nTotal: ${PRESET_NAMES.length} presets`);
}

/**
 * Generate prompts for the specified structures (or all if none specified).
 *
 * @param names - Optional list of preset names to generate. If empty, generates all.
 */
export function generatePrompts(names?: string[]): void {
  const requestedNames = names && names.length > 0 ? names : PRESET_NAMES;

  // Validate names
  const invalid = requestedNames.filter((n) => !PRESETS[n]);
  if (invalid.length > 0) {
    console.error(`Unknown presets: ${invalid.join(', ')}`);
    console.error('Run with --list to see available presets');
    process.exit(1);
  }

  // Safe to assert: we've validated all names exist above
  const configs = requestedNames.map((n) => PRESETS[n]!);
  const total = configs.length;

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i]!;
    const result = renderDataStructurePrompt(config, i + 1, total);
    console.log(result.prompt);

    if (i < total - 1) {
      console.log('\n---\n');
    }
  }
}
