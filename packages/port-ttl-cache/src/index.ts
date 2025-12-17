/**
 * @conveaux/port-ttl-cache
 *
 * Pure functions for operating on TTL caches.
 * Platform agnostic - host provides storage factory and wall clock.
 *
 * Composes LRU cache with time-based expiration.
 * All functions are pure: they take a cache and return a new cache.
 * The original cache is never mutated.
 */

import type {
  TTLCache,
  TTLCacheEntry,
  TTLCacheNode,
  TTLCacheOptions,
  TTLCacheStorage,
  TTLCacheStorageFactory,
  TTLCacheValidationError,
  TTLCacheValidationResult,
} from '@conveaux/contract-ttl-cache';

// Re-export contract types for convenience
export type {
  TTLCache,
  TTLCacheEntry,
  TTLCacheNode,
  TTLCacheOptions,
  TTLCacheStorage,
  TTLCacheStorageFactory,
  TTLCacheValidationError,
  TTLCacheValidationResult,
  WallClock,
} from '@conveaux/contract-ttl-cache';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Creates a new empty TTL cache with the specified options.
 *
 * @param storageFactory - Factory for creating the backing storage
 * @param options - Configuration including capacity, TTL, and wall clock
 * @returns A new empty TTLCache
 * @throws Error if capacity is not a positive integer
 * @throws Error if ttlMs is not a positive number
 *
 * @example
 * ```typescript
 * const cache = createTTLCache(createMapStorageFactory<string, number>(), {
 *   capacity: 100,
 *   ttlMs: 60000,  // 1 minute
 *   wallClock: systemWallClock
 * });
 * ```
 */
export function createTTLCache<K, V>(
  storageFactory: TTLCacheStorageFactory<K, V>,
  options: TTLCacheOptions
): TTLCache<K, V> {
  if (options.capacity < 1 || !Number.isInteger(options.capacity)) {
    throw new Error(`Capacity must be a positive integer, got: ${options.capacity}`);
  }

  if (options.ttlMs <= 0 || !Number.isFinite(options.ttlMs)) {
    throw new Error(`TTL must be a positive number, got: ${options.ttlMs}`);
  }

  return {
    head: undefined,
    tail: undefined,
    size: 0,
    capacity: options.capacity,
    ttlMs: options.ttlMs,
    storage: storageFactory.create(),
    wallClock: options.wallClock,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Get the value for the specified key.
 * Returns undefined if the key doesn't exist or has expired.
 *
 * @param cache - The TTL cache
 * @param key - The key to look up
 * @returns The value if found and not expired, or undefined otherwise
 *
 * @example
 * ```typescript
 * const value = get(cache, 'myKey');
 * if (value !== undefined) {
 *   console.log('Found:', value);
 * }
 * ```
 */
export function get<K, V>(cache: TTLCache<K, V>, key: K): V | undefined {
  const node = cache.storage.get(key);
  if (node === undefined) {
    return undefined;
  }

  // Check if entry has expired
  const now = cache.wallClock.nowMs();
  const age = now - node.entry.createdAt;
  if (age >= cache.ttlMs) {
    return undefined;
  }

  return node.entry.value;
}

/**
 * Set a key-value pair in the cache.
 * Marks the key as most recently used and sets the creation timestamp.
 * If the cache is full, evicts the least recently used entry.
 * Expired entries are not automatically pruned by this operation.
 *
 * @param cache - The TTL cache
 * @param key - The key to set
 * @param value - The value to associate with the key
 * @returns A new cache with the entry added/updated
 *
 * @example
 * ```typescript
 * const cache1 = createTTLCache(factory, { capacity: 3, ttlMs: 60000, wallClock });
 * const cache2 = set(cache1, 'a', 1);
 * const cache3 = set(cache2, 'b', 2);
 * ```
 */
export function set<K, V>(cache: TTLCache<K, V>, key: K, value: V): TTLCache<K, V> {
  const newStorage = cache.storage.clone();
  const existingNode = newStorage.get(key);
  const now = cache.wallClock.nowMs();

  const entry: TTLCacheEntry<V> = {
    value,
    createdAt: now,
  };

  if (existingNode !== undefined) {
    // Key already exists - update value and move to front
    // First, remove from current position in the list
    const removedCache = removeFromList(cache, key, newStorage);
    // Then add to front with new entry
    return addToFront(removedCache, key, entry, newStorage);
  }

  // Key doesn't exist - add new entry
  let workingCache = cache;

  // If at capacity, evict least recently used (tail)
  if (cache.size >= cache.capacity && cache.tail !== undefined) {
    workingCache = evictTail(cache, newStorage);
  }

  // Add new entry to front
  return addToFront(workingCache, key, entry, newStorage);
}

/**
 * Check if a key exists in the cache and has not expired.
 *
 * @param cache - The TTL cache
 * @param key - The key to check
 * @returns True if the key exists and has not expired, false otherwise
 *
 * @example
 * ```typescript
 * if (has(cache, 'myKey')) {
 *   console.log('Key exists and is valid');
 * }
 * ```
 */
export function has<K, V>(cache: TTLCache<K, V>, key: K): boolean {
  const node = cache.storage.get(key);
  if (node === undefined) {
    return false;
  }

  // Check if entry has expired
  const now = cache.wallClock.nowMs();
  const age = now - node.entry.createdAt;
  return age < cache.ttlMs;
}

/**
 * Delete a key from the cache.
 *
 * @param cache - The TTL cache
 * @param key - The key to delete
 * @returns A new cache with the entry removed
 *
 * @example
 * ```typescript
 * const cache2 = deleteKey(cache1, 'myKey');
 * ```
 */
export function deleteKey<K, V>(cache: TTLCache<K, V>, key: K): TTLCache<K, V> {
  if (!cache.storage.has(key)) {
    return cache;
  }

  const newStorage = cache.storage.clone();
  return removeFromList(cache, key, newStorage);
}

/**
 * Prune all expired entries from the cache.
 * This is useful for explicitly cleaning up memory in long-running caches.
 *
 * @param cache - The TTL cache
 * @returns A new cache with expired entries removed
 *
 * @example
 * ```typescript
 * const pruned = prune(cache);
 * ```
 */
export function prune<K, V>(cache: TTLCache<K, V>): TTLCache<K, V> {
  const now = cache.wallClock.nowMs();
  const expiredKeys: K[] = [];

  // Collect all expired keys
  for (const key of cache.storage.keys()) {
    const node = cache.storage.get(key);
    if (node !== undefined) {
      const age = now - node.entry.createdAt;
      if (age >= cache.ttlMs) {
        expiredKeys.push(key);
      }
    }
  }

  // If no expired keys, return the same cache reference
  if (expiredKeys.length === 0) {
    return cache;
  }

  // Remove all expired keys
  let prunedCache = cache;
  for (const key of expiredKeys) {
    prunedCache = deleteKey(prunedCache, key);
  }

  return prunedCache;
}

/**
 * Clear all entries from the cache.
 *
 * @param cache - The TTL cache to clear
 * @param storageFactory - Factory for creating new backing storage
 * @returns A new empty cache with the same capacity and TTL
 *
 * @example
 * ```typescript
 * const cleared = clear(cache, factory);
 * console.log(cleared.size); // 0
 * ```
 */
export function clear<K, V>(
  cache: TTLCache<K, V>,
  storageFactory: TTLCacheStorageFactory<K, V>
): TTLCache<K, V> {
  return createTTLCache(storageFactory, {
    capacity: cache.capacity,
    ttlMs: cache.ttlMs,
    wallClock: cache.wallClock,
  });
}

/**
 * Convert the cache contents to an array of [key, value] pairs.
 * Pairs are ordered from most recently used to least recently used.
 * Only includes non-expired entries.
 *
 * @param cache - The TTL cache
 * @returns Array of [key, value] pairs from most to least recently used
 *
 * @example
 * ```typescript
 * const entries = toArray(cache);
 * console.log(entries); // [['newest', 1], ['older', 2], ['oldest', 3]]
 * ```
 */
export function toArray<K, V>(cache: TTLCache<K, V>): Array<[K, V]> {
  const result: Array<[K, V]> = [];
  const now = cache.wallClock.nowMs();
  let currentKey = cache.head;

  while (currentKey !== undefined) {
    const node = cache.storage.get(currentKey);
    if (node === undefined) {
      break; // Shouldn't happen in a valid cache
    }

    // Only include non-expired entries
    const age = now - node.entry.createdAt;
    if (age < cache.ttlMs) {
      result.push([node.key, node.entry.value]);
    }

    currentKey = node.next;
  }

  return result;
}

/**
 * Get all keys in the cache.
 * Keys are ordered from most recently used to least recently used.
 * Only includes non-expired entries.
 *
 * @param cache - The TTL cache
 * @returns Array of keys from most to least recently used
 *
 * @example
 * ```typescript
 * const keys = getKeys(cache);
 * console.log(keys); // ['newest', 'older', 'oldest']
 * ```
 */
export function getKeys<K, V>(cache: TTLCache<K, V>): K[] {
  const result: K[] = [];
  const now = cache.wallClock.nowMs();
  let currentKey = cache.head;

  while (currentKey !== undefined) {
    const node = cache.storage.get(currentKey);
    if (node === undefined) {
      break;
    }

    // Only include non-expired entries
    const age = now - node.entry.createdAt;
    if (age < cache.ttlMs) {
      result.push(node.key);
    }

    currentKey = node.next;
  }

  return result;
}

/**
 * Get all values in the cache.
 * Values are ordered from most recently used to least recently used.
 * Only includes non-expired entries.
 *
 * @param cache - The TTL cache
 * @returns Array of values from most to least recently used
 *
 * @example
 * ```typescript
 * const values = getValues(cache);
 * console.log(values); // [1, 2, 3]
 * ```
 */
export function getValues<K, V>(cache: TTLCache<K, V>): V[] {
  const result: V[] = [];
  const now = cache.wallClock.nowMs();
  let currentKey = cache.head;

  while (currentKey !== undefined) {
    const node = cache.storage.get(currentKey);
    if (node === undefined) {
      break;
    }

    // Only include non-expired entries
    const age = now - node.entry.createdAt;
    if (age < cache.ttlMs) {
      result.push(node.entry.value);
    }

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
  cache: TTLCache<K, V>,
  key: K,
  entry: TTLCacheEntry<V>,
  storage: TTLCacheStorage<K, V>
): TTLCache<K, V> {
  const newNode: TTLCacheNode<K, V> = {
    key,
    entry,
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
    ttlMs: cache.ttlMs,
    storage,
    wallClock: cache.wallClock,
  };
}

/**
 * Remove a node from the list and delete it from storage.
 * @internal
 */
function removeFromList<K, V>(
  cache: TTLCache<K, V>,
  key: K,
  storage: TTLCacheStorage<K, V>
): TTLCache<K, V> {
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
    ttlMs: cache.ttlMs,
    storage,
    wallClock: cache.wallClock,
  };
}

/**
 * Evict the least recently used entry (tail).
 * Precondition: cache.tail must be defined (ensured by caller)
 * @internal
 */
function evictTail<K, V>(cache: TTLCache<K, V>, storage: TTLCacheStorage<K, V>): TTLCache<K, V> {
  if (cache.tail === undefined) {
    // This should never happen as caller ensures tail is defined
    return cache;
  }
  return removeFromList(cache, cache.tail, storage);
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a TTL cache's internal consistency.
 *
 * @param cache - The TTL cache to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateTTLCache(cache);
 * if (!result.valid) {
 *   console.error('Invalid cache:', result.errors);
 * }
 * ```
 */
export function validateTTLCache<K, V>(cache: TTLCache<K, V>): TTLCacheValidationResult {
  const errors: TTLCacheValidationError[] = [];

  // Check capacity
  if (cache.capacity < 1 || !Number.isInteger(cache.capacity)) {
    errors.push({
      type: 'invalid_capacity',
      details: `Capacity must be a positive integer, got: ${cache.capacity}`,
    });
  }

  // Check TTL
  if (cache.ttlMs <= 0 || !Number.isFinite(cache.ttlMs)) {
    errors.push({
      type: 'invalid_ttl',
      details: `TTL must be a positive number, got: ${cache.ttlMs}`,
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
function createMapStorage<K, V>(map: Map<K, TTLCacheNode<K, V>>): TTLCacheStorage<K, V> {
  return {
    get(key: K): TTLCacheNode<K, V> | undefined {
      return map.get(key);
    },
    set(key: K, node: TTLCacheNode<K, V>): void {
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
    clone(): TTLCacheStorage<K, V> {
      return createMapStorage(new Map(map));
    },
    keys(): IterableIterator<K> {
      return map.keys();
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
 * const cache = createTTLCache(createMapStorageFactory<string, number>(), {
 *   capacity: 100,
 *   ttlMs: 60000,
 *   wallClock: systemWallClock
 * });
 * ```
 */
export function createMapStorageFactory<K, V>(): TTLCacheStorageFactory<K, V> {
  return {
    create(): TTLCacheStorage<K, V> {
      return createMapStorage(new Map());
    },
  };
}
