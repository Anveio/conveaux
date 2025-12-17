import type { RingBufferStorageFactory } from '@conveaux/contract-ring-buffer';
import { describe, expect, it } from 'vitest';
import {
  clear,
  createArrayStorageFactory,
  createRingBuffer,
  isEmpty,
  isFull,
  peek,
  peekLast,
  pop,
  push,
  toArray,
  validateRingBuffer,
} from './index';

describe('createRingBuffer', () => {
  const factory = createArrayStorageFactory<number>();

  describe('creation', () => {
    it('creates an empty buffer with specified capacity', () => {
      const buffer = createRingBuffer(factory, 5);

      expect(buffer.size).toBe(0);
      expect(buffer.capacity).toBe(5);
      expect(isEmpty(buffer)).toBe(true);
      expect(isFull(buffer)).toBe(false);
    });

    it('throws for non-positive capacity', () => {
      expect(() => createRingBuffer(factory, 0)).toThrow(
        'Capacity must be a positive integer, got: 0'
      );
      expect(() => createRingBuffer(factory, -1)).toThrow(
        'Capacity must be a positive integer, got: -1'
      );
    });

    it('throws for non-integer capacity', () => {
      expect(() => createRingBuffer(factory, 2.5)).toThrow(
        'Capacity must be a positive integer, got: 2.5'
      );
    });
  });

  describe('push', () => {
    it('adds elements to the buffer immutably', () => {
      const buf0 = createRingBuffer(factory, 3);
      const buf1 = push(buf0, 1);

      expect(buf0.size).toBe(0); // Original unchanged
      expect(buf1.size).toBe(1);
      expect(isEmpty(buf1)).toBe(false);

      const buf2 = push(buf1, 2);
      const buf3 = push(buf2, 3);

      expect(buf3.size).toBe(3);
      expect(isFull(buf3)).toBe(true);
    });

    it('overwrites oldest element when full', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);
      buffer = push(buffer, 3);
      expect(toArray(buffer)).toEqual([1, 2, 3]);

      buffer = push(buffer, 4);
      expect(buffer.size).toBe(3);
      expect(toArray(buffer)).toEqual([2, 3, 4]);

      buffer = push(buffer, 5);
      buffer = push(buffer, 6);
      expect(toArray(buffer)).toEqual([4, 5, 6]);
    });
  });

  describe('pop', () => {
    it('returns undefined for empty buffer', () => {
      const buffer = createRingBuffer(factory, 3);
      const result = pop(buffer);

      expect(result.item).toBeUndefined();
      expect(result.buffer).toBe(buffer); // Same reference when empty
    });

    it('removes and returns oldest element', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);
      buffer = push(buffer, 3);

      const result1 = pop(buffer);
      expect(result1.item).toBe(1);
      expect(result1.buffer.size).toBe(2);

      const result2 = pop(result1.buffer);
      expect(result2.item).toBe(2);
      expect(result2.buffer.size).toBe(1);

      const result3 = pop(result2.buffer);
      expect(result3.item).toBe(3);
      expect(result3.buffer.size).toBe(0);
      expect(isEmpty(result3.buffer)).toBe(true);
    });

    it('allows push after pop', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);

      const { buffer: afterPop } = pop(buffer);
      buffer = push(afterPop, 3);
      buffer = push(buffer, 4);

      expect(toArray(buffer)).toEqual([2, 3, 4]);
    });
  });

  describe('peek', () => {
    it('returns undefined for empty buffer', () => {
      const buffer = createRingBuffer(factory, 3);
      expect(peek(buffer)).toBeUndefined();
    });

    it('returns oldest element without removing it', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);

      expect(peek(buffer)).toBe(1);
      expect(buffer.size).toBe(2); // Size unchanged
      expect(peek(buffer)).toBe(1); // Still same element
    });
  });

  describe('peekLast', () => {
    it('returns undefined for empty buffer', () => {
      const buffer = createRingBuffer(factory, 3);
      expect(peekLast(buffer)).toBeUndefined();
    });

    it('returns newest element without removing it', () => {
      let buffer = createRingBuffer(factory, 3);

      buffer = push(buffer, 1);
      expect(peekLast(buffer)).toBe(1);

      buffer = push(buffer, 2);
      expect(peekLast(buffer)).toBe(2);

      buffer = push(buffer, 3);
      expect(peekLast(buffer)).toBe(3);
      expect(buffer.size).toBe(3);
    });

    it('returns newest element after wraparound', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);
      buffer = push(buffer, 3);
      buffer = push(buffer, 4); // overwrites 1

      expect(peekLast(buffer)).toBe(4);
    });
  });

  describe('clear', () => {
    it('removes all elements', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);
      buffer = push(buffer, 3);

      const cleared = clear(buffer, factory);

      expect(cleared.size).toBe(0);
      expect(isEmpty(cleared)).toBe(true);
      expect(peek(cleared)).toBeUndefined();
      expect(toArray(cleared)).toEqual([]);

      // Original unchanged
      expect(buffer.size).toBe(3);
    });

    it('allows push after clear', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);

      let cleared = clear(buffer, factory);
      cleared = push(cleared, 3);

      expect(cleared.size).toBe(1);
      expect(peek(cleared)).toBe(3);
    });
  });

  describe('toArray', () => {
    it('returns empty array for empty buffer', () => {
      const buffer = createRingBuffer(factory, 3);
      expect(toArray(buffer)).toEqual([]);
    });

    it('returns elements in order from oldest to newest', () => {
      let buffer = createRingBuffer(factory, 5);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);
      buffer = push(buffer, 3);

      expect(toArray(buffer)).toEqual([1, 2, 3]);
    });

    it('returns elements correctly after wraparound', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);
      buffer = push(buffer, 3);
      buffer = push(buffer, 4);
      buffer = push(buffer, 5);

      expect(toArray(buffer)).toEqual([3, 4, 5]);
    });

    it('does not modify buffer state', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);

      toArray(buffer);

      expect(buffer.size).toBe(2);
      expect(peek(buffer)).toBe(1);
    });
  });

  describe('immutability', () => {
    it('push does not modify original buffer', () => {
      const original = createRingBuffer(factory, 3);
      const pushed = push(original, 1);

      expect(original.size).toBe(0);
      expect(pushed.size).toBe(1);
      expect(toArray(original)).toEqual([]);
      expect(toArray(pushed)).toEqual([1]);
    });

    it('pop does not modify original buffer', () => {
      let buffer = createRingBuffer(factory, 3);
      buffer = push(buffer, 1);
      buffer = push(buffer, 2);

      const originalSize = buffer.size;
      const { buffer: popped } = pop(buffer);

      expect(buffer.size).toBe(originalSize);
      expect(popped.size).toBe(originalSize - 1);
    });

    it('supports time-travel debugging pattern', () => {
      const history: ReturnType<typeof createRingBuffer<number>>[] = [];

      let buffer = createRingBuffer(factory, 3);
      history.push(buffer);

      buffer = push(buffer, 1);
      history.push(buffer);

      buffer = push(buffer, 2);
      history.push(buffer);

      buffer = push(buffer, 3);
      history.push(buffer);

      // Can inspect any previous state
      expect(toArray(history[0]!)).toEqual([]);
      expect(toArray(history[1]!)).toEqual([1]);
      expect(toArray(history[2]!)).toEqual([1, 2]);
      expect(toArray(history[3]!)).toEqual([1, 2, 3]);
    });
  });

  describe('complex scenarios', () => {
    it('handles interleaved push and pop', () => {
      const stringFactory = createArrayStorageFactory<string>();
      let buffer = createRingBuffer(stringFactory, 3);

      buffer = push(buffer, 'a');
      buffer = push(buffer, 'b');

      const { item: item1, buffer: buf1 } = pop(buffer);
      expect(item1).toBe('a');

      buffer = push(buf1, 'c');
      buffer = push(buffer, 'd');

      const { item: item2, buffer: buf2 } = pop(buffer);
      expect(item2).toBe('b');

      buffer = push(buf2, 'e');

      expect(toArray(buffer)).toEqual(['c', 'd', 'e']);
    });

    it('handles capacity of 1', () => {
      let buffer = createRingBuffer(factory, 1);

      buffer = push(buffer, 1);
      expect(isFull(buffer)).toBe(true);
      expect(peek(buffer)).toBe(1);
      expect(peekLast(buffer)).toBe(1);

      buffer = push(buffer, 2);
      expect(buffer.size).toBe(1);
      expect(peek(buffer)).toBe(2);

      const { item } = pop(buffer);
      expect(item).toBe(2);
    });

    it('works with object types', () => {
      type Item = { readonly id: number; readonly name: string };
      const objFactory = createArrayStorageFactory<Item>();
      let buffer = createRingBuffer(objFactory, 2);

      buffer = push(buffer, { id: 1, name: 'one' });
      buffer = push(buffer, { id: 2, name: 'two' });

      expect(peek(buffer)).toEqual({ id: 1, name: 'one' });
      expect(peekLast(buffer)).toEqual({ id: 2, name: 'two' });
    });
  });
});

describe('validateRingBuffer', () => {
  const factory = createArrayStorageFactory<number>();

  it('validates a correct buffer', () => {
    let buffer = createRingBuffer(factory, 3);
    buffer = push(buffer, 1);
    buffer = push(buffer, 2);

    const result = validateRingBuffer(buffer);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid capacity', () => {
    const invalidBuffer = {
      head: 0,
      tail: 0,
      size: 0,
      capacity: 0,
      storage: factory.create(1),
    };

    const result = validateRingBuffer(invalidBuffer);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_capacity');
  });

  it('detects invalid indices', () => {
    const invalidBuffer = {
      head: 5, // Out of bounds
      tail: 0,
      size: 0,
      capacity: 3,
      storage: factory.create(3),
    };

    const result = validateRingBuffer(invalidBuffer);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_indices');
  });

  it('detects size mismatch', () => {
    const invalidBuffer = {
      head: 0,
      tail: 0,
      size: 10, // Exceeds capacity
      capacity: 3,
      storage: factory.create(3),
    };

    const result = validateRingBuffer(invalidBuffer);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('size_mismatch');
  });
});

describe('createArrayStorageFactory', () => {
  it('creates storage with correct capacity', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(5);

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

  it('clone creates independent copy', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(3);

    storage.set(0, 1);
    storage.set(1, 2);

    const cloned = storage.clone();
    cloned.set(0, 100);

    expect(storage.get(0)).toBe(1); // Original unchanged
    expect(cloned.get(0)).toBe(100); // Clone modified
    expect(cloned.get(1)).toBe(2); // Other values copied
  });
});

describe('custom storage factory', () => {
  it('allows injection of custom storage implementation', () => {
    // Track operations across all storage instances (original + clones)
    const operations: string[] = [];

    const createTrackedStorage = (
      data: Map<number, number>,
      label: string
    ): ReturnType<RingBufferStorageFactory<number>['create']> => ({
      get(index: number) {
        operations.push(`${label}:get(${index})`);
        return data.get(index);
      },
      set(index: number, value: number) {
        operations.push(`${label}:set(${index}, ${value})`);
        data.set(index, value);
      },
      clone() {
        operations.push(`${label}:clone()`);
        const clonedData = new Map(data);
        const cloneLabel = `${label}-clone`;
        return createTrackedStorage(clonedData, cloneLabel);
      },
    });

    const customFactory: RingBufferStorageFactory<number> = {
      create(capacity: number) {
        operations.push(`create(${capacity})`);
        return createTrackedStorage(new Map(), 'storage');
      },
    };

    let buffer = createRingBuffer(customFactory, 2);
    buffer = push(buffer, 1);
    buffer = push(buffer, 2);
    peek(buffer);

    // Factory creates initial storage
    expect(operations).toContain('create(2)');
    // Push clones storage for immutability
    expect(operations).toContain('storage:clone()');
    // Set happens on the cloned storage
    expect(operations).toContain('storage-clone:set(0, 1)');
    // Peek reads from storage
    expect(operations.some((op) => op.includes('get(0)'))).toBe(true);
  });
});
