import type { ClassifiedTask } from '@conveaux/contract-coordinator';
import { describe, expect, it } from 'vitest';
import {
  conflictsWithWave,
  countTotalTasks,
  getAllFiles,
  planExecutionWaves,
  tasksOverlap,
} from './execution-planner.js';

function createTask(id: string, files: string[], priority = 2): ClassifiedTask {
  return {
    featureId: id,
    agentType: 'coding',
    files,
    priority,
    prompt: `Task ${id}`,
  };
}

describe('tasksOverlap', () => {
  it('returns true when tasks share files', () => {
    const a = createTask('a', ['src/foo.ts', 'src/bar.ts']);
    const b = createTask('b', ['src/bar.ts', 'src/baz.ts']);
    expect(tasksOverlap(a, b)).toBe(true);
  });

  it('returns false when tasks have no shared files', () => {
    const a = createTask('a', ['src/foo.ts']);
    const b = createTask('b', ['src/bar.ts']);
    expect(tasksOverlap(a, b)).toBe(false);
  });

  it('returns false for empty file arrays', () => {
    const a = createTask('a', []);
    const b = createTask('b', []);
    expect(tasksOverlap(a, b)).toBe(false);
  });

  it('returns false when only one has files', () => {
    const a = createTask('a', ['src/foo.ts']);
    const b = createTask('b', []);
    expect(tasksOverlap(a, b)).toBe(false);
  });
});

describe('conflictsWithWave', () => {
  it('returns true when task conflicts with any wave task', () => {
    const task = createTask('new', ['src/shared.ts']);
    const wave = [createTask('a', ['src/foo.ts']), createTask('b', ['src/shared.ts'])];
    expect(conflictsWithWave(task, wave)).toBe(true);
  });

  it('returns false when task has no conflicts', () => {
    const task = createTask('new', ['src/unique.ts']);
    const wave = [createTask('a', ['src/foo.ts']), createTask('b', ['src/bar.ts'])];
    expect(conflictsWithWave(task, wave)).toBe(false);
  });

  it('returns false for empty wave', () => {
    const task = createTask('new', ['src/foo.ts']);
    expect(conflictsWithWave(task, [])).toBe(false);
  });
});

describe('planExecutionWaves', () => {
  it('returns empty array for no tasks', () => {
    const waves = planExecutionWaves([]);
    expect(waves).toEqual([]);
  });

  it('groups non-conflicting tasks into same wave', () => {
    const tasks = [
      createTask('a', ['src/a.ts']),
      createTask('b', ['src/b.ts']),
      createTask('c', ['src/c.ts']),
    ];

    const waves = planExecutionWaves(tasks);
    expect(waves).toHaveLength(1);
    expect(waves[0]!.tasks).toHaveLength(3);
    expect(waves[0]!.index).toBe(0);
  });

  it('separates conflicting tasks into different waves', () => {
    const tasks = [
      createTask('a', ['src/shared.ts']),
      createTask('b', ['src/shared.ts']),
      createTask('c', ['src/shared.ts']),
    ];

    const waves = planExecutionWaves(tasks);
    expect(waves).toHaveLength(3);
    expect(waves[0]!.tasks).toHaveLength(1);
    expect(waves[1]!.tasks).toHaveLength(1);
    expect(waves[2]!.tasks).toHaveLength(1);
  });

  it('respects maxConcurrency limit', () => {
    const tasks = [
      createTask('a', ['src/a.ts']),
      createTask('b', ['src/b.ts']),
      createTask('c', ['src/c.ts']),
      createTask('d', ['src/d.ts']),
    ];

    const waves = planExecutionWaves(tasks, { maxConcurrency: 2 });
    expect(waves).toHaveLength(2);
    expect(waves[0]!.tasks).toHaveLength(2);
    expect(waves[1]!.tasks).toHaveLength(2);
  });

  it('sorts tasks by priority (lower first)', () => {
    const tasks = [
      createTask('low', ['src/low.ts'], 3),
      createTask('high', ['src/high.ts'], 1),
      createTask('medium', ['src/medium.ts'], 2),
    ];

    const waves = planExecutionWaves(tasks);
    expect(waves).toHaveLength(1);
    expect(waves[0]!.tasks[0]!.featureId).toBe('high');
    expect(waves[0]!.tasks[1]!.featureId).toBe('medium');
    expect(waves[0]!.tasks[2]!.featureId).toBe('low');
  });

  it('handles mixed conflict and non-conflict scenarios', () => {
    const tasks = [
      createTask('a', ['src/shared.ts', 'src/a.ts']),
      createTask('b', ['src/b.ts']),
      createTask('c', ['src/shared.ts', 'src/c.ts']),
      createTask('d', ['src/d.ts']),
    ];

    const waves = planExecutionWaves(tasks);
    // Wave 1: a, b, d (no conflicts)
    // Wave 2: c (conflicts with a due to shared.ts)
    expect(waves).toHaveLength(2);
  });

  it('assigns sequential wave indices', () => {
    const tasks = [
      createTask('a', ['src/x.ts']),
      createTask('b', ['src/x.ts']),
      createTask('c', ['src/x.ts']),
    ];

    const waves = planExecutionWaves(tasks);
    expect(waves[0]!.index).toBe(0);
    expect(waves[1]!.index).toBe(1);
    expect(waves[2]!.index).toBe(2);
  });

  it('handles single task', () => {
    const tasks = [createTask('only', ['src/only.ts'])];

    const waves = planExecutionWaves(tasks);
    expect(waves).toHaveLength(1);
    expect(waves[0]!.tasks).toHaveLength(1);
    expect(waves[0]!.tasks[0]!.featureId).toBe('only');
  });

  it('handles maxConcurrency of 1', () => {
    const tasks = [createTask('a', ['src/a.ts']), createTask('b', ['src/b.ts'])];

    const waves = planExecutionWaves(tasks, { maxConcurrency: 1 });
    expect(waves).toHaveLength(2);
    expect(waves[0]!.tasks).toHaveLength(1);
    expect(waves[1]!.tasks).toHaveLength(1);
  });
});

describe('countTotalTasks', () => {
  it('returns 0 for empty waves', () => {
    expect(countTotalTasks([])).toBe(0);
  });

  it('counts tasks across all waves', () => {
    const waves = [
      { index: 0, tasks: [createTask('a', []), createTask('b', [])] },
      { index: 1, tasks: [createTask('c', [])] },
      { index: 2, tasks: [createTask('d', []), createTask('e', []), createTask('f', [])] },
    ];

    expect(countTotalTasks(waves)).toBe(6);
  });

  it('handles waves with no tasks', () => {
    const waves = [
      { index: 0, tasks: [] },
      { index: 1, tasks: [createTask('a', [])] },
    ];

    expect(countTotalTasks(waves)).toBe(1);
  });
});

describe('getAllFiles', () => {
  it('returns empty array for no tasks', () => {
    expect(getAllFiles([])).toEqual([]);
  });

  it('returns unique files across all tasks', () => {
    const tasks = [
      createTask('a', ['src/a.ts', 'src/shared.ts']),
      createTask('b', ['src/b.ts', 'src/shared.ts']),
      createTask('c', ['src/c.ts']),
    ];

    const files = getAllFiles(tasks);
    expect(files).toHaveLength(4);
    expect(files).toContain('src/a.ts');
    expect(files).toContain('src/b.ts');
    expect(files).toContain('src/c.ts');
    expect(files).toContain('src/shared.ts');
  });

  it('returns sorted files', () => {
    const tasks = [createTask('a', ['src/z.ts', 'src/a.ts']), createTask('b', ['src/m.ts'])];

    const files = getAllFiles(tasks);
    expect(files).toEqual(['src/a.ts', 'src/m.ts', 'src/z.ts']);
  });

  it('handles tasks with no files', () => {
    const tasks = [createTask('a', []), createTask('b', ['src/b.ts'])];

    const files = getAllFiles(tasks);
    expect(files).toEqual(['src/b.ts']);
  });
});
