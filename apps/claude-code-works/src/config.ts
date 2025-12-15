/**
 * Configuration system for claude-code-works.
 *
 * Config precedence: CLI flags > env vars > config file > defaults
 * Config file location: .claude-code-works.json in project root
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isRecord } from './type-guards';

/**
 * Configuration options for claude-code-works.
 */
export interface Config {
  /** Claude model to use */
  model: string;
  /** Maximum iterations for improve command */
  improveIterations: number;
  /** Maximum iterations for create command */
  createIterations: number;
  /** Enable benchmark output */
  benchmark: boolean;
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Config = {
  model: 'claude-sonnet-4-20250514',
  improveIterations: 3,
  createIterations: 5,
  benchmark: false,
};

/**
 * Config file name.
 */
export const CONFIG_FILE_NAME = '.claude-code-works.json';

/**
 * Load configuration from project root.
 */
export function loadConfig(projectRoot: string): Partial<Config> {
  const configPath = join(projectRoot, CONFIG_FILE_NAME);

  if (!existsSync(configPath)) {
    return {};
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const parsed: unknown = JSON.parse(content);

    if (!isRecord(parsed)) {
      return {};
    }

    const config: Partial<Config> = {};

    if (typeof parsed.model === 'string') {
      config.model = parsed.model;
    }
    if (typeof parsed.improveIterations === 'number') {
      config.improveIterations = parsed.improveIterations;
    }
    if (typeof parsed.createIterations === 'number') {
      config.createIterations = parsed.createIterations;
    }
    if (typeof parsed.benchmark === 'boolean') {
      config.benchmark = parsed.benchmark;
    }

    return config;
  } catch {
    return {};
  }
}

/**
 * Resolve final configuration from all sources.
 */
export function resolveConfig(projectRoot: string, cliOverrides: Partial<Config> = {}): Config {
  const fileConfig = loadConfig(projectRoot);

  return {
    model: cliOverrides.model ?? fileConfig.model ?? DEFAULT_CONFIG.model,
    improveIterations:
      cliOverrides.improveIterations ??
      fileConfig.improveIterations ??
      DEFAULT_CONFIG.improveIterations,
    createIterations:
      cliOverrides.createIterations ??
      fileConfig.createIterations ??
      DEFAULT_CONFIG.createIterations,
    benchmark: cliOverrides.benchmark ?? fileConfig.benchmark ?? DEFAULT_CONFIG.benchmark,
  };
}
