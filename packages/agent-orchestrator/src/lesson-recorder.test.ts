/**
 * Tests for the lesson recorder.
 */

import type { Environment, Logger, Random, WallClock } from '@conveaux/agent-contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordLesson } from './lesson-recorder.js';

// Mock fs module
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

import { readFile, writeFile } from 'node:fs/promises';

// Create mock ports for testing
function createMockPorts() {
  const logs: Array<{ level: string; message: string }> = [];

  const mockClock: WallClock = {
    nowMs: () => 1734173400000, // 2024-12-14T10:30:00.000Z
  };

  const mockRandom: Random = {
    number: vi.fn().mockReturnValue(0.123456789),
    uuid: () => 'mock-uuid-1234',
    choice: <T>(items: T[]) => items[0],
  };

  const mockEnv: Environment = {
    get: (key: string) => (key === 'NODE_ENV' ? 'test' : undefined),
    require: (key: string) => {
      if (key === 'NODE_ENV') return 'test';
      throw new Error(`Required env var not set: ${key}`);
    },
    cwd: () => '/mock/project/root',
  };

  const mockLogger: Logger = {
    debug: (msg: string) => logs.push({ level: 'debug', message: msg }),
    info: (msg: string) => logs.push({ level: 'info', message: msg }),
    warn: (msg: string) => logs.push({ level: 'warn', message: msg }),
    error: (msg: string) => logs.push({ level: 'error', message: msg }),
  };

  return {
    ports: {
      clock: mockClock,
      random: mockRandom,
      env: mockEnv,
      logger: mockLogger,
    },
    logs,
  };
}

describe('recordLesson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate a deterministic lesson ID with mock ports', async () => {
    const { ports } = createMockPorts();
    const existingContent = `# Lessons

## Lessons by Domain

Some existing content
`;

    vi.mocked(readFile).mockResolvedValue(existingContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    const result = await recordLesson({
      context: 'test-package',
      lesson: 'Test lesson content',
      evidence: 'Test evidence',
      ports,
    });

    // ID should be deterministic based on mock clock and random
    expect(result.id).toMatch(/^L-20241214-/);
    expect(result.date).toBe('2024-12-14');
    expect(result.context).toBe('test-package');
    expect(result.lesson).toBe('Test lesson content');
    expect(result.evidence).toBe('Test evidence');
  });

  it('should append lesson after "## Lessons by Domain" section', async () => {
    const { ports } = createMockPorts();
    const existingContent = `# Lessons

## Lessons by Domain

### L-001: Existing Lesson
`;

    vi.mocked(readFile).mockResolvedValue(existingContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await recordLesson({
      context: 'test-package',
      lesson: 'New lesson',
      evidence: 'Evidence',
      ports,
    });

    expect(writeFile).toHaveBeenCalledTimes(1);
    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;

    // Should contain both the new lesson and old content
    expect(writtenContent).toContain('## Lessons by Domain');
    expect(writtenContent).toContain('New lesson');
    expect(writtenContent).toContain('L-001: Existing Lesson');
  });

  it('should use provided projectRoot instead of env.cwd()', async () => {
    const { ports } = createMockPorts();
    const existingContent = '## Lessons by Domain\n';

    vi.mocked(readFile).mockResolvedValue(existingContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await recordLesson({
      context: 'test-package',
      lesson: 'Test',
      evidence: 'Evidence',
      ports,
      projectRoot: '/custom/root',
    });

    expect(readFile).toHaveBeenCalledWith(
      '/custom/root/instructions/improvements/lessons.md',
      'utf-8'
    );
  });

  it('should log warning and return lesson data when file read fails', async () => {
    const { ports, logs } = createMockPorts();

    vi.mocked(readFile).mockRejectedValue(new Error('File not found'));

    const result = await recordLesson({
      context: 'test-package',
      lesson: 'Test',
      evidence: 'Evidence',
      ports,
    });

    // Should still return the lesson data
    expect(result.context).toBe('test-package');
    expect(result.lesson).toBe('Test');

    // Should have logged a warning
    expect(
      logs.some((l) => l.level === 'warn' && l.message.includes('Could not record lesson'))
    ).toBe(true);
  });

  it('should append to end of file if section marker not found', async () => {
    const { ports } = createMockPorts();
    const existingContent = `# Some other content

Without the expected section
`;

    vi.mocked(readFile).mockResolvedValue(existingContent);
    vi.mocked(writeFile).mockResolvedValue(undefined);

    await recordLesson({
      context: 'test-package',
      lesson: 'New lesson',
      evidence: 'Evidence',
      ports,
    });

    const writtenContent = vi.mocked(writeFile).mock.calls[0][1] as string;

    // Original content should still be there
    expect(writtenContent).toContain('# Some other content');
    // New lesson should be appended at end
    expect(writtenContent).toContain('New lesson');
  });
});
