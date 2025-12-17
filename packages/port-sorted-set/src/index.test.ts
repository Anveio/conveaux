import { describe, expect, it } from 'vitest';
import {
  add,
  clear,
  createSortedSet,
  has,
  isEmpty,
  numberComparator,
  range,
  rank,
  remove,
  reverseNumberComparator,
  score,
  size,
  toArray,
  validateSortedSet,
} from './index';

describe('createSortedSet', () => {
  describe('creation', () => {
    it('creates an empty sorted set', () => {
      const set = createSortedSet<string>(numberComparator);

      expect(size(set)).toBe(0);
      expect(isEmpty(set)).toBe(true);
      expect(toArray(set)).toEqual([]);
    });

    it('accepts initialCapacity option (for future optimization)', () => {
      const set = createSortedSet<string>(numberComparator, { initialCapacity: 100 });

      expect(size(set)).toBe(0);
      expect(isEmpty(set)).toBe(true);
    });
  });

  describe('add', () => {
    it('adds items in sorted order by score', () => {
      let set = createSortedSet<string>(numberComparator);

      set = add(set, 'alice', 100);
      expect(size(set)).toBe(1);
      expect(toArray(set)).toEqual(['alice']);

      set = add(set, 'bob', 200);
      expect(toArray(set)).toEqual(['alice', 'bob']);

      set = add(set, 'charlie', 150);
      expect(toArray(set)).toEqual(['alice', 'charlie', 'bob']);
    });

    it('updates score when item already exists', () => {
      let set = createSortedSet<string>(numberComparator);

      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);
      expect(toArray(set)).toEqual(['alice', 'bob']);

      set = add(set, 'alice', 300);
      expect(size(set)).toBe(2);
      expect(toArray(set)).toEqual(['bob', 'alice']);
      expect(score(set, 'alice')).toBe(300);
    });

    it('handles multiple items with same score', () => {
      let set = createSortedSet<string>(numberComparator);

      set = add(set, 'alice', 100);
      set = add(set, 'bob', 100);
      set = add(set, 'charlie', 100);

      expect(size(set)).toBe(3);
      const items = toArray(set);
      expect(items).toContain('alice');
      expect(items).toContain('bob');
      expect(items).toContain('charlie');
    });

    it('maintains immutability', () => {
      const original = createSortedSet<string>(numberComparator);
      const modified = add(original, 'alice', 100);

      expect(size(original)).toBe(0);
      expect(size(modified)).toBe(1);
      expect(toArray(original)).toEqual([]);
      expect(toArray(modified)).toEqual(['alice']);
    });
  });

  describe('remove', () => {
    it('removes existing item', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);
      set = add(set, 'charlie', 150);

      const result = remove(set, 'charlie');
      expect(result.removed).toBe(true);
      expect(size(result.set)).toBe(2);
      expect(toArray(result.set)).toEqual(['alice', 'bob']);
    });

    it('returns false when item not found', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);

      const result = remove(set, 'bob');
      expect(result.removed).toBe(false);
      expect(size(result.set)).toBe(1);
      expect(toArray(result.set)).toEqual(['alice']);
    });

    it('maintains immutability', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      const result = remove(set, 'alice');

      expect(size(set)).toBe(2);
      expect(size(result.set)).toBe(1);
      expect(toArray(set)).toEqual(['alice', 'bob']);
      expect(toArray(result.set)).toEqual(['bob']);
    });
  });

  describe('rank', () => {
    it('returns rank of existing items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);
      set = add(set, 'charlie', 150);

      expect(rank(set, 'alice')).toBe(0);
      expect(rank(set, 'charlie')).toBe(1);
      expect(rank(set, 'bob')).toBe(2);
    });

    it('returns undefined for non-existent items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);

      expect(rank(set, 'bob')).toBeUndefined();
    });

    it('returns 0 for single item', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);

      expect(rank(set, 'alice')).toBe(0);
    });
  });

  describe('range', () => {
    it('returns items in specified range', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);
      set = add(set, 'charlie', 150);
      set = add(set, 'dave', 175);
      set = add(set, 'eve', 125);

      expect(range(set, 0, 2)).toEqual(['alice', 'eve']);
      expect(range(set, 1, 4)).toEqual(['eve', 'charlie', 'dave']);
      expect(range(set, 2, 5)).toEqual(['charlie', 'dave', 'bob']);
    });

    it('handles ranges outside bounds', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      expect(range(set, 0, 10)).toEqual(['alice', 'bob']);
      expect(range(set, 5, 10)).toEqual([]);
    });

    it('returns empty array for empty set', () => {
      const set = createSortedSet<string>(numberComparator);
      expect(range(set, 0, 5)).toEqual([]);
    });

    it('returns all items when range covers entire set', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);
      set = add(set, 'charlie', 150);

      expect(range(set, 0, 3)).toEqual(['alice', 'charlie', 'bob']);
    });
  });

  describe('score', () => {
    it('returns score of existing items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      expect(score(set, 'alice')).toBe(100);
      expect(score(set, 'bob')).toBe(200);
    });

    it('returns undefined for non-existent items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);

      expect(score(set, 'bob')).toBeUndefined();
    });

    it('returns updated score after modification', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'alice', 200);

      expect(score(set, 'alice')).toBe(200);
    });
  });

  describe('size', () => {
    it('returns correct size', () => {
      let set = createSortedSet<string>(numberComparator);
      expect(size(set)).toBe(0);

      set = add(set, 'alice', 100);
      expect(size(set)).toBe(1);

      set = add(set, 'bob', 200);
      expect(size(set)).toBe(2);

      const { set: afterRemove } = remove(set, 'alice');
      expect(size(afterRemove)).toBe(1);
    });
  });

  describe('isEmpty', () => {
    it('returns true for empty set', () => {
      const set = createSortedSet<string>(numberComparator);
      expect(isEmpty(set)).toBe(true);
    });

    it('returns false for non-empty set', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      expect(isEmpty(set)).toBe(false);
    });
  });

  describe('has', () => {
    it('returns true for existing items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      expect(has(set, 'alice')).toBe(true);
      expect(has(set, 'bob')).toBe(true);
    });

    it('returns false for non-existent items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);

      expect(has(set, 'bob')).toBe(false);
    });

    it('returns false for empty set', () => {
      const set = createSortedSet<string>(numberComparator);
      expect(has(set, 'alice')).toBe(false);
    });
  });

  describe('toArray', () => {
    it('returns empty array for empty set', () => {
      const set = createSortedSet<string>(numberComparator);
      expect(toArray(set)).toEqual([]);
    });

    it('returns items in sorted order', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'charlie', 150);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      expect(toArray(set)).toEqual(['alice', 'charlie', 'bob']);
    });

    it('does not modify the set', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      const array = toArray(set);
      expect(size(set)).toBe(2);
      expect(array).toEqual(['alice', 'bob']);
    });
  });

  describe('clear', () => {
    it('removes all items', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      const cleared = clear(set);

      expect(size(cleared)).toBe(0);
      expect(isEmpty(cleared)).toBe(true);
      expect(toArray(cleared)).toEqual([]);

      expect(size(set)).toBe(2);
    });

    it('preserves comparator', () => {
      let set = createSortedSet<string>(reverseNumberComparator);
      set = add(set, 'alice', 100);

      const cleared = clear(set);
      const withNew = add(cleared, 'bob', 200);

      expect(toArray(withNew)).toEqual(['bob']);
    });
  });

  describe('reverseNumberComparator', () => {
    it('sorts in descending order', () => {
      let set = createSortedSet<string>(reverseNumberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);
      set = add(set, 'charlie', 150);

      expect(toArray(set)).toEqual(['bob', 'charlie', 'alice']);
      expect(rank(set, 'bob')).toBe(0);
      expect(rank(set, 'alice')).toBe(2);
    });
  });

  describe('complex scenarios', () => {
    it('handles leaderboard use case', () => {
      let leaderboard = createSortedSet<string>(reverseNumberComparator);

      leaderboard = add(leaderboard, 'alice', 1000);
      leaderboard = add(leaderboard, 'bob', 1500);
      leaderboard = add(leaderboard, 'charlie', 1200);
      leaderboard = add(leaderboard, 'dave', 1800);

      const top3 = range(leaderboard, 0, 3);
      expect(top3).toEqual(['dave', 'bob', 'charlie']);

      leaderboard = add(leaderboard, 'alice', 2000);

      expect(rank(leaderboard, 'alice')).toBe(0);
      expect(score(leaderboard, 'alice')).toBe(2000);
    });

    it('handles time-series indexing use case', () => {
      let timeline = createSortedSet<string>(numberComparator);

      timeline = add(timeline, 'event1', 1000);
      timeline = add(timeline, 'event2', 3000);
      timeline = add(timeline, 'event3', 2000);
      timeline = add(timeline, 'event4', 1500);

      expect(toArray(timeline)).toEqual(['event1', 'event4', 'event3', 'event2']);

      const filtered = toArray(timeline).filter((event) => {
        const s = score(timeline, event);
        return s !== undefined && s >= 1500 && s <= 2500;
      });
      expect(filtered).toEqual(['event4', 'event3']);
    });

    it('handles objects as items', () => {
      type Player = { readonly id: number; readonly name: string };
      let set = createSortedSet<Player>(numberComparator);

      const player1: Player = { id: 1, name: 'Alice' };
      const player2: Player = { id: 2, name: 'Bob' };

      set = add(set, player1, 100);
      set = add(set, player2, 200);

      expect(rank(set, player1)).toBe(0);
      expect(score(set, player2)).toBe(200);
    });

    it('supports time-travel debugging pattern', () => {
      const history: (typeof set)[] = [];
      let set = createSortedSet<string>(numberComparator);
      history.push(set);

      set = add(set, 'alice', 100);
      history.push(set);

      set = add(set, 'bob', 200);
      history.push(set);

      set = add(set, 'charlie', 150);
      history.push(set);

      expect(toArray(history[0]!)).toEqual([]);
      expect(toArray(history[1]!)).toEqual(['alice']);
      expect(toArray(history[2]!)).toEqual(['alice', 'bob']);
      expect(toArray(history[3]!)).toEqual(['alice', 'charlie', 'bob']);
    });
  });

  describe('immutability', () => {
    it('add does not modify original set', () => {
      const original = createSortedSet<string>(numberComparator);
      const modified = add(original, 'alice', 100);

      expect(size(original)).toBe(0);
      expect(size(modified)).toBe(1);
      expect(toArray(original)).toEqual([]);
      expect(toArray(modified)).toEqual(['alice']);
    });

    it('remove does not modify original set', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      const originalSize = size(set);
      const { set: modified } = remove(set, 'alice');

      expect(size(set)).toBe(originalSize);
      expect(size(modified)).toBe(originalSize - 1);
      expect(toArray(set)).toEqual(['alice', 'bob']);
      expect(toArray(modified)).toEqual(['bob']);
    });

    it('clear does not modify original set', () => {
      let set = createSortedSet<string>(numberComparator);
      set = add(set, 'alice', 100);
      set = add(set, 'bob', 200);

      const cleared = clear(set);

      expect(size(set)).toBe(2);
      expect(size(cleared)).toBe(0);
    });
  });
});

describe('validateSortedSet', () => {
  it('validates a correct sorted set', () => {
    let set = createSortedSet<string>(numberComparator);
    set = add(set, 'alice', 100);
    set = add(set, 'bob', 200);

    const result = validateSortedSet(set);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid comparator', () => {
    const invalidSet = {
      entries: [],
      comparator: null as unknown as (a: number, b: number) => number,
    };

    const result = validateSortedSet(invalidSet);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_comparator');
  });

  it('detects invalid order', () => {
    const invalidSet = {
      entries: [
        { item: 'alice', score: 200 },
        { item: 'bob', score: 100 },
      ],
      comparator: numberComparator,
    };

    const result = validateSortedSet(invalidSet);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_order');
  });

  it('detects duplicate items', () => {
    const invalidSet = {
      entries: [
        { item: 'alice', score: 100 },
        { item: 'alice', score: 200 },
      ],
      comparator: numberComparator,
    };

    const result = validateSortedSet(invalidSet);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('duplicate_items');
  });

  it('detects multiple errors', () => {
    const invalidSet = {
      entries: [
        { item: 'alice', score: 200 },
        { item: 'bob', score: 100 },
        { item: 'bob', score: 150 },
      ],
      comparator: numberComparator,
    };

    const result = validateSortedSet(invalidSet);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('edge cases', () => {
  it('handles negative scores', () => {
    let set = createSortedSet<string>(numberComparator);
    set = add(set, 'alice', -100);
    set = add(set, 'bob', 100);
    set = add(set, 'charlie', 0);

    expect(toArray(set)).toEqual(['alice', 'charlie', 'bob']);
  });

  it('handles floating point scores', () => {
    let set = createSortedSet<string>(numberComparator);
    set = add(set, 'alice', 1.5);
    set = add(set, 'bob', 1.2);
    set = add(set, 'charlie', 1.8);

    expect(toArray(set)).toEqual(['bob', 'alice', 'charlie']);
  });

  it('handles very large scores', () => {
    let set = createSortedSet<string>(numberComparator);
    set = add(set, 'alice', Number.MAX_SAFE_INTEGER);
    set = add(set, 'bob', Number.MIN_SAFE_INTEGER);

    expect(toArray(set)).toEqual(['bob', 'alice']);
  });

  it('handles single item', () => {
    let set = createSortedSet<string>(numberComparator);
    set = add(set, 'alice', 100);

    expect(rank(set, 'alice')).toBe(0);
    expect(range(set, 0, 1)).toEqual(['alice']);
    expect(score(set, 'alice')).toBe(100);
  });

  it('handles add and remove alternating', () => {
    let set = createSortedSet<string>(numberComparator);

    set = add(set, 'alice', 100);
    const { set: set1 } = remove(set, 'alice');
    expect(size(set1)).toBe(0);

    const set2 = add(set1, 'bob', 200);
    expect(size(set2)).toBe(1);

    const { set: set3 } = remove(set2, 'bob');
    expect(size(set3)).toBe(0);
  });
});
