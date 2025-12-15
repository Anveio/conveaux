import { describe, expect, it } from 'vitest';

import type { Dag } from '@conveaux/contract-dag';

import { getDependents, getLeaves, getNode, getRoots, getTopologicalOrder } from './query.js';

describe('getTopologicalOrder', () => {
  it('returns correct order for linear DAG', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const order = getTopologicalOrder(dag);

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('returns correct order for diamond DAG', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['a'] },
      { id: 'd', data: 'D', dependencies: ['b', 'c'] },
    ];

    const order = getTopologicalOrder(dag);

    // 'a' must come first, 'd' must come last
    expect(order[0]).toBe('a');
    expect(order[order.length - 1]).toBe('d');
    // 'b' and 'c' must come after 'a' but before 'd'
    expect(order.indexOf('b')).toBeGreaterThan(order.indexOf('a'));
    expect(order.indexOf('c')).toBeGreaterThan(order.indexOf('a'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('d'));
    expect(order.indexOf('c')).toBeLessThan(order.indexOf('d'));
  });

  it('returns empty array for empty DAG', () => {
    const dag: Dag<string> = [];

    const order = getTopologicalOrder(dag);

    expect(order).toEqual([]);
  });

  it('returns single element for single node', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const order = getTopologicalOrder(dag);

    expect(order).toEqual(['a']);
  });

  it('returns all roots first when multiple roots exist', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: ['a', 'b'] },
    ];

    const order = getTopologicalOrder(dag);

    // Both 'a' and 'b' should come before 'c'
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
    expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'));
  });

  it('throws for cyclic DAG', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: ['b'] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];

    expect(() => getTopologicalOrder(dag)).toThrow('DAG contains cycles');
  });
});

describe('getRoots', () => {
  it('returns nodes with no dependencies', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const roots = getRoots(dag);

    expect(roots).toEqual(['a']);
  });

  it('returns multiple roots', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
      { id: 'c', data: 'C', dependencies: ['a', 'b'] },
    ];

    const roots = getRoots(dag);

    expect(roots).toHaveLength(2);
    expect(roots).toContain('a');
    expect(roots).toContain('b');
  });

  it('returns empty array when no roots', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: ['b'] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];

    const roots = getRoots(dag);

    expect(roots).toEqual([]);
  });

  it('returns empty array for empty DAG', () => {
    const dag: Dag<string> = [];

    const roots = getRoots(dag);

    expect(roots).toEqual([]);
  });

  it('returns all nodes when all are roots', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
    ];

    const roots = getRoots(dag);

    expect(roots).toHaveLength(2);
    expect(roots).toContain('a');
    expect(roots).toContain('b');
  });
});

describe('getLeaves', () => {
  it('returns nodes that nothing depends on', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['b'] },
    ];

    const leaves = getLeaves(dag);

    expect(leaves).toEqual(['c']);
  });

  it('returns multiple leaves', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['a'] },
    ];

    const leaves = getLeaves(dag);

    expect(leaves).toHaveLength(2);
    expect(leaves).toContain('b');
    expect(leaves).toContain('c');
  });

  it('returns empty array for empty DAG', () => {
    const dag: Dag<string> = [];

    const leaves = getLeaves(dag);

    expect(leaves).toEqual([]);
  });

  it('returns single node when DAG has one node', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const leaves = getLeaves(dag);

    expect(leaves).toEqual(['a']);
  });

  it('returns all nodes when all are leaves', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: [] },
    ];

    const leaves = getLeaves(dag);

    expect(leaves).toHaveLength(2);
    expect(leaves).toContain('a');
    expect(leaves).toContain('b');
  });
});

describe('getDependents', () => {
  it('returns nodes that depend on the given node', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
      { id: 'c', data: 'C', dependencies: ['a'] },
      { id: 'd', data: 'D', dependencies: ['b'] },
    ];

    const dependents = getDependents(dag, 'a');

    expect(dependents).toHaveLength(2);
    expect(dependents).toContain('b');
    expect(dependents).toContain('c');
  });

  it('returns empty array for leaf node', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];

    const dependents = getDependents(dag, 'b');

    expect(dependents).toEqual([]);
  });

  it('returns empty array for non-existent node', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const dependents = getDependents(dag, 'nonexistent');

    expect(dependents).toEqual([]);
  });

  it('returns empty array for empty DAG', () => {
    const dag: Dag<string> = [];

    const dependents = getDependents(dag, 'a');

    expect(dependents).toEqual([]);
  });
});

describe('getNode', () => {
  it('returns node by ID', () => {
    const dag: Dag<string> = [
      { id: 'a', data: 'A', dependencies: [] },
      { id: 'b', data: 'B', dependencies: ['a'] },
    ];

    const node = getNode(dag, 'b');

    expect(node).toBeDefined();
    expect(node!.id).toBe('b');
    expect(node!.data).toBe('B');
    expect(node!.dependencies).toEqual(['a']);
  });

  it('returns undefined for non-existent node', () => {
    const dag: Dag<string> = [{ id: 'a', data: 'A', dependencies: [] }];

    const node = getNode(dag, 'nonexistent');

    expect(node).toBeUndefined();
  });

  it('returns undefined for empty DAG', () => {
    const dag: Dag<string> = [];

    const node = getNode(dag, 'a');

    expect(node).toBeUndefined();
  });
});
