import { describe, expect, it } from 'vitest';

import type { Dag } from '@conveaux/contract-dag';

import { detectCycles, validateDag } from './validation.js';

describe('validateDag', () => {
  it('returns valid for a well-formed DAG', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['a', 'b'] },
    ];

    const result = validateDag(dag);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for an empty DAG', () => {
    const dag: Dag<string> = [];

    const result = validateDag(dag);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid for a single node', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const result = validateDag(dag);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects duplicate node IDs', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A1', dependencies: [] },
      { id: 'a', data: 'A2', dependencies: [] },
    ];

    const result = validateDag(dag);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.type).toBe('duplicate_id');
    expect(error.nodeId).toBe('a');
    expect(error.details).toContain('Duplicate node ID');
  });

  it('detects self-references', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: ['a'] }];

    const result = validateDag(dag);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'self_reference')).toBe(true);
    const selfRefError = result.errors.find((e) => e.type === 'self_reference')!;
    expect(selfRefError.nodeId).toBe('a');
    expect(selfRefError.details).toContain('depends on itself');
  });

  it('detects missing dependencies', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: ['nonexistent'] }];

    const result = validateDag(dag);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.type).toBe('missing_dependency');
    expect(error.nodeId).toBe('a');
    expect(error.details).toContain('non-existent node "nonexistent"');
  });

  it('detects cycles', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: ['c'] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const result = validateDag(dag);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'cycle')).toBe(true);
  });

  it('detects multiple types of errors', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: ['a', 'missing'] }, // self-ref + missing
      { id: 'a', data: 'A2', dependencies: [] }, // duplicate
    ];

    const result = validateDag(dag);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe('detectCycles', () => {
  it('returns empty array for acyclic DAG', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const cycles = detectCycles(dag);

    expect(cycles).toHaveLength(0);
  });

  it('returns empty array for empty DAG', () => {
    const dag: Dag<string> = [];

    const cycles = detectCycles(dag);

    expect(cycles).toHaveLength(0);
  });

  it('detects simple cycle', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: ['b'] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];

    const cycles = detectCycles(dag);

    expect(cycles.length).toBeGreaterThan(0);
    // The cycle should contain both nodes
    const flatCycle = cycles.flat();
    expect(flatCycle).toContain('a');
    expect(flatCycle).toContain('b');
  });

  it('detects longer cycle', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: ['c'] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const cycles = detectCycles(dag);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('handles DAG with multiple independent components', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: ['a'] },
      { id: 'd', data: 'D', dependencies: ['b'] },
    ];

    const cycles = detectCycles(dag);

    expect(cycles).toHaveLength(0);
  });

  it('handles missing dependencies gracefully', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: ['nonexistent'] }];

    const cycles = detectCycles(dag);

    expect(cycles).toHaveLength(0);
  });
});
