/**
 * Built-in data structure presets for parallel agent implementation.
 */

import type { DataStructureConfig } from '@conveaux/domain-prompt-template';

export const PRESETS: Record<string, DataStructureConfig> = {
  'lru-cache': {
    name: 'lru-cache',
    displayName: 'LRU Cache',
    contractMethods: [
      'get(key: K): V | undefined',
      'set(key: K, value: V): void',
      'has(key: K): boolean',
      'delete(key: K): boolean',
      'clear(): void',
      'readonly size: number',
      'readonly capacity: number',
    ],
    dependencies: 'StorageFactory<K, V>',
    options: 'capacity: number',
    implementationNotes: 'Use Map + doubly-linked list for O(1) operations on all methods',
    referencePackage: 'ring-buffer',
  },

  'priority-queue': {
    name: 'priority-queue',
    displayName: 'Priority Queue',
    contractMethods: [
      'push(item: T, priority: number): void',
      'pop(): T | undefined',
      'peek(): T | undefined',
      'readonly size: number',
      'isEmpty(): boolean',
    ],
    dependencies: 'Comparator<number> (optional, default min-heap)',
    options: 'initialCapacity?: number',
    implementationNotes: 'Binary heap implementation with configurable comparator',
    referencePackage: 'ring-buffer',
  },

  'bloom-filter': {
    name: 'bloom-filter',
    displayName: 'Bloom Filter',
    contractMethods: [
      'add(item: T): void',
      'mayContain(item: T): boolean',
      'clear(): void',
      'readonly estimatedFalsePositiveRate: number',
    ],
    dependencies: 'HashFunctionFactory<T> (injectable hash functions)',
    options: 'expectedItems: number, falsePositiveRate: number',
    implementationNotes: 'Probabilistic data structure - "definitely not in set" or "maybe in set"',
    referencePackage: 'ring-buffer',
  },

  semaphore: {
    name: 'semaphore',
    displayName: 'Semaphore',
    contractMethods: [
      'acquire(): Promise<void>',
      'release(): void',
      'tryAcquire(): boolean',
      'readonly availablePermits: number',
    ],
    options: 'permits: number',
    implementationNotes: 'Concurrency limiting primitive. Queue waiters when no permits available.',
    referencePackage: 'ring-buffer',
  },

  'sliding-window': {
    name: 'sliding-window',
    displayName: 'Sliding Window',
    contractMethods: [
      'add(item: T, timestamp?: number): void',
      'getWindow(): readonly T[]',
      'count(): number',
      'clear(): void',
    ],
    dependencies: 'WallClock (for time-based windows)',
    options: "windowSize: number, windowType: 'count' | 'time'",
    implementationNotes:
      'Time-based or count-based sliding window for rate limiting, metrics aggregation',
    referencePackage: 'ring-buffer',
  },

  trie: {
    name: 'trie',
    displayName: 'Trie',
    contractMethods: [
      'insert(key: string, value: V): void',
      'get(key: string): V | undefined',
      'findByPrefix(prefix: string): Map<string, V>',
      'delete(key: string): boolean',
      'has(key: string): boolean',
    ],
    dependencies: 'NodeFactory<V> (optional)',
    options: 'caseSensitive?: boolean',
    implementationNotes: 'Prefix tree for efficient string prefix matching, autocomplete, routing',
    referencePackage: 'ring-buffer',
  },

  'object-pool': {
    name: 'object-pool',
    displayName: 'Object Pool',
    contractMethods: [
      'acquire(): Promise<T>',
      'release(item: T): void',
      'readonly size: number',
      'readonly available: number',
      'readonly inUse: number',
    ],
    dependencies: 'ObjectFactory<T>, ObjectValidator<T> (optional)',
    options: 'minSize: number, maxSize: number',
    implementationNotes: 'Reusable object pool for expensive resources (connections, buffers)',
    referencePackage: 'ring-buffer',
  },

  'sorted-set': {
    name: 'sorted-set',
    displayName: 'Sorted Set',
    contractMethods: [
      'add(item: T, score: number): void',
      'remove(item: T): boolean',
      'rank(item: T): number | undefined',
      'range(start: number, end: number): readonly T[]',
      'score(item: T): number | undefined',
    ],
    dependencies: 'Comparator<number>',
    options: 'initialCapacity?: number',
    implementationNotes:
      'Ordered collection by score. Good for leaderboards, time-series indexing.',
    referencePackage: 'ring-buffer',
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);
