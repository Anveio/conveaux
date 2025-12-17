/**
 * @conveaux/port-ring-buffer
 *
 * Pure functions for operating on ring buffers.
 * Platform agnostic - host provides storage factory.
 *
 * All functions are pure: they take a buffer and return a new buffer.
 * The original buffer is never mutated.
 */

import type {
  PopResult,
  RingBuffer,
  RingBufferStorage,
  RingBufferStorageFactory,
  RingBufferValidationError,
  RingBufferValidationResult,
} from '@conveaux/contract-ring-buffer';

// Re-export contract types for convenience
export type {
  PopResult,
  RingBuffer,
  RingBufferStorage,
  RingBufferStorageFactory,
  RingBufferValidationError,
  RingBufferValidationResult,
} from '@conveaux/contract-ring-buffer';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty ring buffer with the specified capacity.
 *
 * @param storageFactory - Factory for creating the backing storage
 * @param capacity - Maximum number of elements the buffer can hold
 * @returns A new empty RingBuffer
 * @throws Error if capacity is not a positive integer
 *
 * @example
 * ```typescript
 * const buffer = createRingBuffer(createArrayStorageFactory<number>(), 5);
 * ```
 */
export function createRingBuffer<T>(
  storageFactory: RingBufferStorageFactory<T>,
  capacity: number
): RingBuffer<T> {
  if (capacity < 1 || !Number.isInteger(capacity)) {
    throw new Error(`Capacity must be a positive integer, got: ${capacity}`);
  }

  return {
    head: 0,
    tail: 0,
    size: 0,
    capacity,
    storage: storageFactory.create(capacity),
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Push an element to the buffer.
 * If the buffer is full, overwrites the oldest element.
 *
 * @param buffer - The ring buffer
 * @param item - The element to add
 * @returns A new buffer with the element added
 *
 * @example
 * ```typescript
 * const buf1 = createRingBuffer(factory, 3);
 * const buf2 = push(buf1, 'a');
 * const buf3 = push(buf2, 'b');
 * console.log(toArray(buf3)); // ['a', 'b']
 * ```
 */
export function push<T>(buffer: RingBuffer<T>, item: T): RingBuffer<T> {
  const newStorage = buffer.storage.clone();
  newStorage.set(buffer.tail, item);

  const newTail = (buffer.tail + 1) % buffer.capacity;

  if (buffer.size < buffer.capacity) {
    return {
      head: buffer.head,
      tail: newTail,
      size: buffer.size + 1,
      capacity: buffer.capacity,
      storage: newStorage,
    };
  }
  // Buffer was full, oldest element is overwritten
  return {
    head: (buffer.head + 1) % buffer.capacity,
    tail: newTail,
    size: buffer.size,
    capacity: buffer.capacity,
    storage: newStorage,
  };
}

/**
 * Remove and return the oldest element.
 *
 * @param buffer - The ring buffer
 * @returns A PopResult containing the item (or undefined if empty) and the new buffer
 *
 * @example
 * ```typescript
 * const { item, buffer: newBuffer } = pop(buffer);
 * if (item !== undefined) {
 *   console.log('Popped:', item);
 * }
 * ```
 */
export function pop<T>(buffer: RingBuffer<T>): PopResult<T> {
  if (buffer.size === 0) {
    return { item: undefined, buffer };
  }

  const item = buffer.storage.get(buffer.head);
  const newHead = (buffer.head + 1) % buffer.capacity;

  return {
    item,
    buffer: {
      head: newHead,
      tail: buffer.tail,
      size: buffer.size - 1,
      capacity: buffer.capacity,
      storage: buffer.storage, // No clone needed, we're not modifying
    },
  };
}

/**
 * Return the oldest element without removing it.
 *
 * @param buffer - The ring buffer
 * @returns The oldest element, or undefined if empty
 *
 * @example
 * ```typescript
 * const oldest = peek(buffer);
 * if (oldest !== undefined) {
 *   console.log('Oldest element:', oldest);
 * }
 * ```
 */
export function peek<T>(buffer: RingBuffer<T>): T | undefined {
  if (buffer.size === 0) {
    return undefined;
  }
  return buffer.storage.get(buffer.head);
}

/**
 * Return the newest element without removing it.
 *
 * @param buffer - The ring buffer
 * @returns The newest element, or undefined if empty
 *
 * @example
 * ```typescript
 * const newest = peekLast(buffer);
 * if (newest !== undefined) {
 *   console.log('Newest element:', newest);
 * }
 * ```
 */
export function peekLast<T>(buffer: RingBuffer<T>): T | undefined {
  if (buffer.size === 0) {
    return undefined;
  }
  // tail points to next write position, so last element is at tail - 1
  const lastIndex = (buffer.tail - 1 + buffer.capacity) % buffer.capacity;
  return buffer.storage.get(lastIndex);
}

/**
 * Check if the buffer is empty.
 *
 * @param buffer - The ring buffer
 * @returns True if the buffer contains no elements
 */
export function isEmpty<T>(buffer: RingBuffer<T>): boolean {
  return buffer.size === 0;
}

/**
 * Check if the buffer is full.
 *
 * @param buffer - The ring buffer
 * @returns True if the buffer is at capacity
 */
export function isFull<T>(buffer: RingBuffer<T>): boolean {
  return buffer.size === buffer.capacity;
}

/**
 * Create a new empty buffer with the same capacity.
 *
 * @param buffer - The ring buffer to clear
 * @param storageFactory - Factory for creating new backing storage
 * @returns A new empty buffer with the same capacity
 *
 * @example
 * ```typescript
 * const cleared = clear(buffer, factory);
 * console.log(isEmpty(cleared)); // true
 * ```
 */
export function clear<T>(
  buffer: RingBuffer<T>,
  storageFactory: RingBufferStorageFactory<T>
): RingBuffer<T> {
  return createRingBuffer(storageFactory, buffer.capacity);
}

/**
 * Convert the buffer contents to an array.
 * Elements are ordered from oldest to newest.
 *
 * @param buffer - The ring buffer
 * @returns Array of elements from oldest to newest
 *
 * @example
 * ```typescript
 * const items = toArray(buffer);
 * console.log(items); // [oldest, ..., newest]
 * ```
 */
export function toArray<T>(buffer: RingBuffer<T>): T[] {
  const result: T[] = [];
  for (let i = 0; i < buffer.size; i++) {
    const index = (buffer.head + i) % buffer.capacity;
    // Safe to cast: we only iterate over indices that were written via push()
    result.push(buffer.storage.get(index) as T);
  }
  return result;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a ring buffer's internal consistency.
 *
 * @param buffer - The ring buffer to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateRingBuffer(buffer);
 * if (!result.valid) {
 *   console.error('Invalid buffer:', result.errors);
 * }
 * ```
 */
export function validateRingBuffer<T>(buffer: RingBuffer<T>): RingBufferValidationResult {
  const errors: RingBufferValidationError[] = [];

  // Check capacity
  if (buffer.capacity < 1 || !Number.isInteger(buffer.capacity)) {
    errors.push({
      type: 'invalid_capacity',
      details: `Capacity must be a positive integer, got: ${buffer.capacity}`,
    });
  }

  // Check indices are within bounds
  if (buffer.head < 0 || buffer.head >= buffer.capacity) {
    errors.push({
      type: 'invalid_indices',
      details: `Head index ${buffer.head} is out of bounds [0, ${buffer.capacity - 1}]`,
    });
  }

  if (buffer.tail < 0 || buffer.tail >= buffer.capacity) {
    errors.push({
      type: 'invalid_indices',
      details: `Tail index ${buffer.tail} is out of bounds [0, ${buffer.capacity - 1}]`,
    });
  }

  // Check size is consistent
  if (buffer.size < 0 || buffer.size > buffer.capacity) {
    errors.push({
      type: 'size_mismatch',
      details: `Size ${buffer.size} is invalid for capacity ${buffer.capacity}`,
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Storage Factory Helpers
// =============================================================================

/**
 * Creates an array-backed storage instance.
 *
 * @internal Used by createArrayStorageFactory
 */
function createArrayStorage<T>(array: (T | undefined)[]): RingBufferStorage<T> {
  return {
    get(index: number): T | undefined {
      return array[index];
    },
    set(index: number, value: T): void {
      array[index] = value;
    },
    clone(): RingBufferStorage<T> {
      return createArrayStorage([...array]);
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
 * const buffer = createRingBuffer(createArrayStorageFactory<string>(), 10);
 * ```
 */
export function createArrayStorageFactory<T>(): RingBufferStorageFactory<T> {
  return {
    create(capacity: number): RingBufferStorage<T> {
      return createArrayStorage(new Array(capacity));
    },
  };
}
