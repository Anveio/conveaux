import type { LRUCacheStorageFactory } from '@conveaux/contract-lru-cache';
import { describe, expect, it } from 'vitest';
import {
  clear,
  createLRUCache,
  createMapStorageFactory,
  deleteKey,
  get,
  getKeys,
  getValues,
  has,
  set,
  toArray,
  validateLRUCache,
} from './index';

describe('createLRUCache', () => {
  const factory = createMapStorageFactory<string, number>();

  describe('creation', () => {
    it('creates an empty cache with specified capacity', () => {
      const cache = createLRUCache(factory, 5);

      expect(cache.size).toBe(0);
      expect(cache.capacity).toBe(5);
      expect(cache.head).toBeUndefined();
      expect(cache.tail).toBeUndefined();
    });

    it('throws for non-positive capacity', () => {
      expect(() => createLRUCache(factory, 0)).toThrow(
        'Capacity must be a positive integer, got: 0'
      );
      expect(() => createLRUCache(factory, -1)).toThrow(
        'Capacity must be a positive integer, got: -1'
      );
    });

    it('throws for non-integer capacity', () => {
      expect(() => createLRUCache(factory, 2.5)).toThrow(
        'Capacity must be a positive integer, got: 2.5'
      );
    });
  });

  describe('set', () => {
    it('adds entries to the cache immutably', () => {
      const cache0 = createLRUCache(factory, 3);
      const cache1 = set(cache0, 'a', 1);

      expect(cache0.size).toBe(0); // Original unchanged
      expect(cache1.size).toBe(1);

      const cache2 = set(cache1, 'b', 2);
      const cache3 = set(cache2, 'c', 3);

      expect(cache3.size).toBe(3);
    });

    it('updates existing keys', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'a', 100);

      expect(cache.size).toBe(2);
      expect(get(cache, 'a')).toBe(100);
    });

    it('moves updated keys to front', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);
      cache = set(cache, 'a', 100);

      expect(getKeys(cache)).toEqual(['a', 'c', 'b']);
    });

    it('evicts least recently used when full', () => {
      let cache = createLRUCache(factory, 3);
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
  });

  describe('get', () => {
    it('returns undefined for non-existent keys', () => {
      const cache = createLRUCache(factory, 3);
      expect(get(cache, 'nonexistent')).toBeUndefined();
    });

    it('returns value for existing keys', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(get(cache, 'a')).toBe(1);
      expect(get(cache, 'b')).toBe(2);
      expect(get(cache, 'c')).toBe(3);
    });

    it('does not modify cache', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);

      const value = get(cache, 'a');
      expect(value).toBe(1);
      expect(cache.size).toBe(1);
    });
  });

  describe('has', () => {
    it('returns false for empty cache', () => {
      const cache = createLRUCache(factory, 3);
      expect(has(cache, 'a')).toBe(false);
    });

    it('returns true for existing keys', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      expect(has(cache, 'a')).toBe(true);
      expect(has(cache, 'b')).toBe(true);
      expect(has(cache, 'c')).toBe(false);
    });
  });

  describe('deleteKey', () => {
    it('returns same cache for non-existent keys', () => {
      const cache = createLRUCache(factory, 3);
      const result = deleteKey(cache, 'nonexistent');

      expect(result).toBe(cache);
    });

    it('removes existing keys', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      cache = deleteKey(cache, 'b');
      expect(cache.size).toBe(2);
      expect(has(cache, 'b')).toBe(false);
      expect(getKeys(cache)).toEqual(['c', 'a']);
    });

    it('handles deleting head', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      cache = deleteKey(cache, 'c');
      expect(getKeys(cache)).toEqual(['b', 'a']);
      expect(cache.head).toBe('b');
    });

    it('handles deleting tail', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      cache = deleteKey(cache, 'a');
      expect(getKeys(cache)).toEqual(['c', 'b']);
      expect(cache.tail).toBe('b');
    });

    it('handles deleting only entry', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);

      cache = deleteKey(cache, 'a');
      expect(cache.size).toBe(0);
      expect(cache.head).toBeUndefined();
      expect(cache.tail).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('removes all entries', () => {
      let cache = createLRUCache(factory, 3);
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

    it('allows set after clear', () => {
      let cache = createLRUCache(factory, 3);
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
      const cache = createLRUCache(factory, 3);
      expect(toArray(cache)).toEqual([]);
    });

    it('returns entries in order from most to least recently used', () => {
      let cache = createLRUCache(factory, 5);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(toArray(cache)).toEqual([
        ['c', 3],
        ['b', 2],
        ['a', 1],
      ]);
    });

    it('returns entries correctly after updates', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);
      cache = set(cache, 'a', 100); // Move 'a' to front

      expect(toArray(cache)).toEqual([
        ['a', 100],
        ['c', 3],
        ['b', 2],
      ]);
    });

    it('does not modify cache state', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      toArray(cache);

      expect(cache.size).toBe(2);
      expect(get(cache, 'a')).toBe(1);
    });

    it('handles corrupted cache gracefully', () => {
      const storage = factory.create();
      storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
      // 'b' is referenced but not in storage

      const corruptedCache = {
        head: 'a' as string,
        tail: 'b' as string,
        size: 2,
        capacity: 3,
        storage,
      };

      // Should return only 'a' and stop at the missing node
      expect(toArray(corruptedCache)).toEqual([['a', 1]]);
    });
  });

  describe('getKeys', () => {
    it('returns empty array for empty cache', () => {
      const cache = createLRUCache(factory, 3);
      expect(getKeys(cache)).toEqual([]);
    });

    it('returns keys in order from most to least recently used', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(getKeys(cache)).toEqual(['c', 'b', 'a']);
    });

    it('handles corrupted cache gracefully', () => {
      const storage = factory.create();
      storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
      // 'b' is referenced but not in storage

      const corruptedCache = {
        head: 'a' as string,
        tail: 'b' as string,
        size: 2,
        capacity: 3,
        storage,
      };

      // Should return only 'a' and stop at the missing node
      expect(getKeys(corruptedCache)).toEqual(['a']);
    });
  });

  describe('getValues', () => {
    it('returns empty array for empty cache', () => {
      const cache = createLRUCache(factory, 3);
      expect(getValues(cache)).toEqual([]);
    });

    it('returns values in order from most to least recently used', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);

      expect(getValues(cache)).toEqual([3, 2, 1]);
    });

    it('handles corrupted cache gracefully', () => {
      const storage = factory.create();
      storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
      // 'b' is referenced but not in storage

      const corruptedCache = {
        head: 'a' as string,
        tail: 'b' as string,
        size: 2,
        capacity: 3,
        storage,
      };

      // Should return only 'a' and stop at the missing node
      expect(getValues(corruptedCache)).toEqual([1]);
    });
  });

  describe('immutability', () => {
    it('set does not modify original cache', () => {
      const original = createLRUCache(factory, 3);
      const updated = set(original, 'a', 1);

      expect(original.size).toBe(0);
      expect(updated.size).toBe(1);
      expect(toArray(original)).toEqual([]);
      expect(toArray(updated)).toEqual([['a', 1]]);
    });

    it('deleteKey does not modify original cache', () => {
      let cache = createLRUCache(factory, 3);
      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      const originalSize = cache.size;
      const deleted = deleteKey(cache, 'a');

      expect(cache.size).toBe(originalSize);
      expect(deleted.size).toBe(originalSize - 1);
    });

    it('supports time-travel debugging pattern', () => {
      const history: ReturnType<typeof createLRUCache<string, number>>[] = [];

      let cache = createLRUCache(factory, 3);
      history.push(cache);

      cache = set(cache, 'a', 1);
      history.push(cache);

      cache = set(cache, 'b', 2);
      history.push(cache);

      cache = set(cache, 'c', 3);
      history.push(cache);

      // Can inspect any previous state
      expect(toArray(history[0]!)).toEqual([]);
      expect(toArray(history[1]!)).toEqual([['a', 1]]);
      expect(toArray(history[2]!)).toEqual([
        ['b', 2],
        ['a', 1],
      ]);
      expect(toArray(history[3]!)).toEqual([
        ['c', 3],
        ['b', 2],
        ['a', 1],
      ]);
    });
  });

  describe('complex scenarios', () => {
    it('handles interleaved set, get, and delete', () => {
      let cache = createLRUCache(factory, 3);

      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);

      expect(get(cache, 'a')).toBe(1);

      cache = set(cache, 'c', 3);
      cache = set(cache, 'd', 4); // Evicts 'a' (least recently used)

      expect(has(cache, 'a')).toBe(false);

      cache = deleteKey(cache, 'b');

      expect(getKeys(cache)).toEqual(['d', 'c']);
    });

    it('handles capacity of 1', () => {
      let cache = createLRUCache(factory, 1);

      cache = set(cache, 'a', 1);
      expect(cache.size).toBe(1);
      expect(get(cache, 'a')).toBe(1);

      cache = set(cache, 'b', 2);
      expect(cache.size).toBe(1);
      expect(get(cache, 'b')).toBe(2);
      expect(has(cache, 'a')).toBe(false);
    });

    it('works with numeric keys', () => {
      const numFactory = createMapStorageFactory<number, string>();
      let cache = createLRUCache(numFactory, 3);

      cache = set(cache, 1, 'one');
      cache = set(cache, 2, 'two');
      cache = set(cache, 3, 'three');

      expect(get(cache, 1)).toBe('one');
      expect(getKeys(cache)).toEqual([3, 2, 1]);
    });

    it('works with object values', () => {
      type Value = { readonly id: number; readonly name: string };
      const objFactory = createMapStorageFactory<string, Value>();
      let cache = createLRUCache(objFactory, 2);

      cache = set(cache, 'a', { id: 1, name: 'one' });
      cache = set(cache, 'b', { id: 2, name: 'two' });

      expect(get(cache, 'a')).toEqual({ id: 1, name: 'one' });
      expect(get(cache, 'b')).toEqual({ id: 2, name: 'two' });
    });

    it('maintains LRU order through mixed operations', () => {
      let cache = createLRUCache(factory, 4);

      cache = set(cache, 'a', 1);
      cache = set(cache, 'b', 2);
      cache = set(cache, 'c', 3);
      cache = set(cache, 'd', 4);

      // Access 'b' (doesn't change order since get doesn't update)
      get(cache, 'b');
      expect(getKeys(cache)).toEqual(['d', 'c', 'b', 'a']);

      // Update 'b' - should move to front
      cache = set(cache, 'b', 20);
      expect(getKeys(cache)).toEqual(['b', 'd', 'c', 'a']);

      // Add new entry - should evict 'a' (least recently used)
      cache = set(cache, 'e', 5);
      expect(getKeys(cache)).toEqual(['e', 'b', 'd', 'c']);
      expect(has(cache, 'a')).toBe(false);
    });
  });
});

describe('validateLRUCache', () => {
  const factory = createMapStorageFactory<string, number>();

  it('validates a correct cache', () => {
    let cache = createLRUCache(factory, 3);
    cache = set(cache, 'a', 1);
    cache = set(cache, 'b', 2);

    const result = validateLRUCache(cache);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates a single-entry cache', () => {
    let cache = createLRUCache(factory, 3);
    cache = set(cache, 'a', 1);

    const result = validateLRUCache(cache);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates an empty cache', () => {
    const cache = createLRUCache(factory, 3);
    const result = validateLRUCache(cache);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid capacity', () => {
    const invalidCache = {
      head: undefined,
      tail: undefined,
      size: 0,
      capacity: 0,
      storage: factory.create(),
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_capacity');
  });

  it('detects invalid size', () => {
    const invalidCache = {
      head: undefined,
      tail: undefined,
      size: 10, // Exceeds capacity
      capacity: 3,
      storage: factory.create(),
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_size');
  });

  it('detects invalid links for empty cache', () => {
    const invalidCache = {
      head: 'a' as string,
      tail: undefined,
      size: 0,
      capacity: 3,
      storage: factory.create(),
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });

  it('detects single entry with mismatched head/tail', () => {
    const storage = factory.create();
    storage.set('a', { key: 'a', value: 1, prev: undefined, next: undefined });

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 1,
      capacity: 3,
      storage,
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });

  it('detects size mismatch', () => {
    const storage = factory.create();
    storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
    storage.set('b', { key: 'b', value: 2, prev: 'a', next: undefined });

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 5, // Wrong size
      capacity: 3,
      storage,
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'size_mismatch')).toBe(true);
  });

  it('detects orphaned nodes', () => {
    const storage = factory.create();
    storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
    // 'b' is referenced but not in storage

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 2,
      capacity: 3,
      storage,
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'orphaned_nodes')).toBe(true);
  });

  it('detects broken bidirectional links', () => {
    const storage = factory.create();
    storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
    storage.set('b', { key: 'b', value: 2, prev: 'c', next: undefined }); // Should be prev: 'a'

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 2,
      capacity: 3,
      storage,
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });

  it('detects cycles in linked list', () => {
    const storage = factory.create();
    storage.set('a', { key: 'a', value: 1, prev: undefined, next: 'b' });
    storage.set('b', { key: 'b', value: 2, prev: 'a', next: 'a' }); // Cycle back to 'a'

    const invalidCache = {
      head: 'a' as string,
      tail: 'b' as string,
      size: 2,
      capacity: 3,
      storage,
    };

    const result = validateLRUCache(invalidCache);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'invalid_links')).toBe(true);
  });
});

describe('createMapStorageFactory', () => {
  it('creates storage that can store and retrieve entries', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    const node1 = { key: 'a', value: 1, prev: undefined, next: undefined };
    const node2 = { key: 'b', value: 2, prev: undefined, next: undefined };

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

    const node = { key: 'a', value: 1, prev: undefined, next: undefined };
    storage.set('a', node);

    expect(storage.has('a')).toBe(true);
    expect(storage.delete('a')).toBe(true);
    expect(storage.has('a')).toBe(false);
    expect(storage.delete('a')).toBe(false);
  });

  it('can clear all entries', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    storage.set('a', { key: 'a', value: 1, prev: undefined, next: undefined });
    storage.set('b', { key: 'b', value: 2, prev: undefined, next: undefined });

    storage.clear();

    expect(storage.has('a')).toBe(false);
    expect(storage.has('b')).toBe(false);
  });

  it('clone creates independent copy', () => {
    const factory = createMapStorageFactory<string, number>();
    const storage = factory.create();

    storage.set('a', { key: 'a', value: 1, prev: undefined, next: undefined });
    storage.set('b', { key: 'b', value: 2, prev: undefined, next: undefined });

    const cloned = storage.clone();
    cloned.set('a', { key: 'a', value: 100, prev: undefined, next: undefined });

    expect(storage.get('a')?.value).toBe(1); // Original unchanged
    expect(cloned.get('a')?.value).toBe(100); // Clone modified
    expect(cloned.get('b')?.value).toBe(2); // Other values copied
  });
});

describe('custom storage factory', () => {
  it('allows injection of custom storage implementation', () => {
    const operations: string[] = [];

    const createTrackedStorage = (
      data: Map<string, any>,
      label: string
    ): ReturnType<LRUCacheStorageFactory<string, number>['create']> => ({
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
    });

    const customFactory: LRUCacheStorageFactory<string, number> = {
      create() {
        operations.push('create()');
        return createTrackedStorage(new Map(), 'storage');
      },
    };

    let cache = createLRUCache(customFactory, 2);
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

  it('handles storage corruption when node disappears after clone', () => {
    // Create a corrupting storage where clone() doesn't copy everything
    const createCorruptingStorage = (
      data: Map<string, any>
    ): ReturnType<LRUCacheStorageFactory<string, number>['create']> => ({
      get(key: string) {
        return data.get(key);
      },
      set(key: string, value: any) {
        data.set(key, value);
      },
      delete(key: string) {
        return data.delete(key);
      },
      has(key: string) {
        return data.has(key);
      },
      clear() {
        data.clear();
      },
      clone() {
        // Clone creates empty storage - simulates corruption
        return createCorruptingStorage(new Map());
      },
    });

    const corruptFactory: LRUCacheStorageFactory<string, number> = {
      create() {
        return createCorruptingStorage(new Map());
      },
    };

    let cache = createLRUCache(corruptFactory, 3);
    cache = set(cache, 'a', 1);

    // Delete 'a' - has() will return true on original storage,
    // but after clone(), the node won't exist in newStorage
    // This triggers the defensive check at line 349
    const cache2 = deleteKey(cache, 'a');

    // The operation should complete without throwing
    expect(cache2).toBeDefined();
  });

  it('handles storage corruption when prev node is missing', () => {
    // Create a corrupting storage that returns undefined for the prev node
    const createCorruptingStorage = (
      data: Map<string, any>
    ): ReturnType<LRUCacheStorageFactory<string, number>['create']> => ({
      get(key: string) {
        const node = data.get(key);
        // Return undefined when trying to get the 'a' node (prev of 'b')
        if (key === 'a') {
          return undefined;
        }
        return node;
      },
      set(key: string, value: any) {
        data.set(key, value);
      },
      delete(key: string) {
        return data.delete(key);
      },
      has(key: string) {
        return data.has(key);
      },
      clear() {
        data.clear();
      },
      clone() {
        const clonedData = new Map(data);
        return createCorruptingStorage(clonedData);
      },
    });

    const corruptFactory: LRUCacheStorageFactory<string, number> = {
      create() {
        return createCorruptingStorage(new Map());
      },
    };

    let cache = createLRUCache(corruptFactory, 3);
    // Add three items
    cache = set(cache, 'a', 1);
    cache = set(cache, 'b', 2);
    cache = set(cache, 'c', 3);

    // Delete 'b' - it will try to update node 'a' (prev) but storage.get('a') returns undefined
    // This triggers the defensive check at line 355
    const cache2 = deleteKey(cache, 'b');

    expect(cache2).toBeDefined();
  });

  it('handles storage corruption when next node is missing', () => {
    // Create a corrupting storage that returns undefined for the next node
    const createCorruptingStorage = (
      data: Map<string, any>
    ): ReturnType<LRUCacheStorageFactory<string, number>['create']> => ({
      get(key: string) {
        const node = data.get(key);
        // Return undefined when trying to get the 'c' node (next of 'b')
        if (key === 'c') {
          return undefined;
        }
        return node;
      },
      set(key: string, value: any) {
        data.set(key, value);
      },
      delete(key: string) {
        return data.delete(key);
      },
      has(key: string) {
        return data.has(key);
      },
      clear() {
        data.clear();
      },
      clone() {
        const clonedData = new Map(data);
        return createCorruptingStorage(clonedData);
      },
    });

    const corruptFactory: LRUCacheStorageFactory<string, number> = {
      create() {
        return createCorruptingStorage(new Map());
      },
    };

    let cache = createLRUCache(corruptFactory, 3);
    // Add three items
    cache = set(cache, 'a', 1);
    cache = set(cache, 'b', 2);
    cache = set(cache, 'c', 3);

    // Delete 'b' - it will try to update node 'c' (next) but storage.get('c') returns undefined
    // This triggers the defensive check at line 363
    const cache2 = deleteKey(cache, 'b');

    expect(cache2).toBeDefined();
  });
});
