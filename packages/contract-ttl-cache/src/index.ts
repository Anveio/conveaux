/**
 * @conveaux/contract-ttl-cache
 *
 * Pure types for time-aware LRU caching.
 * Composes LRU Cache + WallClock for automatic expiration.
 *
 * Design principle: TTL cache entries automatically expire after
 * a configurable time-to-live, while still respecting LRU eviction
 * when capacity is reached.
 * - Contract: pure types (TTLCache, TTLCacheEntry, TTLCacheOptions)
 * - Port: pure functions (create, get, set, has, delete, prune)
 *
 * This composition:
 * - Automatic expiration of stale data
 * - LRU eviction for capacity management
 * - Injectable time source for testing
 */

import type { WallClock } from '@conveaux/contract-wall-clock';

// Re-export dependency types for convenience
export type { WallClock } from '@conveaux/contract-wall-clock';
export type { LRUCacheStorageFactory } from '@conveaux/contract-lru-cache';

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * An entry in the TTL cache with timestamp metadata.
 *
 * @template V - The type of value stored
 */
export interface TTLCacheEntry<V> {
  /** The cached value */
  readonly value: V;

  /** Timestamp when this entry was created/updated (ms since epoch) */
  readonly createdAt: number;
}

/**
 * A time-aware LRU cache.
 *
 * Combines LRU caching with automatic TTL-based expiration.
 * Entries are evicted when capacity is reached (LRU) or when
 * they exceed their time-to-live.
 *
 * @template K - The type of keys
 * @template V - The type of values
 *
 * @example
 * ```typescript
 * import { createTTLCache, get, set, prune } from '@conveaux/port-ttl-cache';
 *
 * const cache = createTTLCache({
 *   capacity: 100,
 *   ttlMs: 60000,  // 1 minute
 *   wallClock: systemWallClock
 * });
 *
 * const updated = set(cache, 'session', sessionData);
 * const value = get(updated, 'session');  // undefined if expired
 * const pruned = prune(updated);  // Remove all expired entries
 * ```
 */
export interface TTLCache<K, V> {
  /** The underlying LRU cache head key */
  readonly head: K | undefined;

  /** The underlying LRU cache tail key */
  readonly tail: K | undefined;

  /** Number of entries currently in the cache */
  readonly size: number;

  /** Maximum number of entries allowed */
  readonly capacity: number;

  /** Time-to-live in milliseconds */
  readonly ttlMs: number;

  /** Storage for cache entries with TTL metadata */
  readonly storage: TTLCacheStorage<K, V>;

  /** Injectable time source */
  readonly wallClock: WallClock;
}

/**
 * Storage interface for TTL cache entries.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
export interface TTLCacheStorage<K, V> {
  get(key: K): TTLCacheNode<K, V> | undefined;
  set(key: K, node: TTLCacheNode<K, V>): void;
  delete(key: K): boolean;
  has(key: K): boolean;
  clear(): void;
  clone(): TTLCacheStorage<K, V>;
  keys(): IterableIterator<K>;
}

/**
 * A node in the TTL cache's internal linked list.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
export interface TTLCacheNode<K, V> {
  readonly key: K;
  readonly entry: TTLCacheEntry<V>;
  readonly prev: K | undefined;
  readonly next: K | undefined;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Options for creating a TTL cache.
 */
export interface TTLCacheOptions {
  /** Maximum number of entries in the cache */
  readonly capacity: number;

  /** Time-to-live in milliseconds */
  readonly ttlMs: number;

  /** Injectable time source */
  readonly wallClock: WallClock;
}

/**
 * Factory for creating TTL cache storage.
 *
 * @template K - The type of keys
 * @template V - The type of values
 */
export interface TTLCacheStorageFactory<K, V> {
  create(): TTLCacheStorage<K, V>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type TTLCacheValidationErrorType =
  | 'invalid_capacity'
  | 'invalid_ttl'
  | 'invalid_size'
  | 'invalid_links'
  | 'orphaned_nodes'
  | 'size_mismatch'
  | 'expired_entries_not_pruned';

/**
 * A validation error found in a TTL cache.
 */
export interface TTLCacheValidationError {
  readonly type: TTLCacheValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a TTL cache.
 */
export interface TTLCacheValidationResult {
  readonly valid: boolean;
  readonly errors: readonly TTLCacheValidationError[];
}
