import type { PriorityQueueStorageFactory } from '@conveaux/contract-priority-queue';
import { describe, expect, it } from 'vitest';
import {
  clear,
  createArrayStorageFactory,
  createPriorityQueue,
  isEmpty,
  peek,
  pop,
  push,
  toArray,
  validatePriorityQueue,
} from './index';

describe('createPriorityQueue', () => {
  const factory = createArrayStorageFactory<string>();

  describe('creation', () => {
    it('creates an empty queue with default min-heap comparator', () => {
      const queue = createPriorityQueue(factory);

      expect(queue.size).toBe(0);
      expect(isEmpty(queue)).toBe(true);
      expect(queue.comparator).toBeDefined();
    });

    it('creates a queue with custom comparator', () => {
      const maxHeap = (a: number, b: number) => b - a;
      const queue = createPriorityQueue(factory, maxHeap);

      expect(queue.comparator).toBe(maxHeap);
    });

    it('creates a queue with custom initial capacity', () => {
      const queue = createPriorityQueue(factory, (a, b) => a - b, {
        initialCapacity: 32,
      });

      expect(queue.size).toBe(0);
      expect(queue.storage.capacity()).toBe(32);
    });

    it('throws for non-positive initial capacity', () => {
      expect(() =>
        createPriorityQueue(factory, (a, b) => a - b, { initialCapacity: 0 })
      ).toThrow('Initial capacity must be a positive integer, got: 0');
      expect(() =>
        createPriorityQueue(factory, (a, b) => a - b, { initialCapacity: -1 })
      ).toThrow('Initial capacity must be a positive integer, got: -1');
    });

    it('throws for non-integer initial capacity', () => {
      expect(() =>
        createPriorityQueue(factory, (a, b) => a - b, { initialCapacity: 2.5 })
      ).toThrow('Initial capacity must be a positive integer, got: 2.5');
    });
  });

  describe('push', () => {
    it('adds elements to the queue immutably', () => {
      const q0 = createPriorityQueue(factory);
      const q1 = push(q0, 'a', 1);

      expect(q0.size).toBe(0); // Original unchanged
      expect(q1.size).toBe(1);
      expect(isEmpty(q1)).toBe(false);

      const q2 = push(q1, 'b', 2);
      const q3 = push(q2, 'c', 3);

      expect(q3.size).toBe(3);
    });

    it('maintains min-heap property with default comparator', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'low', 1);
      queue = push(queue, 'high', 10);
      queue = push(queue, 'mid', 5);

      expect(peek(queue)).toBe('low');
      expect(toArray(queue)).toEqual(['low', 'mid', 'high']);
    });

    it('maintains max-heap property with custom comparator', () => {
      let queue = createPriorityQueue(factory, (a, b) => b - a);
      queue = push(queue, 'low', 1);
      queue = push(queue, 'high', 10);
      queue = push(queue, 'mid', 5);

      expect(peek(queue)).toBe('high');
      expect(toArray(queue)).toEqual(['high', 'mid', 'low']);
    });

    it('handles duplicate priorities', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'first', 5);
      queue = push(queue, 'second', 5);
      queue = push(queue, 'third', 5);

      expect(queue.size).toBe(3);
      const items = toArray(queue);
      expect(items).toHaveLength(3);
      expect(items).toContain('first');
      expect(items).toContain('second');
      expect(items).toContain('third');
    });

    it('automatically resizes storage when capacity is exceeded', () => {
      let queue = createPriorityQueue(factory, (a, b) => a - b, {
        initialCapacity: 2,
      });

      expect(queue.storage.capacity()).toBe(2);

      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);
      expect(queue.storage.capacity()).toBe(2);

      queue = push(queue, 'c', 3);
      expect(queue.storage.capacity()).toBe(4); // Doubled

      queue = push(queue, 'd', 4);
      queue = push(queue, 'e', 5);
      expect(queue.storage.capacity()).toBe(8); // Doubled again
    });

    it('maintains heap property during resize', () => {
      let queue = createPriorityQueue(factory, (a, b) => a - b, {
        initialCapacity: 2,
      });

      queue = push(queue, 'low', 1);
      queue = push(queue, 'high', 10);
      queue = push(queue, 'mid', 5);
      queue = push(queue, 'lower', 2);

      const items = toArray(queue);
      expect(items).toEqual(['low', 'lower', 'mid', 'high']);
    });
  });

  describe('pop', () => {
    it('returns undefined for empty queue', () => {
      const queue = createPriorityQueue(factory);
      const result = pop(queue);

      expect(result.item).toBeUndefined();
      expect(result.queue).toBe(queue); // Same reference when empty
    });

    it('removes and returns highest priority element', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 3);
      queue = push(queue, 'b', 1);
      queue = push(queue, 'c', 2);

      const result1 = pop(queue);
      expect(result1.item).toBe('b'); // Priority 1
      expect(result1.queue.size).toBe(2);

      const result2 = pop(result1.queue);
      expect(result2.item).toBe('c'); // Priority 2
      expect(result2.queue.size).toBe(1);

      const result3 = pop(result2.queue);
      expect(result3.item).toBe('a'); // Priority 3
      expect(result3.queue.size).toBe(0);
      expect(isEmpty(result3.queue)).toBe(true);
    });

    it('maintains heap property after pop', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);
      queue = push(queue, 'c', 3);
      queue = push(queue, 'd', 4);
      queue = push(queue, 'e', 5);

      const { queue: afterPop } = pop(queue);
      const validation = validatePriorityQueue(afterPop);
      expect(validation.valid).toBe(true);
    });

    it('allows push after pop', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      const { queue: afterPop } = pop(queue);
      queue = push(afterPop, 'c', 0);
      queue = push(queue, 'd', 3);

      expect(toArray(queue)).toEqual(['c', 'b', 'd']);
    });

    it('handles single element queue', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'only', 1);

      const { item, queue: afterPop } = pop(queue);
      expect(item).toBe('only');
      expect(afterPop.size).toBe(0);
      expect(isEmpty(afterPop)).toBe(true);
    });

    it('handles corrupted storage gracefully', () => {
      // Create a queue with corrupted storage (missing root node)
      const storage = factory.create(16);
      const corruptedQueue = {
        size: 1,
        storage,
        comparator: (a: number, b: number) => a - b,
      };

      const result = pop(corruptedQueue);
      expect(result.item).toBeUndefined();
      expect(result.queue).toBe(corruptedQueue);
    });
  });

  describe('peek', () => {
    it('returns undefined for empty queue', () => {
      const queue = createPriorityQueue(factory);
      expect(peek(queue)).toBeUndefined();
    });

    it('returns highest priority element without removing it', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 5);
      queue = push(queue, 'b', 1);

      expect(peek(queue)).toBe('b');
      expect(queue.size).toBe(2); // Size unchanged
      expect(peek(queue)).toBe('b'); // Still same element
    });

    it('returns correct element with max-heap', () => {
      let queue = createPriorityQueue(factory, (a, b) => b - a);
      queue = push(queue, 'low', 1);
      queue = push(queue, 'high', 10);
      queue = push(queue, 'mid', 5);

      expect(peek(queue)).toBe('high');
    });
  });

  describe('clear', () => {
    it('removes all elements', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);
      queue = push(queue, 'c', 3);

      const cleared = clear(queue, factory);

      expect(cleared.size).toBe(0);
      expect(isEmpty(cleared)).toBe(true);
      expect(peek(cleared)).toBeUndefined();
      expect(toArray(cleared)).toEqual([]);

      // Original unchanged
      expect(queue.size).toBe(3);
    });

    it('preserves comparator after clear', () => {
      const maxHeap = (a: number, b: number) => b - a;
      let queue = createPriorityQueue(factory, maxHeap);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      let cleared = clear(queue, factory);
      cleared = push(cleared, 'c', 5);
      cleared = push(cleared, 'd', 3);

      expect(peek(cleared)).toBe('c'); // Max-heap behavior preserved
    });

    it('allows push after clear', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      let cleared = clear(queue, factory);
      cleared = push(cleared, 'c', 3);

      expect(cleared.size).toBe(1);
      expect(peek(cleared)).toBe('c');
    });
  });

  describe('toArray', () => {
    it('returns empty array for empty queue', () => {
      const queue = createPriorityQueue(factory);
      expect(toArray(queue)).toEqual([]);
    });

    it('returns elements in priority order', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'c', 3);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      expect(toArray(queue)).toEqual(['a', 'b', 'c']);
    });

    it('returns elements in reverse priority order for max-heap', () => {
      let queue = createPriorityQueue(factory, (a, b) => b - a);
      queue = push(queue, 'c', 3);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      expect(toArray(queue)).toEqual(['c', 'b', 'a']);
    });

    it('does not modify original queue state', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      const originalSize = queue.size;
      toArray(queue);

      expect(queue.size).toBe(originalSize);
      expect(peek(queue)).toBe('a');
    });
  });

  describe('immutability', () => {
    it('push does not modify original queue', () => {
      const original = createPriorityQueue(factory);
      const pushed = push(original, 'a', 1);

      expect(original.size).toBe(0);
      expect(pushed.size).toBe(1);
      expect(toArray(original)).toEqual([]);
      expect(toArray(pushed)).toEqual(['a']);
    });

    it('pop does not modify original queue', () => {
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);

      const originalSize = queue.size;
      const { queue: popped } = pop(queue);

      expect(queue.size).toBe(originalSize);
      expect(popped.size).toBe(originalSize - 1);
    });

    it('supports time-travel debugging pattern', () => {
      const history: ReturnType<typeof createPriorityQueue<string>>[] = [];

      let queue = createPriorityQueue(factory);
      history.push(queue);

      queue = push(queue, 'a', 1);
      history.push(queue);

      queue = push(queue, 'b', 2);
      history.push(queue);

      queue = push(queue, 'c', 3);
      history.push(queue);

      // Can inspect any previous state
      expect(toArray(history[0]!)).toEqual([]);
      expect(toArray(history[1]!)).toEqual(['a']);
      expect(toArray(history[2]!)).toEqual(['a', 'b']);
      expect(toArray(history[3]!)).toEqual(['a', 'b', 'c']);
    });
  });

  describe('edge cases with corrupted storage', () => {
    it('handles missing node during bubbleUp', () => {
      // Create a corrupted queue where storage returns undefined
      const corruptedStorage = factory.create(16);
      const originalGet = corruptedStorage.get.bind(corruptedStorage);

      // Mock storage to return undefined for index 1
      corruptedStorage.get = (index: number) => {
        if (index === 1) return undefined;
        return originalGet(index);
      };

      const corruptedQueue = {
        size: 1,
        storage: corruptedStorage,
        comparator: (a: number, b: number) => a - b,
      };

      // This should trigger bubbleUp with missing node
      const result = push(corruptedQueue, 'test', 5);
      // Should return queue even if bubbleUp encounters missing nodes
      expect(result.size).toBe(2);
    });

    it('handles missing parent during bubbleUp', () => {
      // Create a queue and corrupt it so parent lookup fails
      const corruptedStorage = factory.create(16);
      corruptedStorage.set(1, { item: 'child', priority: 1 });

      const originalGet = corruptedStorage.get.bind(corruptedStorage);
      corruptedStorage.get = (index: number) => {
        if (index === 0) return undefined; // Missing parent
        return originalGet(index);
      };

      const corruptedQueue = {
        size: 2,
        storage: corruptedStorage,
        comparator: (a: number, b: number) => a - b,
      };

      // Try to push which will call bubbleUp
      const result = push(corruptedQueue, 'new', 2);
      expect(result.size).toBe(3);
    });

    it('handles missing node during bubbleDown', () => {
      // Create a queue and corrupt it during pop/bubbleDown
      let queue = createPriorityQueue(factory);
      queue = push(queue, 'a', 1);
      queue = push(queue, 'b', 2);
      queue = push(queue, 'c', 3);

      // Corrupt the storage before popping
      const originalGet = queue.storage.get.bind(queue.storage);
      queue.storage.get = (index: number) => {
        if (index === 0) return undefined; // Missing root during bubbleDown
        return originalGet(index);
      };

      const result = pop(queue);
      // Should handle gracefully
      expect(result.item).toBeUndefined();
    });

    it('handles missing left child during bubbleDown', () => {
      // Create a storage that will have missing left child during bubbleDown
      const corruptedStorage = factory.create(16);

      // Set up a heap with 3 nodes
      corruptedStorage.set(0, { item: 'root', priority: 1 });
      corruptedStorage.set(1, { item: 'left', priority: 2 });
      corruptedStorage.set(2, { item: 'right', priority: 3 });

      // Create queue
      let queue = {
        size: 3,
        storage: corruptedStorage,
        comparator: (a: number, b: number) => a - b,
      };

      // Intercept clone to corrupt the left child
      const originalClone = corruptedStorage.clone.bind(corruptedStorage);
      corruptedStorage.clone = () => {
        const cloned = originalClone();
        const originalClonedGet = cloned.get.bind(cloned);
        // Make cloned storage return undefined for left child during bubbleDown
        cloned.get = (index: number) => {
          if (index === 1) return undefined; // Missing left child
          return originalClonedGet(index);
        };
        return cloned;
      };

      // This pop will clone (with corrupted get), then trigger bubbleDown with missing left child
      const result = pop(queue);
      expect(result).toBeDefined();
    });

    it('handles missing last node during pop', () => {
      // Create a queue where the last node is missing
      const corruptedStorage = factory.create(16);
      corruptedStorage.set(0, { item: 'root', priority: 1 });
      corruptedStorage.set(1, { item: 'left', priority: 2 });

      const corruptedQueue = {
        size: 3,
        storage: corruptedStorage,
        comparator: (a: number, b: number) => a - b,
      };

      // Get for index 2 (last node) will return undefined
      const result = pop(corruptedQueue);
      expect(result.item).toBe('root');
    });

    it('handles corrupted storage in toArray by breaking loop', () => {
      // Create a queue with corruption that would cause undefined item in toArray
      const corruptedStorage = factory.create(16);

      const corruptedQueue = {
        size: 1,
        storage: corruptedStorage,
        comparator: (a: number, b: number) => a - b,
      };

      // toArray will call pop, get undefined, and break the loop
      const items = toArray(corruptedQueue);
      expect(items).toEqual([]);
    });

  });

  describe('complex scenarios', () => {
    it('handles interleaved push and pop', () => {
      let queue = createPriorityQueue(factory);

      queue = push(queue, 'a', 5);
      queue = push(queue, 'b', 3);

      const { item: item1, queue: q1 } = pop(queue);
      expect(item1).toBe('b'); // Priority 3

      queue = push(q1, 'c', 1);
      queue = push(queue, 'd', 4);

      const { item: item2, queue: q2 } = pop(queue);
      expect(item2).toBe('c'); // Priority 1

      queue = push(q2, 'e', 2);

      expect(toArray(queue)).toEqual(['e', 'd', 'a']);
    });

    it('handles many elements efficiently', () => {
      let queue = createPriorityQueue(factory);

      // Add 100 elements in random order
      const elements: Array<{ item: string; priority: number }> = [];
      for (let i = 0; i < 100; i++) {
        const priority = Math.floor(Math.random() * 1000);
        elements.push({ item: `item${i}`, priority });
        queue = push(queue, `item${i}`, priority);
      }

      expect(queue.size).toBe(100);

      // Verify heap property
      const validation = validatePriorityQueue(queue);
      expect(validation.valid).toBe(true);

      // Verify elements come out in priority order
      const sorted = toArray(queue);
      expect(sorted).toHaveLength(100);

      for (let i = 1; i < sorted.length; i++) {
        const prevItem = elements.find((e) => e.item === sorted[i - 1]);
        const currItem = elements.find((e) => e.item === sorted[i]);
        expect(prevItem!.priority).toBeLessThanOrEqual(currItem!.priority);
      }
    });

    it('works with object types', () => {
      type Task = { readonly id: number; readonly name: string };
      const taskFactory = createArrayStorageFactory<Task>();
      let queue = createPriorityQueue(taskFactory);

      queue = push(queue, { id: 1, name: 'low-priority' }, 10);
      queue = push(queue, { id: 2, name: 'high-priority' }, 1);
      queue = push(queue, { id: 3, name: 'mid-priority' }, 5);

      expect(peek(queue)).toEqual({ id: 2, name: 'high-priority' });
      const items = toArray(queue);
      expect(items).toEqual([
        { id: 2, name: 'high-priority' },
        { id: 3, name: 'mid-priority' },
        { id: 1, name: 'low-priority' },
      ]);
    });

    it('handles priority ties in a stable manner', () => {
      let queue = createPriorityQueue(factory);

      queue = push(queue, 'first', 5);
      queue = push(queue, 'second', 5);
      queue = push(queue, 'third', 5);

      const items = toArray(queue);
      expect(items).toHaveLength(3);
      // All items should be present (order may vary for equal priorities)
      expect(new Set(items)).toEqual(new Set(['first', 'second', 'third']));
    });
  });
});

describe('validatePriorityQueue', () => {
  const factory = createArrayStorageFactory<string>();

  it('validates a correct queue', () => {
    let queue = createPriorityQueue(factory);
    queue = push(queue, 'a', 1);
    queue = push(queue, 'b', 2);
    queue = push(queue, 'c', 3);

    const result = validatePriorityQueue(queue);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates an empty queue', () => {
    const queue = createPriorityQueue(factory);
    const result = validatePriorityQueue(queue);
    expect(result.valid).toBe(true);
  });

  it('detects invalid size', () => {
    const invalidQueue = {
      size: -1,
      storage: factory.create(16),
      comparator: (a: number, b: number) => a - b,
    };

    const result = validatePriorityQueue(invalidQueue);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_size');
  });

  it('detects missing comparator', () => {
    const invalidQueue = {
      size: 0,
      storage: factory.create(16),
      comparator: null as any,
    };

    const result = validatePriorityQueue(invalidQueue);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('missing_comparator');
  });

  it('detects heap property violation with left child', () => {
    // Manually construct an invalid heap
    const storage = factory.create(16);
    storage.set(0, { item: 'root', priority: 10 }); // Parent
    storage.set(1, { item: 'left', priority: 5 }); // Left child has higher priority!

    const invalidQueue = {
      size: 2,
      storage,
      comparator: (a: number, b: number) => a - b,
    };

    const result = validatePriorityQueue(invalidQueue);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'heap_property_violation')).toBe(true);
    expect(result.errors.some((e) => e.details.includes('left child'))).toBe(true);
  });

  it('detects heap property violation with right child', () => {
    // Manually construct an invalid heap with right child violation
    const storage = factory.create(16);
    storage.set(0, { item: 'root', priority: 10 }); // Parent
    storage.set(1, { item: 'left', priority: 11 }); // Left child ok
    storage.set(2, { item: 'right', priority: 5 }); // Right child has higher priority!

    const invalidQueue = {
      size: 3,
      storage,
      comparator: (a: number, b: number) => a - b,
    };

    const result = validatePriorityQueue(invalidQueue);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.type === 'heap_property_violation')).toBe(true);
    expect(result.errors.some((e) => e.details.includes('right child'))).toBe(true);
  });

  it('detects missing node in heap', () => {
    // Create a storage that returns undefined for a node
    const storage = factory.create(16);
    const originalGet = storage.get.bind(storage);
    storage.get = (index: number) => {
      if (index === 1) return undefined; // Simulate missing node
      return originalGet(index);
    };

    storage.set(0, { item: 'root', priority: 1 });
    storage.set(2, { item: 'right', priority: 3 });

    const invalidQueue = {
      size: 3,
      storage,
      comparator: (a: number, b: number) => a - b,
    };

    const result = validatePriorityQueue(invalidQueue);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.details.includes('Missing node'))).toBe(true);
  });

  it('validates queue after multiple operations', () => {
    let queue = createPriorityQueue(factory);

    // Perform many operations
    for (let i = 0; i < 50; i++) {
      queue = push(queue, `item${i}`, Math.floor(Math.random() * 100));
    }

    for (let i = 0; i < 25; i++) {
      const { queue: newQueue } = pop(queue);
      queue = newQueue;
    }

    for (let i = 50; i < 75; i++) {
      queue = push(queue, `item${i}`, Math.floor(Math.random() * 100));
    }

    const result = validatePriorityQueue(queue);
    expect(result.valid).toBe(true);
  });
});

describe('createArrayStorageFactory', () => {
  it('creates storage with correct capacity', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(5);

    storage.set(0, { item: 10, priority: 1 });
    storage.set(4, { item: 40, priority: 4 });

    expect(storage.get(0)).toEqual({ item: 10, priority: 1 });
    expect(storage.get(4)).toEqual({ item: 40, priority: 4 });
    expect(storage.capacity()).toBe(5);
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

    storage.set(0, { item: 'first', priority: 1 });
    storage.set(0, { item: 'second', priority: 2 });

    expect(storage.get(0)).toEqual({ item: 'second', priority: 2 });
  });

  it('clone creates independent copy', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(3);

    storage.set(0, { item: 1, priority: 1 });
    storage.set(1, { item: 2, priority: 2 });

    const cloned = storage.clone();
    cloned.set(0, { item: 100, priority: 100 });

    expect(storage.get(0)).toEqual({ item: 1, priority: 1 }); // Original unchanged
    expect(cloned.get(0)).toEqual({ item: 100, priority: 100 }); // Clone modified
    expect(cloned.get(1)).toEqual({ item: 2, priority: 2 }); // Other values copied
  });

  it('resize preserves existing data', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(3);

    storage.set(0, { item: 1, priority: 1 });
    storage.set(1, { item: 2, priority: 2 });

    const resized = storage.resize(6);

    expect(resized.capacity()).toBe(6);
    expect(resized.get(0)).toEqual({ item: 1, priority: 1 });
    expect(resized.get(1)).toEqual({ item: 2, priority: 2 });
    expect(resized.get(2)).toBeUndefined();
  });

  it('resize can shrink storage', () => {
    const factory = createArrayStorageFactory<number>();
    const storage = factory.create(5);

    storage.set(0, { item: 1, priority: 1 });
    storage.set(1, { item: 2, priority: 2 });
    storage.set(2, { item: 3, priority: 3 });

    const resized = storage.resize(2);

    expect(resized.capacity()).toBe(2);
    expect(resized.get(0)).toEqual({ item: 1, priority: 1 });
    expect(resized.get(1)).toEqual({ item: 2, priority: 2 });
  });
});

describe('custom storage factory', () => {
  it('allows injection of custom storage implementation', () => {
    const operations: string[] = [];

    const createTrackedStorage = (
      data: Map<number, any>,
      label: string,
      cap: number
    ): ReturnType<PriorityQueueStorageFactory<string>['create']> => ({
      get(index: number) {
        operations.push(`${label}:get(${index})`);
        return data.get(index);
      },
      set(index: number, value: any) {
        operations.push(`${label}:set(${index})`);
        data.set(index, value);
      },
      clone() {
        operations.push(`${label}:clone()`);
        const clonedData = new Map(data);
        const cloneLabel = `${label}-clone`;
        return createTrackedStorage(clonedData, cloneLabel, cap);
      },
      capacity() {
        return cap;
      },
      resize(newCapacity: number) {
        operations.push(`${label}:resize(${newCapacity})`);
        const resizedData = new Map(data);
        return createTrackedStorage(resizedData, `${label}-resized`, newCapacity);
      },
    });

    const customFactory: PriorityQueueStorageFactory<string> = {
      create(initialCapacity: number) {
        operations.push(`create(${initialCapacity})`);
        return createTrackedStorage(new Map(), 'storage', initialCapacity);
      },
    };

    let queue = createPriorityQueue(customFactory, (a, b) => a - b, {
      initialCapacity: 2,
    });
    queue = push(queue, 'a', 1);
    queue = push(queue, 'b', 2);
    peek(queue);

    // Factory creates initial storage
    expect(operations).toContain('create(2)');
    // Push clones storage for immutability
    expect(operations.some((op) => op.includes('clone()'))).toBe(true);
    // Set happens on the cloned storage
    expect(operations.some((op) => op.includes('set('))).toBe(true);
    // Peek reads from storage
    expect(operations.some((op) => op.includes('get('))).toBe(true);
  });
});
