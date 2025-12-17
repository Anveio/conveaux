/**
 * @conveaux/port-priority-queue
 *
 * Pure functions for operating on priority queues.
 * Platform agnostic - host provides storage factory.
 *
 * All functions are pure: they take a queue and return a new queue.
 * The original queue is never mutated.
 *
 * Implementation uses a binary min-heap (or max-heap with custom comparator).
 */

import type {
  Comparator,
  PopResult,
  PriorityQueue,
  PriorityQueueNode,
  PriorityQueueOptions,
  PriorityQueueStorage,
  PriorityQueueStorageFactory,
  PriorityQueueValidationError,
  PriorityQueueValidationResult,
} from '@conveaux/contract-priority-queue';

// Re-export contract types for convenience
export type {
  Comparator,
  PopResult,
  PriorityQueue,
  PriorityQueueNode,
  PriorityQueueOptions,
  PriorityQueueStorage,
  PriorityQueueStorageFactory,
  PriorityQueueValidationError,
  PriorityQueueValidationResult,
} from '@conveaux/contract-priority-queue';

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_INITIAL_CAPACITY = 16;
const GROWTH_FACTOR = 2;

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty priority queue with the specified comparator.
 *
 * @param storageFactory - Factory for creating the backing storage
 * @param comparator - Comparator function for priority ordering (default: min-heap)
 * @param options - Configuration options
 * @returns A new empty PriorityQueue
 *
 * @example
 * ```typescript
 * // Min-heap (lower numbers = higher priority)
 * const minQueue = createPriorityQueue(
 *   createArrayStorageFactory<number>(),
 *   (a, b) => a - b
 * );
 *
 * // Max-heap (higher numbers = higher priority)
 * const maxQueue = createPriorityQueue(
 *   createArrayStorageFactory<number>(),
 *   (a, b) => b - a
 * );
 * ```
 */
export function createPriorityQueue<T>(
  storageFactory: PriorityQueueStorageFactory<T>,
  comparator: Comparator<number> = (a, b) => a - b,
  options: PriorityQueueOptions = {}
): PriorityQueue<T> {
  const initialCapacity = options.initialCapacity ?? DEFAULT_INITIAL_CAPACITY;

  if (initialCapacity < 1 || !Number.isInteger(initialCapacity)) {
    throw new Error(`Initial capacity must be a positive integer, got: ${initialCapacity}`);
  }

  return {
    size: 0,
    storage: storageFactory.create(initialCapacity),
    comparator,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Push an element to the queue with the specified priority.
 * Lower priority values are dequeued first in a min-heap.
 *
 * @param queue - The priority queue
 * @param item - The element to add
 * @param priority - The priority value
 * @returns A new queue with the element added
 *
 * @example
 * ```typescript
 * const q1 = createPriorityQueue(factory);
 * const q2 = push(q1, 'task1', 3);
 * const q3 = push(q2, 'task2', 1);
 * const q4 = push(q3, 'task3', 2);
 * // Pop order: task2 (1), task3 (2), task1 (3)
 * ```
 */
export function push<T>(queue: PriorityQueue<T>, item: T, priority: number): PriorityQueue<T> {
  let storage = queue.storage;

  // Resize if needed
  if (queue.size >= storage.capacity()) {
    storage = storage.resize(storage.capacity() * GROWTH_FACTOR);
  }

  // Clone storage for immutability
  const newStorage = storage.clone();

  // Add new node at the end
  const node: PriorityQueueNode<T> = { item, priority };
  newStorage.set(queue.size, node);

  // Create new queue state
  const newQueue: PriorityQueue<T> = {
    size: queue.size + 1,
    storage: newStorage,
    comparator: queue.comparator,
  };

  // Bubble up to maintain heap property
  return bubbleUp(newQueue, queue.size);
}

/**
 * Remove and return the element with the highest priority.
 *
 * @param queue - The priority queue
 * @returns A PopResult containing the item (or undefined if empty) and the new queue
 *
 * @example
 * ```typescript
 * const { item, queue: newQueue } = pop(queue);
 * if (item !== undefined) {
 *   console.log('Highest priority item:', item);
 * }
 * ```
 */
export function pop<T>(queue: PriorityQueue<T>): PopResult<T> {
  if (queue.size === 0) {
    return { item: undefined, queue };
  }

  const rootNode = queue.storage.get(0);
  if (!rootNode) {
    return { item: undefined, queue };
  }

  if (queue.size === 1) {
    // Last element - just return empty queue
    return {
      item: rootNode.item,
      queue: {
        size: 0,
        storage: queue.storage,
        comparator: queue.comparator,
      },
    };
  }

  // Clone storage for immutability
  const newStorage = queue.storage.clone();

  // Move last element to root
  const lastNode = queue.storage.get(queue.size - 1);
  if (lastNode) {
    newStorage.set(0, lastNode);
  }

  // Create new queue state with reduced size
  const newQueue: PriorityQueue<T> = {
    size: queue.size - 1,
    storage: newStorage,
    comparator: queue.comparator,
  };

  // Bubble down to maintain heap property
  const heapifiedQueue = bubbleDown(newQueue, 0);

  return {
    item: rootNode.item,
    queue: heapifiedQueue,
  };
}

/**
 * Return the element with the highest priority without removing it.
 *
 * @param queue - The priority queue
 * @returns The highest priority element, or undefined if empty
 *
 * @example
 * ```typescript
 * const highest = peek(queue);
 * if (highest !== undefined) {
 *   console.log('Highest priority element:', highest);
 * }
 * ```
 */
export function peek<T>(queue: PriorityQueue<T>): T | undefined {
  if (queue.size === 0) {
    return undefined;
  }
  const node = queue.storage.get(0);
  return node?.item;
}

/**
 * Check if the queue is empty.
 *
 * @param queue - The priority queue
 * @returns True if the queue contains no elements
 *
 * @example
 * ```typescript
 * if (isEmpty(queue)) {
 *   console.log('Queue is empty');
 * }
 * ```
 */
export function isEmpty<T>(queue: PriorityQueue<T>): boolean {
  return queue.size === 0;
}

/**
 * Create a new empty queue with the same comparator.
 *
 * @param queue - The priority queue to clear
 * @param storageFactory - Factory for creating new backing storage
 * @returns A new empty queue with the same comparator
 *
 * @example
 * ```typescript
 * const cleared = clear(queue, factory);
 * console.log(isEmpty(cleared)); // true
 * ```
 */
export function clear<T>(
  queue: PriorityQueue<T>,
  storageFactory: PriorityQueueStorageFactory<T>
): PriorityQueue<T> {
  return createPriorityQueue(storageFactory, queue.comparator, {
    initialCapacity: DEFAULT_INITIAL_CAPACITY,
  });
}

/**
 * Convert the queue contents to an array.
 * Elements are ordered by priority (highest priority first).
 *
 * @param queue - The priority queue
 * @returns Array of elements ordered by priority
 *
 * @example
 * ```typescript
 * const items = toArray(queue);
 * console.log(items); // [highest priority, ..., lowest priority]
 * ```
 */
export function toArray<T>(queue: PriorityQueue<T>): T[] {
  const result: T[] = [];
  let currentQueue = queue;

  while (currentQueue.size > 0) {
    const { item, queue: nextQueue } = pop(currentQueue);
    // Pop should always return an item when queue size > 0
    // Only undefined if storage is corrupted
    if (item === undefined) {
      // Storage corruption detected - break to prevent infinite loop
      break;
    }
    result.push(item);
    currentQueue = nextQueue;
  }

  return result;
}

// =============================================================================
// Heap Maintenance (Internal)
// =============================================================================

/**
 * Bubble up an element to maintain heap property.
 *
 * @internal
 */
function bubbleUp<T>(queue: PriorityQueue<T>, index: number): PriorityQueue<T> {
  if (index === 0) {
    return queue;
  }

  const parentIndex = Math.floor((index - 1) / 2);
  const node = queue.storage.get(index);
  const parent = queue.storage.get(parentIndex);

  if (!(node && parent)) {
    return queue;
  }

  // Check if heap property is violated
  if (queue.comparator(node.priority, parent.priority) < 0) {
    // Swap with parent
    const newStorage = queue.storage.clone();
    newStorage.set(index, parent);
    newStorage.set(parentIndex, node);

    const newQueue: PriorityQueue<T> = {
      size: queue.size,
      storage: newStorage,
      comparator: queue.comparator,
    };

    // Continue bubbling up
    return bubbleUp(newQueue, parentIndex);
  }

  return queue;
}

/**
 * Bubble down an element to maintain heap property.
 *
 * @internal
 */
function bubbleDown<T>(queue: PriorityQueue<T>, index: number): PriorityQueue<T> {
  const leftChildIndex = 2 * index + 1;
  const rightChildIndex = 2 * index + 2;

  if (leftChildIndex >= queue.size) {
    // No children, heap property satisfied
    return queue;
  }

  const node = queue.storage.get(index);
  const leftChild = queue.storage.get(leftChildIndex);
  const rightChild = rightChildIndex < queue.size ? queue.storage.get(rightChildIndex) : undefined;

  if (!(node && leftChild)) {
    return queue;
  }

  // Find the child with higher priority
  let swapIndex = leftChildIndex;
  let swapNode = leftChild;

  if (rightChild && queue.comparator(rightChild.priority, leftChild.priority) < 0) {
    swapIndex = rightChildIndex;
    swapNode = rightChild;
  }

  // Check if heap property is violated
  if (queue.comparator(swapNode.priority, node.priority) < 0) {
    // Swap with child
    const newStorage = queue.storage.clone();
    newStorage.set(index, swapNode);
    newStorage.set(swapIndex, node);

    const newQueue: PriorityQueue<T> = {
      size: queue.size,
      storage: newStorage,
      comparator: queue.comparator,
    };

    // Continue bubbling down
    return bubbleDown(newQueue, swapIndex);
  }

  return queue;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a priority queue's internal consistency.
 *
 * @param queue - The priority queue to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validatePriorityQueue(queue);
 * if (!result.valid) {
 *   console.error('Invalid queue:', result.errors);
 * }
 * ```
 */
export function validatePriorityQueue<T>(queue: PriorityQueue<T>): PriorityQueueValidationResult {
  const errors: PriorityQueueValidationError[] = [];

  // Check size
  if (queue.size < 0 || !Number.isInteger(queue.size)) {
    errors.push({
      type: 'invalid_size',
      details: `Size must be a non-negative integer, got: ${queue.size}`,
    });
  }

  // Check comparator exists
  if (typeof queue.comparator !== 'function') {
    errors.push({
      type: 'missing_comparator',
      details: 'Comparator must be a function',
    });
  }

  // Check heap property for all parent-child pairs
  for (let i = 0; i < queue.size; i++) {
    const leftChildIndex = 2 * i + 1;
    const rightChildIndex = 2 * i + 2;

    const parent = queue.storage.get(i);
    if (!parent) {
      errors.push({
        type: 'heap_property_violation',
        details: `Missing node at index ${i}`,
      });
      continue;
    }

    if (leftChildIndex < queue.size) {
      const leftChild = queue.storage.get(leftChildIndex);
      if (leftChild && queue.comparator(leftChild.priority, parent.priority) < 0) {
        errors.push({
          type: 'heap_property_violation',
          details: `Heap property violated at index ${i}: left child has higher priority`,
        });
      }
    }

    if (rightChildIndex < queue.size) {
      const rightChild = queue.storage.get(rightChildIndex);
      if (rightChild && queue.comparator(rightChild.priority, parent.priority) < 0) {
        errors.push({
          type: 'heap_property_violation',
          details: `Heap property violated at index ${i}: right child has higher priority`,
        });
      }
    }
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
function createArrayStorage<T>(
  array: (PriorityQueueNode<T> | undefined)[]
): PriorityQueueStorage<T> {
  return {
    get(index: number): PriorityQueueNode<T> | undefined {
      return array[index];
    },
    set(index: number, value: PriorityQueueNode<T>): void {
      array[index] = value;
    },
    clone(): PriorityQueueStorage<T> {
      return createArrayStorage([...array]);
    },
    capacity(): number {
      return array.length;
    },
    resize(newCapacity: number): PriorityQueueStorage<T> {
      const newArray = new Array(newCapacity);
      for (let i = 0; i < Math.min(array.length, newCapacity); i++) {
        newArray[i] = array[i];
      }
      return createArrayStorage(newArray);
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
 * const queue = createPriorityQueue(createArrayStorageFactory<string>(), (a, b) => a - b);
 * ```
 */
export function createArrayStorageFactory<T>(): PriorityQueueStorageFactory<T> {
  return {
    create(initialCapacity: number): PriorityQueueStorage<T> {
      return createArrayStorage(new Array(initialCapacity));
    },
  };
}
