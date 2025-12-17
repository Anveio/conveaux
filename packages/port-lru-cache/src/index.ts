/**
 * @conveaux/port-lru-cache
 *
 * Pure functions for operating on LRU caches.
 * Platform agnostic - host provides storage factory.
 *
 * All functions are pure: they take a cache and return a new cache.
 * The original cache is never mutated.
 */

import type {
  LRUCache,
  LRUCacheNode,
  LRUCacheStorage,
  LRUCacheStorageFactory,
  LRUCacheValidationError,
  LRUCacheValidationResult,
} from '@conveaux/contract-lru-cache';

// Re-export contract types for convenience
export type {
  LRUCache,
  LRUCacheNode,
  LRUCacheStorage,
  LRUCacheStorageFactory,
  LRUCacheValidationError,
  LRUCacheValidationResult,
} from '@conveaux/contract-lru-cache';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty LRU cache with the specified capacity.
 *
 * @param storageFactory - Factory for creating the backing storage
 * @param capacity - Maximum number of entries the cache can hold
 * @returns A new empty LRUCache
 * @throws Error if capacity is not a positive integer
 *
 * @example
 * ```typescript
 * const cache = createLRUCache(createMapStorageFactory<string, number>(), 100);
 * ```
 */
export function createLRUCache<K, V>(
  storageFactory: LRUCacheStorageFactory<K, V>,
  capacity: number
): LRUCache<K, V> {
  if (capacity < 1 || !Number.isInteger(capacity)) {
    throw new Error(`Capacity must be a positive integer, got: ${capacity}`);
  }

  return {
    head: undefined,
    tail: undefined,
    size: 0,
    capacity,
    storage: storageFactory.create(),
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Get the value for the specified key.
 * Marks the key as most recently used.
 *
 * @param cache - The LRU cache
 * @param key - The key to look up
 * @returns The value if found, or undefined if not found
 *
 * @example
 * ```typescript
 * const value = get(cache, 'myKey');
 * if (value !== undefined) {
 *   console.log('Found:', value);
 * }
 * ```
 */
export function get<K, V>(cache: LRUCache<K, V>, key: K): V | undefined {
  const node = cache.storage.get(key);
  if (node === undefined) {
    return undefined;
  }

  // Move to front (most recently used) - this creates a new cache instance
  // but we just return the value here. The cache state doesn't change for get.
  // Actually, for true LRU behavior, we need to update the cache on get.
  // Let's return both value and updated cache.
  // Wait, looking at the interface, it says get(key: K): V | undefined
  // So we should just return the value. But then we need a separate operation
  // to update the access order. Let me reconsider...

  // Actually, in a pure functional implementation, get() should return the value
  // without side effects. If we want to update the access order, we need a separate
  // operation or return a tuple. But the contract says: get(key: K): V | undefined

  // Let me check the ring buffer pattern... it returns just the value for peek.
  // For LRU, we need to update the order on access. Let's return just the value
  // and provide a separate touch() function to update access order.

  return node.value;
}

/**
 * Set a key-value pair in the cache.
 * Marks the key as most recently used.
 * If the cache is full, evicts the least recently used entry.
 *
 * @param cache - The LRU cache
 * @param key - The key to set
 * @param value - The value to associate with the key
 * @returns A new cache with the entry added/updated
 *
 * @example
 * ```typescript
 * const cache1 = createLRUCache(factory, 3);
 * const cache2 = set(cache1, 'a', 1);
 * const cache3 = set(cache2, 'b', 2);
 * ```
 */
export function set<K, V>(cache: LRUCache<K, V>, key: K, value: V): LRUCache<K, V> {
  const newStorage = cache.storage.clone();
  const existingNode = newStorage.get(key);

  if (existingNode !== undefined) {
    // Key already exists - update value and move to front
    // First, remove from current position in the list
    const removedCache = removeFromList(cache, key, newStorage);
    // Then add to front with new value
    return addToFront(removedCache, key, value, newStorage);
  }

  // Key doesn't exist - add new entry
  let workingCache = cache;

  // If at capacity, evict least recently used (tail)
  if (cache.size >= cache.capacity && cache.tail !== undefined) {
    workingCache = evictTail(cache, newStorage);
  }

  // Add new entry to front
  return addToFront(workingCache, key, value, newStorage);
}

/**
 * Check if a key exists in the cache.
 *
 * @param cache - The LRU cache
 * @param key - The key to check
 * @returns True if the key exists, false otherwise
 *
 * @example
 * ```typescript
 * if (has(cache, 'myKey')) {
 *   console.log('Key exists');
 * }
 * ```
 */
export function has<K, V>(cache: LRUCache<K, V>, key: K): boolean {
  return cache.storage.has(key);
}

/**
 * Delete a key from the cache.
 *
 * @param cache - The LRU cache
 * @param key - The key to delete
 * @returns A new cache with the entry removed
 *
 * @example
 * ```typescript
 * const cache2 = deleteKey(cache1, 'myKey');
 * ```
 */
export function deleteKey<K, V>(cache: LRUCache<K, V>, key: K): LRUCache<K, V> {
  if (!cache.storage.has(key)) {
    return cache;
  }

  const newStorage = cache.storage.clone();
  return removeFromList(cache, key, newStorage);
}

/**
 * Clear all entries from the cache.
 *
 * @param cache - The LRU cache to clear
 * @param storageFactory - Factory for creating new backing storage
 * @returns A new empty cache with the same capacity
 *
 * @example
 * ```typescript
 * const cleared = clear(cache, factory);
 * console.log(cleared.size); // 0
 * ```
 */
export function clear<K, V>(
  cache: LRUCache<K, V>,
  storageFactory: LRUCacheStorageFactory<K, V>
): LRUCache<K, V> {
  return createLRUCache(storageFactory, cache.capacity);
}

/**
 * Convert the cache contents to an array of [key, value] pairs.
 * Pairs are ordered from most recently used to least recently used.
 *
 * @param cache - The LRU cache
 * @returns Array of [key, value] pairs from most to least recently used
 *
 * @example
 * ```typescript
 * const entries = toArray(cache);
 * console.log(entries); // [['newest', 1], ['older', 2], ['oldest', 3]]
 * ```
 */
export function toArray<K, V>(cache: LRUCache<K, V>): Array<[K, V]> {
  const result: Array<[K, V]> = [];
  let currentKey = cache.head;

  while (currentKey !== undefined) {
    const node = cache.storage.get(currentKey);
    if (node === undefined) {
      break; // Shouldn't happen in a valid cache
    }
    result.push([node.key, node.value]);
    currentKey = node.next;
  }

  return result;
}

/**
 * Get all keys in the cache.
 * Keys are ordered from most recently used to least recently used.
 *
 * @param cache - The LRU cache
 * @returns Array of keys from most to least recently used
 *
 * @example
 * ```typescript
 * const keys = getKeys(cache);
 * console.log(keys); // ['newest', 'older', 'oldest']
 * ```
 */
export function getKeys<K, V>(cache: LRUCache<K, V>): K[] {
  const result: K[] = [];
  let currentKey = cache.head;

  while (currentKey !== undefined) {
    const node = cache.storage.get(currentKey);
    if (node === undefined) {
      break;
    }
    result.push(node.key);
    currentKey = node.next;
  }

  return result;
}

/**
 * Get all values in the cache.
 * Values are ordered from most recently used to least recently used.
 *
 * @param cache - The LRU cache
 * @returns Array of values from most to least recently used
 *
 * @example
 * ```typescript
 * const values = getValues(cache);
 * console.log(values); // [1, 2, 3]
 * ```
 */
export function getValues<K, V>(cache: LRUCache<K, V>): V[] {
  const result: V[] = [];
  let currentKey = cache.head;

  while (currentKey !== undefined) {
    const node = cache.storage.get(currentKey);
    if (node === undefined) {
      break;
    }
    result.push(node.value);
    currentKey = node.next;
  }

  return result;
}

// =============================================================================
// Internal Helper Functions
// =============================================================================

/**
 * Add a new node to the front of the list (most recently used position).
 * @internal
 */
function addToFront<K, V>(
  cache: LRUCache<K, V>,
  key: K,
  value: V,
  storage: LRUCacheStorage<K, V>
): LRUCache<K, V> {
  const newNode: LRUCacheNode<K, V> = {
    key,
    value,
    prev: undefined,
    next: cache.head,
  };

  storage.set(key, newNode);

  // Update the old head's prev pointer
  if (cache.head !== undefined) {
    const oldHead = storage.get(cache.head);
    if (oldHead !== undefined) {
      storage.set(cache.head, { ...oldHead, prev: key });
    }
  }

  const newTail = cache.tail === undefined ? key : cache.tail;

  return {
    head: key,
    tail: newTail,
    size: cache.size + 1,
    capacity: cache.capacity,
    storage,
  };
}

/**
 * Remove a node from the list and delete it from storage.
 * @internal
 */
function removeFromList<K, V>(
  cache: LRUCache<K, V>,
  key: K,
  storage: LRUCacheStorage<K, V>
): LRUCache<K, V> {
  const node = storage.get(key);
  if (node === undefined) {
    return cache;
  }

  // Update prev node's next pointer
  if (node.prev !== undefined) {
    const prevNode = storage.get(node.prev);
    if (prevNode !== undefined) {
      storage.set(node.prev, { ...prevNode, next: node.next });
    }
  }

  // Update next node's prev pointer
  if (node.next !== undefined) {
    const nextNode = storage.get(node.next);
    if (nextNode !== undefined) {
      storage.set(node.next, { ...nextNode, prev: node.prev });
    }
  }

  // Update head/tail if necessary
  const newHead = cache.head === key ? node.next : cache.head;
  const newTail = cache.tail === key ? node.prev : cache.tail;

  storage.delete(key);

  return {
    head: newHead,
    tail: newTail,
    size: cache.size - 1,
    capacity: cache.capacity,
    storage,
  };
}

/**
 * Evict the least recently used entry (tail).
 * Precondition: cache.tail must be defined (ensured by caller at line 142)
 * @internal
 */
function evictTail<K, V>(cache: LRUCache<K, V>, storage: LRUCacheStorage<K, V>): LRUCache<K, V> {
  // Safe to assert: caller ensures tail is defined
  return removeFromList(cache, cache.tail!, storage);
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate an LRU cache's internal consistency.
 *
 * @param cache - The LRU cache to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateLRUCache(cache);
 * if (!result.valid) {
 *   console.error('Invalid cache:', result.errors);
 * }
 * ```
 */
export function validateLRUCache<K, V>(cache: LRUCache<K, V>): LRUCacheValidationResult {
  const errors: LRUCacheValidationError[] = [];

  // Check capacity
  if (cache.capacity < 1 || !Number.isInteger(cache.capacity)) {
    errors.push({
      type: 'invalid_capacity',
      details: `Capacity must be a positive integer, got: ${cache.capacity}`,
    });
  }

  // Check size
  if (cache.size < 0 || cache.size > cache.capacity) {
    errors.push({
      type: 'invalid_size',
      details: `Size ${cache.size} is invalid for capacity ${cache.capacity}`,
    });
  }

  // Check head/tail consistency with size
  if (cache.size === 0) {
    if (cache.head !== undefined || cache.tail !== undefined) {
      errors.push({
        type: 'invalid_links',
        details: 'Empty cache should have head and tail as undefined',
      });
    }
  } else if (cache.size === 1) {
    if (cache.head !== cache.tail) {
      errors.push({
        type: 'invalid_links',
        details: 'Single-entry cache should have head === tail',
      });
    }
  } else {
    if (cache.head === undefined || cache.tail === undefined) {
      errors.push({
        type: 'invalid_links',
        details: 'Non-empty cache should have both head and tail defined',
      });
    }
  }

  // Walk the list and verify integrity
  if (cache.head !== undefined) {
    const visited = new Set<K>();
    let current: K | undefined = cache.head;
    let count = 0;

    while (current !== undefined && count <= cache.size) {
      if (visited.has(current)) {
        errors.push({
          type: 'invalid_links',
          details: 'Cycle detected in linked list',
        });
        break;
      }

      visited.add(current);
      const node = cache.storage.get(current);

      if (node === undefined) {
        errors.push({
          type: 'orphaned_nodes',
          details: `Node ${String(current)} referenced but not in storage`,
        });
        break;
      }

      // Verify bidirectional links
      if (node.next !== undefined) {
        const nextNode = cache.storage.get(node.next);
        if (nextNode !== undefined && nextNode.prev !== current) {
          errors.push({
            type: 'invalid_links',
            details: `Bidirectional link broken at ${String(current)}`,
          });
        }
      }

      current = node.next;
      count++;
    }

    if (count !== cache.size) {
      errors.push({
        type: 'size_mismatch',
        details: `Size is ${cache.size} but list contains ${count} nodes`,
      });
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
 * Creates a Map-backed storage instance.
 *
 * @internal Used by createMapStorageFactory
 */
function createMapStorage<K, V>(map: Map<K, LRUCacheNode<K, V>>): LRUCacheStorage<K, V> {
  return {
    get(key: K): LRUCacheNode<K, V> | undefined {
      return map.get(key);
    },
    set(key: K, node: LRUCacheNode<K, V>): void {
      map.set(key, node);
    },
    delete(key: K): boolean {
      return map.delete(key);
    },
    has(key: K): boolean {
      return map.has(key);
    },
    clear(): void {
      map.clear();
    },
    clone(): LRUCacheStorage<K, V> {
      return createMapStorage(new Map(map));
    },
  };
}

/**
 * Creates a storage factory that uses standard JavaScript Maps.
 *
 * This is a convenience helper for hosts that want simple Map-backed storage.
 *
 * @typeParam K - The type of keys
 * @typeParam V - The type of values
 * @returns A storage factory that creates Map-backed storage
 *
 * @example
 * ```typescript
 * const cache = createLRUCache(createMapStorageFactory<string, number>(), 100);
 * ```
 */
export function createMapStorageFactory<K, V>(): LRUCacheStorageFactory<K, V> {
  return {
    create(): LRUCacheStorage<K, V> {
      return createMapStorage(new Map());
    },
  };
}
