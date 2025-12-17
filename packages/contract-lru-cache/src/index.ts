/**
 * @conveaux/contract-lru-cache
 *
 * Pure types for LRU (Least Recently Used) caches.
 * No runtime code - all operations are pure functions in @conveaux/port-lru-cache.
 *
 * Design principle (following DAG pattern): An LRU cache is data, not a capability.
 * - Contract: pure types (LRUCache, LRUCacheStorage, LRUCacheNode)
 * - Port: pure functions (get, set, has, delete, clear, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of cache state
 * - Time-travel debugging
 * - Structural sharing for efficient immutable updates
 * - Testing without mocks
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * A node in the doubly-linked list used by the LRU cache.
 * Stores a key-value pair and links to previous/next nodes.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
export interface LRUCacheNode<K, V> {
  /** The key stored in this node */
  readonly key: K;

  /** The value stored in this node */
  readonly value: V;

  /** Reference to the previous node (more recently used), or undefined if this is the head */
  readonly prev: K | undefined;

  /** Reference to the next node (less recently used), or undefined if this is the tail */
  readonly next: K | undefined;
}

/**
 * An LRU cache is pure data - a doubly-linked list and a map for O(1) lookups.
 *
 * All operations on the cache are pure functions in the port.
 * The cache is immutable; operations return new cache instances.
 *
 * @template K - The type of keys stored
 * @template V - The type of values stored
 *
 * @example
 * ```typescript
 * import { createLRUCache, set, get } from '@conveaux/port-lru-cache';
 *
 * const empty = createLRUCache<string, number>(3);
 * const cache1 = set(empty, 'a', 1);
 * const cache2 = set(cache1, 'b', 2);
 * const value = get(cache2, 'a');
 * console.log(value); // 1
 * ```
 */
export interface LRUCache<K, V> {
  /** Key of the most recently used item (head of the list), or undefined if empty */
  readonly head: K | undefined;

  /** Key of the least recently used item (tail of the list), or undefined if empty */
  readonly tail: K | undefined;

  /** Current number of entries in the cache */
  readonly size: number;

  /** Maximum number of entries the cache can hold */
  readonly capacity: number;

  /** Reference to the backing storage */
  readonly storage: LRUCacheStorage<K, V>;
}

/**
 * Storage interface for LRU cache backing store.
 *
 * This abstraction allows the host platform to inject different
 * storage implementations:
 * - Standard JavaScript Map
 * - WeakMap for garbage collection
 * - Custom persistent storage implementations
 *
 * Note: While storage has methods (get/set/delete/has), this is a capability interface
 * that represents platform-provided functionality, similar to how DAG execution
 * accepts an observer callback. The LRUCache itself remains pure data.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
export interface LRUCacheStorage<K, V> {
  /**
   * Get the node for the specified key.
   *
   * @param key - The key to look up
   * @returns The node for that key, or undefined if not found
   */
  get(key: K): LRUCacheNode<K, V> | undefined;

  /**
   * Store a node for the specified key.
   *
   * @param key - The key to store
   * @param node - The node to associate with the key
   */
  set(key: K, node: LRUCacheNode<K, V>): void;

  /**
   * Remove the entry for the specified key.
   *
   * @param key - The key to remove
   * @returns True if the key was found and removed, false otherwise
   */
  delete(key: K): boolean;

  /**
   * Check if a key exists in storage.
   *
   * @param key - The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean;

  /**
   * Remove all entries from storage.
   */
  clear(): void;

  /**
   * Clone the storage for immutable operations.
   * Returns a new storage instance with the same contents.
   *
   * @returns A new storage instance with copied data
   */
  clone(): LRUCacheStorage<K, V>;
}

/**
 * Factory for creating LRU cache storage.
 *
 * Injected by the host platform to provide storage implementation.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
export interface LRUCacheStorageFactory<K, V> {
  /**
   * Create a new empty storage instance.
   *
   * @returns A new storage instance
   */
  create(): LRUCacheStorage<K, V>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type LRUCacheValidationErrorType =
  | 'invalid_capacity'
  | 'invalid_size'
  | 'invalid_links'
  | 'size_mismatch'
  | 'orphaned_nodes';

/**
 * A validation error found in an LRU cache.
 */
export interface LRUCacheValidationError {
  readonly type: LRUCacheValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating an LRU cache.
 */
export interface LRUCacheValidationResult {
  readonly valid: boolean;
  readonly errors: readonly LRUCacheValidationError[];
}
