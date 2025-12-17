/**
 * @conveaux/contract-priority-queue
 *
 * Pure types for priority queues (binary heap).
 * No runtime code - all operations are pure functions in @conveaux/port-priority-queue.
 *
 * Design principle (following DAG pattern): A priority queue is data, not a capability.
 * - Contract: pure types (PriorityQueue, PriorityQueueStorage, Comparator)
 * - Port: pure functions (push, pop, peek, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of queue state
 * - Time-travel debugging
 * - Structural sharing for efficient immutable updates
 * - Testing without mocks
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * Comparator function for determining priority order.
 *
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns Negative if a has higher priority, positive if b has higher priority, 0 if equal
 *
 * @example
 * ```typescript
 * // Min-heap (lower numbers = higher priority)
 * const minComparator: Comparator<number> = (a, b) => a - b;
 *
 * // Max-heap (higher numbers = higher priority)
 * const maxComparator: Comparator<number> = (a, b) => b - a;
 * ```
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * A priority queue is pure data - heap array, size, and comparator.
 *
 * All operations on the priority queue are pure functions in the port.
 * The queue is immutable; operations return new queue instances.
 *
 * Implementation uses a binary heap stored in an array, where:
 * - Parent of node i is at floor((i-1)/2)
 * - Left child of node i is at 2*i + 1
 * - Right child of node i is at 2*i + 2
 *
 * @template T - The type of elements stored
 *
 * @example
 * ```typescript
 * import { createPriorityQueue, push, pop, peek } from '@conveaux/port-priority-queue';
 *
 * const empty = createPriorityQueue<number>(factory, (a, b) => a - b, { initialCapacity: 10 });
 * const pq1 = push(empty, 3, 3);
 * const pq2 = push(pq1, 1, 1);
 * const pq3 = push(pq2, 2, 2);
 * const { item, queue: pq4 } = pop(pq3);
 * console.log(item); // 1 (lowest priority value)
 * ```
 */
export interface PriorityQueue<T> {
  /** Current number of elements in the queue */
  readonly size: number;

  /** Reference to the backing storage */
  readonly storage: PriorityQueueStorage<T>;

  /** Comparator function for priority ordering */
  readonly comparator: Comparator<number>;
}

/**
 * Storage interface for priority queue backing store.
 *
 * This abstraction allows the host platform to inject different
 * storage implementations:
 * - Standard JavaScript arrays
 * - TypedArrays for numeric data
 * - Custom memory-efficient implementations
 *
 * Note: While storage has methods (get/set), this is a capability interface
 * that represents platform-provided functionality. The PriorityQueue itself
 * remains pure data.
 *
 * @template T - The type of elements stored
 */
export interface PriorityQueueStorage<T> {
  /**
   * Get the element at the specified index.
   *
   * @param index - The index to read from (0 to size-1)
   * @returns The heap node at that index, or undefined if not set
   */
  get(index: number): PriorityQueueNode<T> | undefined;

  /**
   * Set the element at the specified index.
   *
   * @param index - The index to write to
   * @param value - The heap node to store
   */
  set(index: number, value: PriorityQueueNode<T>): void;

  /**
   * Clone the storage for immutable operations.
   * Returns a new storage instance with the same contents.
   *
   * @returns A new storage instance with copied data
   */
  clone(): PriorityQueueStorage<T>;

  /**
   * Get the current capacity of the storage.
   *
   * @returns The number of elements the storage can hold
   */
  capacity(): number;

  /**
   * Resize the storage to a new capacity.
   * Existing elements are preserved.
   *
   * @param newCapacity - The new capacity
   * @returns A new storage instance with the new capacity
   */
  resize(newCapacity: number): PriorityQueueStorage<T>;
}

/**
 * A heap node containing an item and its priority.
 *
 * @template T - The type of item stored
 */
export interface PriorityQueueNode<T> {
  /** The item stored in this node */
  readonly item: T;

  /** The priority value (used for ordering) */
  readonly priority: number;
}

/**
 * Factory for creating priority queue storage.
 *
 * Injected by the host platform to provide storage implementation.
 *
 * @template T - The type of elements to store
 */
export interface PriorityQueueStorageFactory<T> {
  /**
   * Create a new storage instance with the given initial capacity.
   *
   * @param initialCapacity - The initial number of elements the storage should hold
   * @returns A new storage instance
   */
  create(initialCapacity: number): PriorityQueueStorage<T>;
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
  /** The element that was removed, or undefined if queue was empty */
  readonly item: T | undefined;

  /** The new queue state after the pop */
  readonly queue: PriorityQueue<T>;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating a priority queue.
 */
export interface PriorityQueueOptions {
  /** Initial capacity for the heap array (default: 16) */
  readonly initialCapacity?: number;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type PriorityQueueValidationErrorType =
  | 'invalid_size'
  | 'heap_property_violation'
  | 'missing_comparator';

/**
 * A validation error found in a priority queue.
 */
export interface PriorityQueueValidationError {
  readonly type: PriorityQueueValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a priority queue.
 */
export interface PriorityQueueValidationResult {
  readonly valid: boolean;
  readonly errors: readonly PriorityQueueValidationError[];
}
