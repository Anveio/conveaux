/**
 * @conveaux/contract-ring-buffer
 *
 * Pure types for fixed-size circular buffers.
 * No runtime code - all operations are pure functions in @conveaux/port-ring-buffer.
 *
 * Design principle (following DAG pattern): A ring buffer is data, not a capability.
 * - Contract: pure types (RingBuffer, RingBufferStorage)
 * - Port: pure functions (push, pop, peek, toArray, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of buffer state
 * - Time-travel debugging
 * - Structural sharing for efficient immutable updates
 * - Testing without mocks
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * A ring buffer is pure data - indices and a reference to storage.
 *
 * All operations on the ring buffer are pure functions in the port.
 * The buffer is immutable; operations return new buffer instances.
 *
 * @template T - The type of elements stored
 *
 * @example
 * ```typescript
 * import { createRingBuffer, push, pop, toArray } from '@conveaux/port-ring-buffer';
 *
 * const empty = createRingBuffer<number>(5);
 * const buf1 = push(empty, 1);
 * const buf2 = push(buf1, 2);
 * const [item, buf3] = pop(buf2);
 * console.log(item); // 1
 * console.log(toArray(buf3)); // [2]
 * ```
 */
export interface RingBuffer<T> {
  /** Index of oldest element (read position) */
  readonly head: number;

  /** Index where next element will be written */
  readonly tail: number;

  /** Current number of elements in the buffer */
  readonly size: number;

  /** Maximum capacity of the buffer */
  readonly capacity: number;

  /** Reference to the backing storage */
  readonly storage: RingBufferStorage<T>;
}

/**
 * Storage interface for ring buffer backing store.
 *
 * This abstraction allows the host platform to inject different
 * storage implementations:
 * - Standard JavaScript arrays
 * - TypedArrays for numeric data
 * - Custom memory-efficient implementations
 *
 * Note: While storage has methods (get/set), this is a capability interface
 * that represents platform-provided functionality, similar to how DAG execution
 * accepts an observer callback. The RingBuffer itself remains pure data.
 *
 * @template T - The type of elements stored
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

  /**
   * Clone the storage for immutable operations.
   * Returns a new storage instance with the same contents.
   *
   * @returns A new storage instance with copied data
   */
  clone(): RingBufferStorage<T>;
}

/**
 * Factory for creating ring buffer storage.
 *
 * Injected by the host platform to provide storage implementation.
 *
 * @template T - The type of elements to store
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

// =============================================================================
// Operation Result Types
// =============================================================================

/**
 * Result of a pop operation.
 *
 * @template T - The type of element that was popped
 */
export interface PopResult<T> {
  /** The element that was removed, or undefined if buffer was empty */
  readonly item: T | undefined;

  /** The new buffer state after the pop */
  readonly buffer: RingBuffer<T>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type RingBufferValidationErrorType =
  | 'invalid_capacity'
  | 'invalid_indices'
  | 'size_mismatch';

/**
 * A validation error found in a ring buffer.
 */
export interface RingBufferValidationError {
  readonly type: RingBufferValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a ring buffer.
 */
export interface RingBufferValidationResult {
  readonly valid: boolean;
  readonly errors: readonly RingBufferValidationError[];
}
