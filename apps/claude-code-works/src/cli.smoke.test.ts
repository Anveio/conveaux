/**
 * Smoke tests for the claude-code-works CLI.
 *
 * These tests verify the CLI commands work correctly by spawning
 * the actual CLI process and asserting on the output.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execAsync = promisify(exec);

const CLI_PATH = 'bun run src/cli.ts';
const CWD = process.cwd();

/**
 * Run a CLI command and return stdout/stderr.
 */
async function runCli(args: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execAsync(`${CLI_PATH} ${args}`, {
      cwd: CWD,
      env: { ...process.env, ANTHROPIC_API_KEY: '' }, // Ensure no API key
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error) {
    const e = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.code ?? 1,
    };
  }
}

describe('CLI Smoke Tests', () => {
  describe('--help', () => {
    it('shows help message', async () => {
      const { stdout } = await runCli('--help');

      expect(stdout).toContain('claude-code-works');
      expect(stdout).toContain('A coding agent');
      expect(stdout).toContain('Commands:');
      expect(stdout).toContain('improve');
      expect(stdout).toContain('create');
      expect(stdout).toContain('status');
      expect(stdout).toContain('doctor');
    });
  });

  describe('--version', () => {
    it('shows version number', async () => {
      const { stdout } = await runCli('--version');

      expect(stdout.trim()).toBe('0.1.0');
    });
  });

  describe('improve --help', () => {
    it('shows improve command help', async () => {
      const { stdout } = await runCli('improve --help');

      expect(stdout).toContain('Improve an existing package');
      expect(stdout).toContain('--iterations');
      expect(stdout).toContain('--model');
      expect(stdout).toContain('--benchmark');
    });
  });

  describe('create --help', () => {
    it('shows create command help', async () => {
      const { stdout } = await runCli('create --help');

      expect(stdout).toContain('Create a new package');
      expect(stdout).toContain('--type');
      expect(stdout).toContain('--description');
      expect(stdout).toContain('--iterations');
      expect(stdout).toContain('--model');
      expect(stdout).toContain('--benchmark');
    });
  });

  describe('status', () => {
    it('shows repository status', async () => {
      const { stdout, exitCode } = await runCli('status');

      expect(exitCode).toBe(0);
      expect(stdout).toContain('REPOSITORY STATUS');
      expect(stdout).toContain('Git Status:');
      expect(stdout).toContain('Lessons:');
      expect(stdout).toContain('Improvement Proposals:');
      expect(stdout).toContain('Verification:');
      expect(stdout).toContain('Configuration:');
    });
  });

  describe('doctor', () => {
    it('runs environment checks', async () => {
      const { stdout, stderr } = await runCli('doctor');
      const output = stdout + stderr;

      // Should run checks (may fail due to missing API key)
      expect(output).toContain('ENVIRONMENT CHECK');
      expect(output).toContain('ANTHROPIC_API_KEY');
      expect(output).toContain('Bun runtime');
      expect(output).toContain('Git');
      expect(output).toContain('verify.sh');
      expect(output).toContain('Instructions directory');
    });

    it('exits with code 1 when API key is not set', async () => {
      const { exitCode } = await runCli('doctor');

      // Should fail because ANTHROPIC_API_KEY is explicitly not set
      expect(exitCode).toBe(1);
    });
  });

  describe('unknown command', () => {
    it('shows error for unknown command', async () => {
      const { stderr, exitCode } = await runCli('unknown-command');

      expect(exitCode).toBe(1);
      expect(stderr).toContain('unknown command');
    });
  });

  describe('improve without path', () => {
    it('shows error when package path is missing', async () => {
      const { stderr, exitCode } = await runCli('improve');

      expect(exitCode).toBe(1);
      expect(stderr).toContain("required argument 'package-path'");
    });
  });

  describe('create without name', () => {
    it('shows error when package name is missing', async () => {
      const { stderr, exitCode } = await runCli('create');

      expect(exitCode).toBe(1);
      expect(stderr).toContain("required argument 'package-name'");
    });
  });
});
