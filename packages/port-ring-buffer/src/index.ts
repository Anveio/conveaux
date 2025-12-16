/**
 * @conveaux/port-ring-buffer
 *
 * Ring buffer implementation with injectable storage.
 * Platform agnostic - host provides storage factory.
 */

import type {
  RingBuffer,
  RingBufferStorage,
  RingBufferStorageFactory,
} from '@conveaux/contract-ring-buffer';

// Re-export contract types for convenience
export type {
  RingBuffer,
  RingBufferStorage,
  RingBufferStorageFactory,
} from '@conveaux/contract-ring-buffer';

/**
 * Dependencies for creating a ring buffer.
 *
 * @typeParam T - The type of elements to store
 */
export interface RingBufferDependencies<T> {
  /**
   * Factory for creating the backing storage.
   * Inject this to control how elements are stored.
   */
  readonly storageFactory: RingBufferStorageFactory<T>;
}

/**
 * Options for configuring a ring buffer.
 */
export interface RingBufferOptions {
  /**
   * Maximum number of elements the buffer can hold.
   * Must be a positive integer.
   */
  readonly capacity: number;
}

/**
 * Creates a fixed-size circular buffer.
 *
 * @param deps - Required dependencies (storage factory)
 * @param options - Configuration (capacity)
 * @returns A new RingBuffer instance
 *
 * @example
 * ```typescript
 * // Create with array storage
 * const buffer = createRingBuffer(
 *   { storageFactory: createArrayStorageFactory<number>() },
 *   { capacity: 5 }
 * );
 *
 * buffer.push(1);
 * buffer.push(2);
 * buffer.push(3);
 * console.log(buffer.toArray()); // [1, 2, 3]
 * console.log(buffer.pop());     // 1
 * console.log(buffer.peek());    // 2
 * ```
 */
export function createRingBuffer<T>(
  deps: RingBufferDependencies<T>,
  options: RingBufferOptions
): RingBuffer<T> {
  const { capacity } = options;

  if (capacity < 1 || !Number.isInteger(capacity)) {
    throw new Error(`Capacity must be a positive integer, got: ${capacity}`);
  }

  const storage = deps.storageFactory.create(capacity);

  // Internal state
  let head = 0; // Index of oldest element (read position)
  let tail = 0; // Index where next element will be written
  let size = 0; // Current number of elements

  return {
    get size() {
      return size;
    },

    get capacity() {
      return capacity;
    },

    isEmpty() {
      return size === 0;
    },

    isFull() {
      return size === capacity;
    },

    push(item: T): void {
      storage.set(tail, item);
      tail = (tail + 1) % capacity;

      if (size < capacity) {
        size++;
      } else {
        // Buffer was full, oldest element is overwritten
        head = (head + 1) % capacity;
      }
    },

    pop(): T | undefined {
      if (size === 0) {
        return undefined;
      }

      const item = storage.get(head);
      head = (head + 1) % capacity;
      size--;
      return item;
    },

    peek(): T | undefined {
      if (size === 0) {
        return undefined;
      }
      return storage.get(head);
    },

    peekLast(): T | undefined {
      if (size === 0) {
        return undefined;
      }
      // tail points to next write position, so last element is at tail - 1
      const lastIndex = (tail - 1 + capacity) % capacity;
      return storage.get(lastIndex);
    },

    clear(): void {
      head = 0;
      tail = 0;
      size = 0;
    },

    toArray(): T[] {
      const result: T[] = [];
      for (let i = 0; i < size; i++) {
        const index = (head + i) % capacity;
        // Safe to cast: we only iterate over indices that were written via push()
        result.push(storage.get(index) as T);
      }
      return result;
    },
  };
}

/**
 * Creates a storage factory that uses standard JavaScript arrays.
 *
 * This is a convenience helper for hosts that want simple array-backed storage.
 *
 * @typeParam T - The type of elements to store
 * @returns A storage factory that creates array-backed storage
 *
 * @example
 * ```typescript
 * const buffer = createRingBuffer(
 *   { storageFactory: createArrayStorageFactory<string>() },
 *   { capacity: 10 }
 * );
 * ```
 */
export function createArrayStorageFactory<T>(): RingBufferStorageFactory<T> {
  return {
    create(capacity: number): RingBufferStorage<T> {
      const array: (T | undefined)[] = new Array(capacity);
      return {
        get(index: number): T | undefined {
          return array[index];
        },
        set(index: number, value: T): void {
          array[index] = value;
        },
      };
    },
  };
}
