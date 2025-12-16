/**
 * Execution Planner - Groups tasks into parallel execution waves.
 *
 * Pure functions for planning task execution to maximize parallelism
 * while avoiding file conflicts.
 *
 * Key insight: Tasks with overlapping files cannot run in parallel,
 * so we group non-overlapping tasks into "waves" that execute together.
 */

import type { ClassifiedTask, ExecutionWave } from '@conveaux/contract-coordinator';

// =============================================================================
// Planning Options
// =============================================================================

/**
 * Options for execution planning.
 */
export interface ExecutionPlannerOptions {
  /** Maximum tasks per wave (default: unlimited) */
  readonly maxConcurrency?: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if two tasks have overlapping files.
 */
export function tasksOverlap(a: ClassifiedTask, b: ClassifiedTask): boolean {
  const aFiles = new Set(a.files);
  return b.files.some((f) => aFiles.has(f));
}

/**
 * Check if a task conflicts with any task in a wave.
 */
export function conflictsWithWave(task: ClassifiedTask, wave: readonly ClassifiedTask[]): boolean {
  return wave.some((waveTask) => tasksOverlap(task, waveTask));
}

// =============================================================================
// Planning Functions
// =============================================================================

/**
 * Plan execution waves to maximize parallelism while avoiding file conflicts.
 *
 * Algorithm:
 * 1. Sort tasks by priority (higher priority first)
 * 2. For each task, try to add to an existing wave with no conflicts
 * 3. If no suitable wave exists, create a new wave
 * 4. Respect maxConcurrency limit per wave
 *
 * @param tasks - Tasks to plan
 * @param options - Planning options
 * @returns Ordered waves of non-conflicting tasks
 */
export function planExecutionWaves(
  tasks: readonly ClassifiedTask[],
  options: ExecutionPlannerOptions = {}
): readonly ExecutionWave[] {
  const { maxConcurrency = Number.POSITIVE_INFINITY } = options;

  if (tasks.length === 0) {
    return [];
  }

  // Sort by priority (lower number = higher priority)
  const sortedTasks = [...tasks].sort((a, b) => a.priority - b.priority);

  const waves: ClassifiedTask[][] = [];

  for (const task of sortedTasks) {
    let placed = false;

    // Try to find an existing wave where this task fits
    for (const wave of waves) {
      if (wave.length < maxConcurrency && !conflictsWithWave(task, wave)) {
        wave.push(task);
        placed = true;
        break;
      }
    }

    // If no suitable wave found, create a new one
    if (!placed) {
      waves.push([task]);
    }
  }

  // Convert to ExecutionWave format
  return waves.map((tasks, index) => ({
    index,
    tasks,
  }));
}

/**
 * Calculate total task count across all waves.
 */
export function countTotalTasks(waves: readonly ExecutionWave[]): number {
  return waves.reduce((sum, wave) => sum + wave.tasks.length, 0);
}

/**
 * Get all unique files that will be modified across all tasks.
 */
export function getAllFiles(tasks: readonly ClassifiedTask[]): readonly string[] {
  const files = new Set<string>();
  for (const task of tasks) {
    for (const file of task.files) {
      files.add(file);
    }
  }
  return [...files].sort();
}
