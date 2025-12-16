import { describe, expect, it } from 'vitest';
import {
  type RingBufferStorageFactory,
  createArrayStorageFactory,
  createRingBuffer,
} from './index';

describe('createRingBuffer', () => {
  function createTestBuffer<T>(capacity: number) {
    return createRingBuffer<T>({ storageFactory: createArrayStorageFactory<T>() }, { capacity });
  }

  describe('creation', () => {
    it('creates an empty buffer with specified capacity', () => {
      const buffer = createTestBuffer<number>(5);

      expect(buffer.size).toBe(0);
      expect(buffer.capacity).toBe(5);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.isFull()).toBe(false);
    });

    it('throws for non-positive capacity', () => {
      expect(() => createTestBuffer<number>(0)).toThrow(
        'Capacity must be a positive integer, got: 0'
      );
      expect(() => createTestBuffer<number>(-1)).toThrow(
        'Capacity must be a positive integer, got: -1'
      );
    });

    it('throws for non-integer capacity', () => {
      expect(() => createTestBuffer<number>(2.5)).toThrow(
        'Capacity must be a positive integer, got: 2.5'
      );
    });
  });

  describe('push', () => {
    it('adds elements to the buffer', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      expect(buffer.size).toBe(1);
      expect(buffer.isEmpty()).toBe(false);

      buffer.push(2);
      buffer.push(3);
      expect(buffer.size).toBe(3);
      expect(buffer.isFull()).toBe(true);
    });

    it('overwrites oldest element when full', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      expect(buffer.toArray()).toEqual([1, 2, 3]);

      buffer.push(4);
      expect(buffer.size).toBe(3);
      expect(buffer.toArray()).toEqual([2, 3, 4]);

      buffer.push(5);
      buffer.push(6);
      expect(buffer.toArray()).toEqual([4, 5, 6]);
    });
  });

  describe('pop', () => {
    it('returns undefined for empty buffer', () => {
      const buffer = createTestBuffer<number>(3);
      expect(buffer.pop()).toBeUndefined();
    });

    it('removes and returns oldest element', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.pop()).toBe(1);
      expect(buffer.size).toBe(2);
      expect(buffer.pop()).toBe(2);
      expect(buffer.size).toBe(1);
      expect(buffer.pop()).toBe(3);
      expect(buffer.size).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
    });

    it('allows push after pop', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.pop();
      buffer.push(3);
      buffer.push(4);

      expect(buffer.toArray()).toEqual([2, 3, 4]);
    });
  });

  describe('peek', () => {
    it('returns undefined for empty buffer', () => {
      const buffer = createTestBuffer<number>(3);
      expect(buffer.peek()).toBeUndefined();
    });

    it('returns oldest element without removing it', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);

      expect(buffer.peek()).toBe(1);
      expect(buffer.size).toBe(2);
      expect(buffer.peek()).toBe(1);
    });
  });

  describe('peekLast', () => {
    it('returns undefined for empty buffer', () => {
      const buffer = createTestBuffer<number>(3);
      expect(buffer.peekLast()).toBeUndefined();
    });

    it('returns newest element without removing it', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      expect(buffer.peekLast()).toBe(1);

      buffer.push(2);
      expect(buffer.peekLast()).toBe(2);

      buffer.push(3);
      expect(buffer.peekLast()).toBe(3);
      expect(buffer.size).toBe(3);
    });

    it('returns newest element after wraparound', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4); // overwrites 1

      expect(buffer.peekLast()).toBe(4);
    });
  });

  describe('clear', () => {
    it('removes all elements', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.clear();

      expect(buffer.size).toBe(0);
      expect(buffer.isEmpty()).toBe(true);
      expect(buffer.peek()).toBeUndefined();
      expect(buffer.toArray()).toEqual([]);
    });

    it('allows push after clear', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.clear();
      buffer.push(3);

      expect(buffer.size).toBe(1);
      expect(buffer.peek()).toBe(3);
    });
  });

  describe('toArray', () => {
    it('returns empty array for empty buffer', () => {
      const buffer = createTestBuffer<number>(3);
      expect(buffer.toArray()).toEqual([]);
    });

    it('returns elements in order from oldest to newest', () => {
      const buffer = createTestBuffer<number>(5);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);

      expect(buffer.toArray()).toEqual([1, 2, 3]);
    });

    it('returns elements correctly after wraparound', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.push(3);
      buffer.push(4);
      buffer.push(5);

      expect(buffer.toArray()).toEqual([3, 4, 5]);
    });

    it('does not modify buffer state', () => {
      const buffer = createTestBuffer<number>(3);

      buffer.push(1);
      buffer.push(2);
      buffer.toArray();

      expect(buffer.size).toBe(2);
      expect(buffer.peek()).toBe(1);
    });
  });

  describe('complex scenarios', () => {
    it('handles interleaved push and pop', () => {
      const buffer = createTestBuffer<string>(3);

      buffer.push('a');
      buffer.push('b');
      expect(buffer.pop()).toBe('a');
      buffer.push('c');
      buffer.push('d');
      expect(buffer.pop()).toBe('b');
      buffer.push('e');

      expect(buffer.toArray()).toEqual(['c', 'd', 'e']);
    });

    it('handles capacity of 1', () => {
      const buffer = createTestBuffer<number>(1);

      buffer.push(1);
      expect(buffer.isFull()).toBe(true);
      expect(buffer.peek()).toBe(1);
      expect(buffer.peekLast()).toBe(1);

      buffer.push(2);
      expect(buffer.size).toBe(1);
      expect(buffer.peek()).toBe(2);

      expect(buffer.pop()).toBe(2);
      expect(buffer.isEmpty()).toBe(true);
    });

    it('works with object types', () => {
      type Item = { readonly id: number; readonly name: string };
      const buffer = createTestBuffer<Item>(2);

      buffer.push({ id: 1, name: 'one' });
      buffer.push({ id: 2, name: 'two' });

      expect(buffer.peek()).toEqual({ id: 1, name: 'one' });
      expect(buffer.peekLast()).toEqual({ id: 2, name: 'two' });
    });
  });
});

describe('createArrayStorageFactory', () => {
  it('creates storage with correct capacity', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(5);

    // Storage should be able to store at indices 0-4
    storage.set(0, 10);
    storage.set(4, 40);

    expect(storage.get(0)).toBe(10);
    expect(storage.get(4)).toBe(40);
  });

  it('returns undefined for unset indices', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(3);

    expect(storage.get(0)).toBeUndefined();
    expect(storage.get(1)).toBeUndefined();
    expect(storage.get(2)).toBeUndefined();
  });

  it('overwrites existing values', () => {
    const factory = createArrayStorageFactory<string>();
    const storage = factory.create(3);

    storage.set(0, 'first');
    storage.set(0, 'second');

    expect(storage.get(0)).toBe('second');
  });
});

describe('custom storage factory', () => {
  it('allows injection of custom storage implementation', () => {
    // Create a custom storage that tracks all operations
    const operations: string[] = [];

    const customFactory: RingBufferStorageFactory<number> = {
      create(capacity: number) {
        const data = new Map<number, number>();
        operations.push(`create(${capacity})`);
        return {
          get(index: number) {
            operations.push(`get(${index})`);
            return data.get(index);
          },
          set(index: number, value: number) {
            operations.push(`set(${index}, ${value})`);
            data.set(index, value);
          },
        };
      },
    };

    const buffer = createRingBuffer({ storageFactory: customFactory }, { capacity: 2 });

    buffer.push(1);
    buffer.push(2);
    buffer.peek();

    expect(operations).toContain('create(2)');
    expect(operations).toContain('set(0, 1)');
    expect(operations).toContain('set(1, 2)');
    expect(operations).toContain('get(0)');
  });
});
