/**
 * @conveaux/contract-ring-buffer
 *
 * Ring buffer contract for fixed-size circular buffers.
 * Platform agnostic with injectable storage.
 */

/**
 * Storage interface for ring buffer backing store.
 *
 * This abstraction allows the host platform to inject different
 * storage implementations:
 * - Standard JavaScript arrays
 * - TypedArrays for numeric data
 * - Custom memory-efficient implementations
 *
 * @typeParam T - The type of elements stored
 */
export interface RingBufferStorage<T> {
  /**
   * Get the element at the specified index.
   *
   * @param index - The index to read from (0 to capacity-1)
   * @returns The element at that index, or undefined if not set
   */
  get(index: number): T | undefined;

  /**
   * Set the element at the specified index.
   *
   * @param index - The index to write to (0 to capacity-1)
   * @param value - The value to store
   */
  set(index: number, value: T): void;
}

/**
 * Factory for creating ring buffer storage.
 *
 * Injected by the host platform to provide storage implementation.
 *
 * @typeParam T - The type of elements to store
 */
export interface RingBufferStorageFactory<T> {
  /**
   * Create a new storage instance with the given capacity.
   *
   * @param capacity - The number of elements the storage should hold
   * @returns A new storage instance
   */
  create(capacity: number): RingBufferStorage<T>;
}

/**
 * A fixed-size circular buffer that overwrites oldest elements when full.
 *
 * Ring buffers are useful for:
 * - Bounded queues (recent N items)
 * - Streaming data windows
 * - Memory-efficient logging
 *
 * @typeParam T - The type of elements stored
 */
export interface RingBuffer<T> {
  /**
   * Push an element to the buffer.
   * If the buffer is full, overwrites the oldest element.
   *
   * @param item - The element to add
   */
  push(item: T): void;

  /**
   * Remove and return the oldest element.
   *
   * @returns The oldest element, or undefined if empty
   */
  pop(): T | undefined;

  /**
   * Return the oldest element without removing it.
   *
   * @returns The oldest element, or undefined if empty
   */
  peek(): T | undefined;

  /**
   * Return the newest element without removing it.
   *
   * @returns The newest element, or undefined if empty
   */
  peekLast(): T | undefined;

  /**
   * Current number of elements in the buffer.
   */
  readonly size: number;

  /**
   * Maximum capacity of the buffer.
   */
  readonly capacity: number;

  /**
   * Check if the buffer is empty.
   *
   * @returns True if the buffer contains no elements
   */
  isEmpty(): boolean;

  /**
   * Check if the buffer is full.
   *
   * @returns True if the buffer is at capacity
   */
  isFull(): boolean;

  /**
   * Remove all elements from the buffer.
   */
  clear(): void;

  /**
   * Convert the buffer contents to an array.
   * Elements are ordered from oldest to newest.
   *
   * @returns Array of elements from oldest to newest
   */
  toArray(): T[];
}
