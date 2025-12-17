import type { WallClock } from '@conveaux/contract-wall-clock';
import { describe, expect, it } from 'vitest';
import {
  add,
  clear,
  count,
  createSlidingWindow,
  getWindow,
  isEmpty,
  peekFirst,
  peekLast,
  prune,
  validateSlidingWindow,
} from './index';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock wall clock with controllable time.
 */
function createMockClock(initialTime = 1000): WallClock & { setTime: (time: number) => void } {
  let currentTime = initialTime;

  return {
    nowMs(): number {
      return currentTime;
    },
    setTime(time: number): void {
      currentTime = time;
    },
  };
}

// =============================================================================
// createSlidingWindow Tests
// =============================================================================

describe('createSlidingWindow', () => {
  describe('creation', () => {
    it('creates an empty count-based window with specified size', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 5 });

      expect(window.options.windowType).toBe('count');
      expect(window.options.windowSize).toBe(5);
      expect(window.entries).toEqual([]);
    });

    it('creates an empty time-based window with specified duration', () => {
      const window = createSlidingWindow<string>({ windowType: 'time', windowSize: 60000 });

      expect(window.options.windowType).toBe('time');
      expect(window.options.windowSize).toBe(60000);
      expect(window.entries).toEqual([]);
    });

    it('throws for non-positive window size', () => {
      expect(() => createSlidingWindow({ windowType: 'count', windowSize: 0 })).toThrow(
        'Window size must be a positive number, got: 0'
      );

      expect(() => createSlidingWindow({ windowType: 'count', windowSize: -1 })).toThrow(
        'Window size must be a positive number, got: -1'
      );
    });

    it('throws for non-finite window size', () => {
      expect(() =>
        createSlidingWindow({ windowType: 'count', windowSize: Number.POSITIVE_INFINITY })
      ).toThrow('Window size must be a positive number, got: Infinity');

      expect(() => createSlidingWindow({ windowType: 'count', windowSize: Number.NaN })).toThrow(
        'Window size must be a positive number, got: NaN'
      );
    });

    it('throws for invalid window type', () => {
      expect(() => createSlidingWindow({ windowType: 'invalid' as any, windowSize: 5 })).toThrow(
        "Window type must be 'count' or 'time', got: invalid"
      );
    });
  });
});

// =============================================================================
// Count-Based Window Tests
// =============================================================================

describe('count-based sliding window', () => {
  const clock = createMockClock(1000);

  describe('add', () => {
    it('adds elements to the window immutably', () => {
      const w0 = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      const w1 = add(w0, 1, clock);

      expect(w0.entries).toEqual([]); // Original unchanged
      expect(w1.entries.length).toBe(1);
      expect(w1.entries[0]?.item).toBe(1);

      const w2 = add(w1, 2, clock);
      const w3 = add(w2, 3, clock);

      expect(w3.entries.length).toBe(3);
      expect(getWindow(w3, clock)).toEqual([1, 2, 3]);
    });

    it('maintains maximum window size by dropping oldest elements', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      window = add(window, 1, clock);
      window = add(window, 2, clock);
      window = add(window, 3, clock);
      expect(getWindow(window, clock)).toEqual([1, 2, 3]);

      window = add(window, 4, clock);
      expect(window.entries.length).toBe(3);
      expect(getWindow(window, clock)).toEqual([2, 3, 4]);

      window = add(window, 5, clock);
      window = add(window, 6, clock);
      expect(getWindow(window, clock)).toEqual([4, 5, 6]);
    });

    it('uses explicit timestamp when provided', () => {
      const window = createSlidingWindow<string>({ windowType: 'count', windowSize: 3 });

      const w1 = add(window, 'a', clock, 100);
      const w2 = add(w1, 'b', clock, 200);

      expect(w2.entries[0]?.timestamp).toBe(100);
      expect(w2.entries[1]?.timestamp).toBe(200);
    });

    it('uses clock time when timestamp not provided', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      clock.setTime(5000);
      const w1 = add(window, 1, clock);

      expect(w1.entries[0]?.timestamp).toBe(5000);
    });
  });

  describe('getWindow', () => {
    it('returns empty array for empty window', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      expect(getWindow(window, clock)).toEqual([]);
    });

    it('returns items in order from oldest to newest', () => {
      let window = createSlidingWindow<string>({ windowType: 'count', windowSize: 5 });

      window = add(window, 'a', clock);
      window = add(window, 'b', clock);
      window = add(window, 'c', clock);

      expect(getWindow(window, clock)).toEqual(['a', 'b', 'c']);
    });

    it('does not modify window state', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      window = add(window, 1, clock);
      window = add(window, 2, clock);

      const itemsBefore = window.entries.length;
      getWindow(window, clock);

      expect(window.entries.length).toBe(itemsBefore);
    });
  });

  describe('count', () => {
    it('returns 0 for empty window', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      expect(count(window, clock)).toBe(0);
    });

    it('returns correct count of elements', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 5 });

      window = add(window, 1, clock);
      expect(count(window, clock)).toBe(1);

      window = add(window, 2, clock);
      expect(count(window, clock)).toBe(2);

      window = add(window, 3, clock);
      expect(count(window, clock)).toBe(3);
    });

    it('returns windowSize when window is full', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      window = add(window, 1, clock);
      window = add(window, 2, clock);
      window = add(window, 3, clock);
      window = add(window, 4, clock);

      expect(count(window, clock)).toBe(3);
    });
  });

  describe('clear', () => {
    it('removes all elements', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      window = add(window, 1, clock);
      window = add(window, 2, clock);
      window = add(window, 3, clock);

      const cleared = clear(window);

      expect(cleared.entries.length).toBe(0);
      expect(isEmpty(cleared, clock)).toBe(true);
      expect(getWindow(cleared, clock)).toEqual([]);

      // Original unchanged
      expect(window.entries.length).toBe(3);
    });

    it('preserves window options', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      window = add(window, 1, clock);

      const cleared = clear(window);

      expect(cleared.options.windowType).toBe('count');
      expect(cleared.options.windowSize).toBe(3);
    });

    it('allows adding after clear', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      window = add(window, 1, clock);
      window = add(window, 2, clock);

      let cleared = clear(window);
      cleared = add(cleared, 3, clock);

      expect(count(cleared, clock)).toBe(1);
      expect(getWindow(cleared, clock)).toEqual([3]);
    });
  });

  describe('isEmpty', () => {
    it('returns true for empty window', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      expect(isEmpty(window, clock)).toBe(true);
    });

    it('returns false for non-empty window', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      window = add(window, 1, clock);

      expect(isEmpty(window, clock)).toBe(false);
    });

    it('returns true after clearing', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      window = add(window, 1, clock);

      const cleared = clear(window);
      expect(isEmpty(cleared, clock)).toBe(true);
    });
  });

  describe('peekFirst', () => {
    it('returns undefined for empty window', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      expect(peekFirst(window, clock)).toBeUndefined();
    });

    it('returns oldest element without removing it', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      window = add(window, 1, clock);
      window = add(window, 2, clock);

      expect(peekFirst(window, clock)).toBe(1);
      expect(count(window, clock)).toBe(2); // Size unchanged
      expect(peekFirst(window, clock)).toBe(1); // Still same element
    });
  });

  describe('peekLast', () => {
    it('returns undefined for empty window', () => {
      const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      expect(peekLast(window, clock)).toBeUndefined();
    });

    it('returns newest element without removing it', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });

      window = add(window, 1, clock);
      expect(peekLast(window, clock)).toBe(1);

      window = add(window, 2, clock);
      expect(peekLast(window, clock)).toBe(2);

      window = add(window, 3, clock);
      expect(peekLast(window, clock)).toBe(3);
      expect(count(window, clock)).toBe(3);
    });
  });

  describe('prune', () => {
    it('returns same window reference for count-based windows', () => {
      let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
      window = add(window, 1, clock);
      window = add(window, 2, clock);

      const pruned = prune(window, clock);
      expect(pruned).toBe(window);
    });
  });
});

// =============================================================================
// Time-Based Window Tests
// =============================================================================

describe('time-based sliding window', () => {
  const clock = createMockClock(1000);

  describe('add', () => {
    it('adds elements with timestamps', () => {
      const window = createSlidingWindow<string>({ windowType: 'time', windowSize: 5000 });

      clock.setTime(1000);
      const w1 = add(window, 'a', clock);

      clock.setTime(2000);
      const w2 = add(w1, 'b', clock);

      expect(w2.entries[0]?.timestamp).toBe(1000);
      expect(w2.entries[1]?.timestamp).toBe(2000);
    });

    it('automatically prunes expired entries on add', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(1500);
      w = add(w, 2, clock);

      clock.setTime(2000);
      w = add(w, 3, clock);

      // At time 2000 with windowSize 1000, cutoff is 1000
      // Entry at 1000 is exactly at the boundary, kept with >= semantics
      expect(getWindow(w, clock)).toEqual([1, 2, 3]);

      // Advance time by 1ms to expire the first entry
      clock.setTime(2001);
      expect(getWindow(w, clock)).toEqual([2, 3]);
    });

    it('keeps all entries within time window', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 5000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(2000);
      w = add(w, 2, clock);

      clock.setTime(3000);
      w = add(w, 3, clock);

      // All entries are within 5000ms window
      expect(getWindow(w, clock)).toEqual([1, 2, 3]);
    });
  });

  describe('getWindow', () => {
    it('filters expired entries based on current time', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 2000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(2000);
      w = add(w, 2, clock);

      clock.setTime(3000);
      w = add(w, 3, clock);

      // At time 3000, only entries >= 1000 (3000 - 2000) are valid
      expect(getWindow(w, clock)).toEqual([1, 2, 3]);

      // Advance time so first entry expires
      clock.setTime(3500);
      expect(getWindow(w, clock)).toEqual([2, 3]);
    });

    it('returns empty array when all entries expired', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(2000);
      w = add(w, 2, clock);

      // Advance time beyond all entries
      clock.setTime(5000);
      expect(getWindow(w, clock)).toEqual([]);
    });
  });

  describe('count', () => {
    it('counts only non-expired entries', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 2000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(2000);
      w = add(w, 2, clock);

      clock.setTime(3000);
      w = add(w, 3, clock);

      expect(count(w, clock)).toBe(3);

      // Advance time to expire first entry
      clock.setTime(3500);
      expect(count(w, clock)).toBe(2);
    });
  });

  describe('isEmpty', () => {
    it('returns true when all entries expired', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      clock.setTime(1000);
      const w = add(window, 1, clock);

      expect(isEmpty(w, clock)).toBe(false);

      // Advance time beyond window
      clock.setTime(3000);
      expect(isEmpty(w, clock)).toBe(true);
    });
  });

  describe('prune', () => {
    it('removes expired entries', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(1500);
      w = add(w, 2, clock);

      clock.setTime(2000);
      w = add(w, 3, clock);

      expect(w.entries.length).toBe(3);

      // Prune at time 2500 - cutoff is 1500, entries at 1500 and 2000 remain
      clock.setTime(2500);
      const pruned = prune(w, clock);

      expect(pruned.entries.length).toBe(2);
      expect(getWindow(pruned, clock)).toEqual([2, 3]);

      // Prune at time 2501 - entry at 1500 now expires
      clock.setTime(2501);
      const pruned2 = prune(pruned, clock);
      expect(pruned2.entries.length).toBe(1);
      expect(getWindow(pruned2, clock)).toEqual([3]);
    });

    it('returns same reference when no entries expired', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 5000 });

      clock.setTime(1000);
      let w = add(window, 1, clock);

      clock.setTime(2000);
      w = add(w, 2, clock);

      // No entries expired yet
      const pruned = prune(w, clock);
      expect(pruned).toBe(w);
    });

    it('handles empty window', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      const pruned = prune(window, clock);
      expect(pruned.entries).toEqual([]);
    });
  });

  describe('peekFirst and peekLast with expiration', () => {
    it('peekFirst returns undefined when oldest entry expired', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      clock.setTime(1000);
      const w = add(window, 1, clock);

      expect(peekFirst(w, clock)).toBe(1);

      // Expire the entry
      clock.setTime(3000);
      expect(peekFirst(w, clock)).toBeUndefined();
    });

    it('peekLast returns undefined when all entries expired', () => {
      const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

      clock.setTime(1000);
      const w = add(window, 1, clock);

      expect(peekLast(w, clock)).toBe(1);

      // Expire the entry
      clock.setTime(3000);
      expect(peekLast(w, clock)).toBeUndefined();
    });
  });
});

// =============================================================================
// Immutability Tests
// =============================================================================

describe('immutability', () => {
  const clock = createMockClock(1000);

  it('add does not modify original window', () => {
    const original = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
    const added = add(original, 1, clock);

    expect(original.entries).toEqual([]);
    expect(added.entries.length).toBe(1);
    expect(getWindow(original, clock)).toEqual([]);
    expect(getWindow(added, clock)).toEqual([1]);
  });

  it('supports time-travel debugging pattern', () => {
    const history: ReturnType<typeof createSlidingWindow<number>>[] = [];

    let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
    history.push(window);

    window = add(window, 1, clock);
    history.push(window);

    window = add(window, 2, clock);
    history.push(window);

    window = add(window, 3, clock);
    history.push(window);

    // Can inspect any previous state
    expect(getWindow(history[0]!, clock)).toEqual([]);
    expect(getWindow(history[1]!, clock)).toEqual([1]);
    expect(getWindow(history[2]!, clock)).toEqual([1, 2]);
    expect(getWindow(history[3]!, clock)).toEqual([1, 2, 3]);
  });
});

// =============================================================================
// Complex Scenarios
// =============================================================================

describe('complex scenarios', () => {
  const clock = createMockClock(1000);

  it('handles window size of 1', () => {
    let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 1 });

    window = add(window, 1, clock);
    expect(getWindow(window, clock)).toEqual([1]);

    window = add(window, 2, clock);
    expect(count(window, clock)).toBe(1);
    expect(getWindow(window, clock)).toEqual([2]);
  });

  it('works with object types', () => {
    type Item = { readonly id: number; readonly name: string };
    let window = createSlidingWindow<Item>({ windowType: 'count', windowSize: 2 });

    window = add(window, { id: 1, name: 'one' }, clock);
    window = add(window, { id: 2, name: 'two' }, clock);

    expect(peekFirst(window, clock)).toEqual({ id: 1, name: 'one' });
    expect(peekLast(window, clock)).toEqual({ id: 2, name: 'two' });
  });

  it('handles rapid additions to time-based window', () => {
    let window = createSlidingWindow<number>({ windowType: 'time', windowSize: 100 });

    clock.setTime(1000);
    window = add(window, 1, clock);
    window = add(window, 2, clock);
    window = add(window, 3, clock);

    expect(count(window, clock)).toBe(3);

    // All added at same time, all should remain valid
    clock.setTime(1050);
    expect(count(window, clock)).toBe(3);

    // Advance beyond window
    clock.setTime(1150);
    expect(count(window, clock)).toBe(0);
  });

  it('handles mixed usage of explicit and clock timestamps', () => {
    let window = createSlidingWindow<string>({ windowType: 'time', windowSize: 1000 });

    // Use explicit timestamp
    window = add(window, 'a', clock, 1000);

    // Use clock time
    clock.setTime(1500);
    window = add(window, 'b', clock);

    // Mix again
    window = add(window, 'c', clock, 1800);

    expect(getWindow(window, clock)).toEqual(['a', 'b', 'c']);
  });
});

// =============================================================================
// validateSlidingWindow Tests
// =============================================================================

describe('validateSlidingWindow', () => {
  const clock = createMockClock(1000);

  it('validates a correct count-based window', () => {
    let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
    window = add(window, 1, clock);
    window = add(window, 2, clock);

    const result = validateSlidingWindow(window);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates a correct time-based window', () => {
    let window = createSlidingWindow<number>({ windowType: 'time', windowSize: 5000 });
    window = add(window, 1, clock);
    window = add(window, 2, clock);

    const result = validateSlidingWindow(window);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid window size', () => {
    const invalidWindow = {
      options: { windowType: 'count' as const, windowSize: 0 },
      entries: [],
    };

    const result = validateSlidingWindow(invalidWindow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_window_size');
  });

  it('detects invalid window type', () => {
    const invalidWindow = {
      options: { windowType: 'invalid' as any, windowSize: 5 },
      entries: [],
    };

    const result = validateSlidingWindow(invalidWindow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_window_type');
  });

  it('detects unsorted entries', () => {
    const invalidWindow = {
      options: { windowType: 'count' as const, windowSize: 5 },
      entries: [
        { item: 1, timestamp: 2000 },
        { item: 2, timestamp: 1000 }, // Out of order
      ],
    };

    const result = validateSlidingWindow(invalidWindow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('entries_not_sorted');
  });

  it('detects count window overflow', () => {
    const invalidWindow = {
      options: { windowType: 'count' as const, windowSize: 2 },
      entries: [
        { item: 1, timestamp: 1000 },
        { item: 2, timestamp: 2000 },
        { item: 3, timestamp: 3000 }, // Exceeds size
      ],
    };

    const result = validateSlidingWindow(invalidWindow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('count_window_overflow');
  });

  it('allows time-based window to have many entries', () => {
    const window = {
      options: { windowType: 'time' as const, windowSize: 1000 },
      entries: [
        { item: 1, timestamp: 1000 },
        { item: 2, timestamp: 1100 },
        { item: 3, timestamp: 1200 },
        { item: 4, timestamp: 1300 },
        { item: 5, timestamp: 1400 },
      ],
    };

    const result = validateSlidingWindow(window);
    expect(result.valid).toBe(true);
  });

  it('detects negative window size', () => {
    const invalidWindow = {
      options: { windowType: 'count' as const, windowSize: -5 },
      entries: [],
    };

    const result = validateSlidingWindow(invalidWindow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_window_size');
  });

  it('detects infinite window size', () => {
    const invalidWindow = {
      options: { windowType: 'time' as const, windowSize: Number.POSITIVE_INFINITY },
      entries: [],
    };

    const result = validateSlidingWindow(invalidWindow);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_window_size');
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  const clock = createMockClock(1000);

  it('handles very large window sizes', () => {
    const window = createSlidingWindow<number>({ windowType: 'count', windowSize: 1000000 });
    const w1 = add(window, 1, clock);

    expect(count(w1, clock)).toBe(1);
    expect(getWindow(w1, clock)).toEqual([1]);
  });

  it('handles very small time windows', () => {
    const window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1 });

    clock.setTime(1000);
    const w = add(window, 1, clock);

    // Even 1ms later, entry expires
    clock.setTime(1002);
    expect(count(w, clock)).toBe(0);
  });

  it('handles adding to empty window after clear', () => {
    let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
    window = add(window, 1, clock);
    window = add(window, 2, clock);

    window = clear(window);
    expect(isEmpty(window, clock)).toBe(true);

    window = add(window, 3, clock);
    expect(count(window, clock)).toBe(1);
    expect(peekFirst(window, clock)).toBe(3);
  });

  it('handles time going backwards (for time-based windows)', () => {
    let window = createSlidingWindow<number>({ windowType: 'time', windowSize: 1000 });

    clock.setTime(2000);
    window = add(window, 1, clock);

    // Time goes backward (e.g., clock adjustment)
    clock.setTime(1500);
    window = add(window, 2, clock);

    // Both entries should still be in the window based on current time
    expect(count(window, clock)).toBe(2);
  });

  it('handles multiple peek operations', () => {
    let window = createSlidingWindow<number>({ windowType: 'count', windowSize: 3 });
    window = add(window, 1, clock);
    window = add(window, 2, clock);
    window = add(window, 3, clock);

    // Multiple peeks shouldn't affect state
    expect(peekFirst(window, clock)).toBe(1);
    expect(peekFirst(window, clock)).toBe(1);
    expect(peekLast(window, clock)).toBe(3);
    expect(peekLast(window, clock)).toBe(3);
    expect(count(window, clock)).toBe(3);
  });
});
