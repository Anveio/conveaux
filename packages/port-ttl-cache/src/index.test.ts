import type { TTLCacheStorageFactory } from '@conveaux/contract-ttl-cache';
import type { WallClock } from '@conveaux/contract-wall-clock';
import { describe, expect, it } from 'vitest';
import {
  clear,
  createMapStorageFactory,
  createTTLCache,
  deleteKey,
  get,
  getKeys,
  getValues,
  has,
  prune,
  set,
  toArray,
  validateTTLCache,
} from './index';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock wall clock with controllable time.
 */
function createMockClock(initialTime = 0): WallClock & { setTime: (time: number) => void } {
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
// Tests
// =============================================================================

describe('createTTLCache', () => {
  const factory = createMapStorageFactory<string, number>();
  const clock = createMockClock(1000);

  describe('creation', () => {
    it('creates an empty cache with specified capacity and TTL', () => {
      const cache = createTTLCache(factory, {
        capacity: 5,
        ttlMs: 60000,
        wallClock: clock,
      });

      expect(cache.size).toBe(0);
      expect(cache.capacity).toBe(5);
      expect(cache.ttlMs).toBe(60000);
      expect(cache.head).toBeUndefined();
      expect(cache.tail).toBeUndefined();
    });

    it('throws for non-positive capacity', () => {
      expect(() =>
        createTTLCache(factory, {
          capacity: 0,
          ttlMs: 60000,
          wallClock: clock,
        })
      ).toThrow('Capacity must be a positive integer, got: 0');

      expect(() =>
        createTTLCache(factory, {
          capacity: -1,
          ttlMs: 60000,
          wallClock: clock,
        })
      ).toThrow('Capacity must be a positive integer, got: -1');
    });

    it('throws for non-integer capacity', () => {
      expect(() =>
        createTTLCache(factory, {
          capacity: 2.5,
          ttlMs: 60000,
          wallClock: clock,
        })
      ).toThrow('Capacity must be a positive integer, got: 2.5');
    });

    it('throws for non-positive TTL', () => {
      expect(() =>
        createTTLCache(factory, {
          capacity: 5,
          ttlMs: 0,
          wallClock: clock,
        })
      ).toThrow('TTL must be a positive number, got: 0');

      expect(() =>
        createTTLCache(factory, {
          capacity: 5,
          ttlMs: -1000,
          wallClock: clock,
        })
      ).toThrow('TTL must be a positive number, got: -1000');
    });

    it('throws for invalid TTL', () => {
      expect(() =>
        createTTLCache(factory, {
          capacity: 5,
          ttlMs: Number.NaN,
          wallClock: clock,
        })
      ).toThrow('TTL must be a positive number, got: NaN');
    });
  });

  describe('set', () => {
    it('adds entries to the cache immutably', () => {
      const clock = createMockClock(1000);
      const cache0 = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      const cache1 = set(cache0, 'a', 1);

      expect(cache0.size).toBe(0); // Original unchanged
      expect(cache1.size).toBe(1);

      const cache2 = set(cache1, 'b', 2);
      const cache3 = set(cache2, 'c', 3);

      expect(cache3.size).toBe(3);
    });

    it('updates existing keys with new timestamp', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      clock.setTime(2000);
      cache = set(cache, 'a', 100);

      expect(cache.size).toBe(2);
      expect(get(cache, 'a')).toBe(100);
    });

    it('moves updated keys to front', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);
      cache = set(cache, 'a', 100);

      expect(getKeys(cache)).toEqual(['a', 'c', 'b']);
    });

    it('evicts least recently used when full', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);
      expect(getKeys(cache)).toEqual(['c', 'b', 'a']);

      cache = set(cache, 'd', 4);
      expect(cache.size).toBe(3);
      expect(getKeys(cache)).toEqual(['d', 'c', 'b']);
      expect(has(cache, 'a')).toBe(false);

      cache = set(cache, 'e', 5);
      cache = set(cache, 'f', 6);
      expect(getKeys(cache)).toEqual(['f', 'e', 'd']);
    });

    it('sets creation timestamp using wall clock', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 5000, // 5 seconds
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      expect(get(cache, 'a')).toBe(1);

      // Move time forward by 4 seconds (still valid)
      clock.setTime(5000);
      expect(get(cache, 'a')).toBe(1);

      // Move time forward by 1 more second (now expired)
      clock.setTime(6000);
      expect(get(cache, 'a')).toBeUndefined();
    });
  });

  describe('get', () => {
    it('returns undefined for non-existent keys', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      expect(get(cache, 'nonexistent')).toBeUndefined();
    });

    it('returns value for existing keys', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(get(cache, 'a')).toBe(1);
      expect(get(cache, 'b')).toBe(2);
      expect(get(cache, 'c')).toBe(3);
    });

    it('returns undefined for expired entries', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 5000, // 5 seconds TTL
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      expect(get(cache, 'a')).toBe(1);

      // Move time forward past TTL
      clock.setTime(6001);
      expect(get(cache, 'a')).toBeUndefined();
      expect(get(cache, 'b')).toBeUndefined();
    });

    it('handles entries with different ages', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 5000, // 5 seconds TTL
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(3000); // 2 seconds later
      cache = set(cache, 'b', 2);

      // At time 5000, 'a' is 4s old (valid), 'b' is 2s old (valid)
      clock.setTime(5000);
      expect(get(cache, 'a')).toBe(1);
      expect(get(cache, 'b')).toBe(2);

      // At time 6001, 'a' is 5001ms old (expired), 'b' is 3001ms old (valid)
      clock.setTime(6001);
      expect(get(cache, 'a')).toBeUndefined();
      expect(get(cache, 'b')).toBe(2);
    });

    it('does not modify cache', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);

      const value = get(cache, 'a');
      expect(value).toBe(1);
      expect(cache.size).toBe(1);
    });
  });

  describe('has', () => {
    it('returns false for empty cache', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      expect(has(cache, 'a')).toBe(false);
    });

    it('returns true for existing non-expired keys', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      expect(has(cache, 'a')).toBe(true);
      expect(has(cache, 'b')).toBe(true);
      expect(has(cache, 'c')).toBe(false);
    });

    it('returns false for expired keys', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 5000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);

      expect(has(cache, 'a')).toBe(true);

      clock.setTime(6001);
      expect(has(cache, 'a')).toBe(false);
    });
  });

  describe('deleteKey', () => {
    it('returns same cache for non-existent keys', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      const result = deleteKey(cache, 'nonexistent');

      expect(result).toBe(cache);
    });

    it('removes existing keys', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      cache = deleteKey(cache, 'b');
      expect(cache.size).toBe(2);
      expect(has(cache, 'b')).toBe(false);
      expect(getKeys(cache)).toEqual(['c', 'a']);
    });

    it('handles deleting head', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      cache = deleteKey(cache, 'c');
      expect(getKeys(cache)).toEqual(['b', 'a']);
      expect(cache.head).toBe('b');
    });

    it('handles deleting tail', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      cache = deleteKey(cache, 'a');
      expect(getKeys(cache)).toEqual(['c', 'b']);
      expect(cache.tail).toBe('b');
    });

    it('handles deleting only entry', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);

      cache = deleteKey(cache, 'a');
      expect(cache.size).toBe(0);
      expect(cache.head).toBeUndefined();
      expect(cache.tail).toBeUndefined();
    });
  });

  describe('prune', () => {
    it('removes all expired entries', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 5,
        ttlMs: 5000, // 5 seconds
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(2000);
      cache = set(cache, 'b', 2);
      clock.setTime(3000);
      cache = set(cache, 'c', 3);

      expect(cache.size).toBe(3);

      // Move time to 7000 - 'a' is 6000ms old (expired), 'b' is 5000ms old (expired), 'c' is 4000ms old (valid)
      clock.setTime(7000);
      cache = prune(cache);

      expect(cache.size).toBe(1);
      expect(has(cache, 'a')).toBe(false);
      expect(has(cache, 'b')).toBe(false);
      expect(has(cache, 'c')).toBe(true);
    });

    it('returns same cache reference if no entries expired', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      const pruned = prune(cache);
      expect(pruned).toBe(cache);
    });

    it('handles empty cache', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });

      const pruned = prune(cache);
      expect(pruned).toBe(cache);
      expect(pruned.size).toBe(0);
    });

    it('handles all entries expired', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 5000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      clock.setTime(10000);
      cache = prune(cache);

      expect(cache.size).toBe(0);
      expect(cache.head).toBeUndefined();
      expect(cache.tail).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      const cleared = clear(cache, factory);

      expect(cleared.size).toBe(0);
      expect(cleared.head).toBeUndefined();
      expect(cleared.tail).toBeUndefined();
      expect(toArray(cleared)).toEqual([]);

      // Original unchanged
      expect(cache.size).toBe(3);
    });

    it('preserves capacity and TTL', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      const cleared = clear(cache, factory);

      expect(cleared.capacity).toBe(3);
      expect(cleared.ttlMs).toBe(60000);
      expect(cleared.wallClock).toBe(clock);
    });

    it('allows set after clear', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      let cleared = clear(cache, factory);
      cleared = set(cleared, 'c', 3);

      expect(cleared.size).toBe(1);
      expect(get(cleared, 'c')).toBe(3);
    });
  });

  describe('toArray', () => {
    it('returns empty array for empty cache', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      expect(toArray(cache)).toEqual([]);
    });

    it('returns entries in order from most to least recently used', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 5,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(toArray(cache)).toEqual([
        ['c', 3],
        ['b', 2],
        ['a', 1],
      ]);
    });

    it('excludes expired entries', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 5,
        ttlMs: 5000,
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(2000);
      cache = set(cache, 'b', 2);
      clock.setTime(3000);
      cache = set(cache, 'c', 3);

      // At time 7000, 'a' and 'b' are expired, only 'c' is valid
      clock.setTime(7000);
      expect(toArray(cache)).toEqual([['c', 3]]);
    });

    it('does not modify cache state', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      toArray(cache);

      expect(cache.size).toBe(2);
      expect(get(cache, 'a')).toBe(1);
    });
  });

  describe('getKeys', () => {
    it('returns empty array for empty cache', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      expect(getKeys(cache)).toEqual([]);
    });

    it('returns keys in order from most to least recently used', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(getKeys(cache)).toEqual(['c', 'b', 'a']);
    });

    it('excludes expired entries', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 5,
        ttlMs: 5000,
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(2000);
      cache = set(cache, 'b', 2);
      clock.setTime(3000);
      cache = set(cache, 'c', 3);

      clock.setTime(7000);
      expect(getKeys(cache)).toEqual(['c']);
    });
  });

  describe('getValues', () => {
    it('returns empty array for empty cache', () => {
      const clock = createMockClock(1000);
      const cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      expect(getValues(cache)).toEqual([]);
    });

    it('returns values in order from most to least recently used', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(getValues(cache)).toEqual([3, 2, 1]);
    });

    it('excludes expired entries', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 5,
        ttlMs: 5000,
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(2000);
      cache = set(cache, 'b', 2);
      clock.setTime(3000);
      cache = set(cache, 'c', 3);

      clock.setTime(7000);
      expect(getValues(cache)).toEqual([3]);
    });
  });

  describe('immutability', () => {
    it('set does not modify original cache', () => {
      const clock = createMockClock(1000);
      const original = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      const updated = set(original, 'a', 1);

      expect(original.size).toBe(0);
      expect(updated.size).toBe(1);
      expect(toArray(original)).toEqual([]);
      expect(toArray(updated)).toEqual([['a', 1]]);
    });

    it('deleteKey does not modify original cache', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      const originalSize = cache.size;
      const deleted = deleteKey(cache, 'a');

      expect(cache.size).toBe(originalSize);
      expect(deleted.size).toBe(originalSize - 1);
    });

    it('prune does not modify original cache', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 5000,
        wallClock: clock,
      });
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      clock.setTime(6001);
      const pruned = prune(cache);

      expect(cache.size).toBe(2);
      expect(pruned.size).toBe(0);
    });
  });

  describe('complex scenarios', () => {
    it('handles interleaved set, get, and delete with expiration', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 3,
        ttlMs: 10000, // 10 seconds
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(2000);
      cache = set(cache, 'b', 2);

      expect(get(cache, 'a')).toBe(1);

      clock.setTime(5000);
      cache = set(cache, 'c', 3);
      cache = set(cache, 'd', 4); // Evicts 'a' (least recently used)

      expect(has(cache, 'a')).toBe(false);

      clock.setTime(12001); // 'b' is now expired (12001 - 2000 = 10001ms > 10000ms)
      expect(get(cache, 'b')).toBeUndefined();
      expect(get(cache, 'c')).toBe(3);
      expect(get(cache, 'd')).toBe(4);

      cache = deleteKey(cache, 'c');
      expect(getKeys(cache)).toEqual(['d']);
    });

    it('handles capacity of 1', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 1,
        ttlMs: 60000,
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      expect(cache.size).toBe(1);
      expect(get(cache, 'a')).toBe(1);

      cache = set(cache, 'b', 2);
      expect(cache.size).toBe(1);
      expect(get(cache, 'b')).toBe(2);
      expect(has(cache, 'a')).toBe(false);
    });

    it('works with numeric keys', () => {
      const clock = createMockClock(1000);
      const numFactory = createMapStorageFactory<number, string>();
      let cache = createTTLCache(numFactory, {
        capacity: 3,
        ttlMs: 60000,
        wallClock: clock,
      });

      cache = set(cache, 1, 'one');
      cache = set(cache, 2, 'two');
      cache = set(cache, 3, 'three');

      expect(get(cache, 1)).toBe('one');
      expect(getKeys(cache)).toEqual([3, 2, 1]);
    });

    it('works with object values', () => {
      const clock = createMockClock(1000);
      type Value = { readonly id: number; readonly name: string };
      const objFactory = createMapStorageFactory<string, Value>();
      let cache = createTTLCache(objFactory, {
        capacity: 2,
        ttlMs: 60000,
        wallClock: clock,
      });

      cache = set(cache, 'a', { id: 1, name: 'one' });
      cache = set(cache, 'b', { id: 2, name: 'two' });

      expect(get(cache, 'a')).toEqual({ id: 1, name: 'one' });
      expect(get(cache, 'b')).toEqual({ id: 2, name: 'two' });
    });

    it('maintains LRU order through mixed operations with TTL', () => {
      const clock = createMockClock(1000);
      let cache = createTTLCache(factory, {
        capacity: 4,
        ttlMs: 10000,
        wallClock: clock,
      });

      cache = set(cache, 'a', 1);
      clock.setTime(2000);
      cache = set(cache, 'b', 2);
      clock.setTime(3000);
      cache = set(cache, 'c', 3);
      clock.setTime(4000);
      cache = set(cache, 'd', 4);

      // Update 'b' - should move to front
      clock.setTime(5000);
      cache = set(cache, 'b', 20);
      expect(getKeys(cache)).toEqual(['b', 'd', 'c', 'a']);

      // Add new entry - should evict 'a' (least recently used)
      clock.setTime(6000);
      cache = set(cache, 'e', 5);
      expect(getKeys(cache)).toEqual(['e', 'b', 'd', 'c']);
      expect(has(cache, 'a')).toBe(false);

      // At time 12000, 'b' should still be valid (set at 5000), but original entries are old
      clock.setTime(12000);
      expect(has(cache, 'b')).toBe(true); // 7000ms old (valid, < 10000ms TTL)
      expect(has(cache, 'd')).toBe(true); // 8000ms old (valid, < 10000ms TTL)
      expect(has(cache, 'c')).toBe(true); // 9000ms old (valid, < 10000ms TTL)
      expect(has(cache, 'e')).toBe(true); // 6000ms old (valid, < 10000ms TTL)

      // At time 13001, 'c' should be expired (set at 3000, now 10001ms old)
      clock.setTime(13001);
      expect(has(cache, 'c')).toBe(false); // 10001ms old (expired)
      expect(has(cache, 'd')).toBe(true); // 9001ms old (valid)
      expect(has(cache, 'e')).toBe(true); // 7001ms old (valid)
      expect(has(cache, 'b')).toBe(true); // 8001ms old (valid)
    });
  });
});

describe('validateTTLCache', () => {
  const factory = createMapStorageFactory<string, number>();
  const clock = createMockClock(1000);

  it('validates a correct cache', () => {
    let cache = createTTLCache(factory, {
      capacity: 3,
      ttlMs: 60000,
      wallClock: clock,
    });
    cache = set(cache, 'a', 1);
    cache = set(cache, 'b', 2);

    const result = validateTTLCache(cache);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates a single-entry cache', () => {
    let cache = createTTLCache(factory, {
      capacity: 3,
      ttlMs: 60000,
      wallClock: clock,
    });
    cache = set(cache, 'a', 1);

    const result = validateTTLCache(cache);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates an empty cache', () => {
    const cache = createTTLCache(factory, {
      capacity: 3,
      ttlMs: 60000,
      wallClock: clock,
    });
    const result = validateTTLCache(cache);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid capacity', () => {
    const invalidCache = {
      head: undefined,
      tail: undefined,
      size: 0,
      capacity: 0,
      ttlMs: 60000,
      storage: factory.create(),
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_capacity');
  });

  it('detects invalid TTL', () => {
    const invalidCache = {
      head: undefined,
      tail: undefined,
      size: 0,
      capacity: 3,
      ttlMs: 0,
      storage: factory.create(),
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_ttl');
  });

  it('detects invalid size', () => {
    const invalidCache = {
      head: undefined,
      tail: undefined,
      size: 10, // Exceeds capacity
      capacity: 3,
      ttlMs: 60000,
      storage: factory.create(),
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_size');
  });

  it('detects invalid links for empty cache', () => {
    const invalidCache = {
      head: 'a' as string,
      tail: undefined,
      size: 0,
      capacity: 3,
      ttlMs: 60000,
      storage: factory.create(),
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });

  it('detects single entry with mismatched head/tail', () => {
    const storage = factory.create();
    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: undefined,
    });

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 1,
      capacity: 3,
      ttlMs: 60000,
      storage,
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });

  it('detects size mismatch', () => {
    const storage = factory.create();
    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: 'b',
    });
    storage.set('b', {
      key: 'b',
      entry: { value: 2, createdAt: 1000 },
      prev: 'a',
      next: undefined,
    });

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 5, // Wrong size
      capacity: 3,
      ttlMs: 60000,
      storage,
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'size_mismatch')).toBe(true);
  });

  it('detects orphaned nodes', () => {
    const storage = factory.create();
    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: 'b',
    });
    // 'b' is referenced but not in storage

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 2,
      capacity: 3,
      ttlMs: 60000,
      storage,
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'orphaned_nodes')).toBe(true);
  });

  it('detects broken bidirectional links', () => {
    const storage = factory.create();
    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: 'b',
    });
    storage.set('b', {
      key: 'b',
      entry: { value: 2, createdAt: 1000 },
      prev: 'c',
      next: undefined,
    }); // Should be prev: 'a'

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 2,
      capacity: 3,
      ttlMs: 60000,
      storage,
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });

  it('detects cycles in linked list', () => {
    const storage = factory.create();
    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: 'b',
    });
    storage.set('b', { key: 'b', entry: { value: 2, createdAt: 1000 }, prev: 'a', next: 'a' }); // Cycle back to 'a'

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 2,
      capacity: 3,
      ttlMs: 60000,
      storage,
      wallClock: clock,
    };

    const result = validateTTLCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });
});

describe('createMapStorageFactory', () => {
  it('creates storage that can store and retrieve entries', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    const node1 = {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: undefined,
    };
    const node2 = {
      key: 'b',
      entry: { value: 2, createdAt: 2000 },
      prev: undefined,
      next: undefined,
    };

    storage.set('a', node1);
    storage.set('b', node2);

    expect(storage.get('a')).toEqual(node1);
    expect(storage.get('b')).toEqual(node2);
  });

  it('returns undefined for non-existent keys', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    expect(storage.get('nonexistent')).toBeUndefined();
  });

  it('can delete entries', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    const node = {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: undefined,
    };
    storage.set('a', node);

    expect(storage.has('a')).toBe(true);
    expect(storage.delete('a')).toBe(true);
    expect(storage.has('a')).toBe(false);
    expect(storage.delete('a')).toBe(false);
  });

  it('can clear all entries', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: undefined,
    });
    storage.set('b', {
      key: 'b',
      entry: { value: 2, createdAt: 2000 },
      prev: undefined,
      next: undefined,
    });

    storage.clear();

    expect(storage.has('a')).toBe(false);
    expect(storage.has('b')).toBe(false);
  });

  it('clone creates independent copy', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: undefined,
    });
    storage.set('b', {
      key: 'b',
      entry: { value: 2, createdAt: 2000 },
      prev: undefined,
      next: undefined,
    });

    const cloned = storage.clone();
    cloned.set('a', {
      key: 'a',
      entry: { value: 100, createdAt: 3000 },
      prev: undefined,
      next: undefined,
    });

    expect(storage.get('a')?.entry.value).toBe(1); // Original unchanged
    expect(cloned.get('a')?.entry.value).toBe(100); // Clone modified
    expect(cloned.get('b')?.entry.value).toBe(2); // Other values copied
  });

  it('supports keys() iterator', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    storage.set('a', {
      key: 'a',
      entry: { value: 1, createdAt: 1000 },
      prev: undefined,
      next: undefined,
    });
    storage.set('b', {
      key: 'b',
      entry: { value: 2, createdAt: 2000 },
      prev: undefined,
      next: undefined,
    });
    storage.set('c', {
      key: 'c',
      entry: { value: 3, createdAt: 3000 },
      prev: undefined,
      next: undefined,
    });

    const keys = Array.from(storage.keys());
    expect(keys.sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('custom storage factory', () => {
  it('allows injection of custom storage implementation', () => {
    const clock = createMockClock(1000);
    const operations: string[] = [];

    const createTrackedStorage = (
      data: Map<string, any>,
      label: string
    ): ReturnType<TTLCacheStorageFactory<string, number>['create']> => ({
      get(key: string) {
        operations.push(`${label}:get(${key})`);
        return data.get(key);
      },
      set(key: string, value: any) {
        operations.push(`${label}:set(${key})`);
        data.set(key, value);
      },
      delete(key: string) {
        operations.push(`${label}:delete(${key})`);
        return data.delete(key);
      },
      has(key: string) {
        operations.push(`${label}:has(${key})`);
        return data.has(key);
      },
      clear() {
        operations.push(`${label}:clear()`);
        data.clear();
      },
      clone() {
        operations.push(`${label}:clone()`);
        const clonedData = new Map(data);
        const cloneLabel = `${label}-clone`;
        return createTrackedStorage(clonedData, cloneLabel);
      },
      keys() {
        operations.push(`${label}:keys()`);
        return data.keys();
      },
    });

    const customFactory: TTLCacheStorageFactory<string, number> = {
      create() {
        operations.push('create()');
        return createTrackedStorage(new Map(), 'storage');
      },
    };

    let cache = createTTLCache(customFactory, {
      capacity: 2,
      ttlMs: 60000,
      wallClock: clock,
    });
    cache = set(cache, 'a', 1);
    cache = set(cache, 'b', 2);
    get(cache, 'a');

    // Factory creates initial storage
    expect(operations).toContain('create()');
    // Set clones storage for immutability
    expect(operations).toContain('storage:clone()');
    // Set operations happen on cloned storage
    expect(operations.some((op) => op.includes(':set(a)'))).toBe(true);
    // Get reads from storage
    expect(operations.some((op) => op.includes(':get(a)'))).toBe(true);
  });
});
