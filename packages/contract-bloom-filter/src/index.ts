/**
 * @conveaux/contract-bloom-filter
 *
 * Pure types for probabilistic set membership testing.
 * No runtime code - all operations are pure functions in @conveaux/port-bloom-filter.
 *
 * Design principle (following DAG pattern): A Bloom filter is data, not a capability.
 * - Contract: pure types (BloomFilter, BloomFilterStorage, HashFunctionFactory)
 * - Port: pure functions (add, mayContain, clear, etc.)
 *
 * This separation enables:
 * - Serialization/persistence of filter state
 * - Time-travel debugging
 * - Testing without mocks
 * - Platform-agnostic hash function injection
 */

// =============================================================================
// Core Data Types
// =============================================================================

/**
 * A Bloom filter is pure data - bit array and configuration.
 *
 * All operations on the Bloom filter are pure functions in the port.
 * The filter is immutable; operations return new filter instances.
 *
 * Bloom filters are probabilistic data structures for set membership testing:
 * - "definitely not in set" (100% accurate)
 * - "probably in set" (false positives possible, rate configurable)
 *
 * @template T - The type of elements to test for membership
 *
 * @example
 * ```typescript
 * import { createBloomFilter, add, mayContain } from '@conveaux/port-bloom-filter';
 *
 * const filter = createBloomFilter<string>(hashFactory, { expectedItems: 1000, falsePositiveRate: 0.01 });
 * const filter2 = add(filter, 'hello');
 * const result = mayContain(filter2, 'hello'); // true
 * const notPresent = mayContain(filter2, 'world'); // false (or true if collision)
 * ```
 */
export interface BloomFilter<T> {
  /** Bit array size (optimal size calculated from expectedItems and falsePositiveRate) */
  readonly bitArraySize: number;

  /** Number of hash functions (optimal number calculated from expectedItems and falsePositiveRate) */
  readonly numHashFunctions: number;

  /** Number of items expected to be inserted */
  readonly expectedItems: number;

  /** Target false positive rate (0 to 1) */
  readonly falsePositiveRate: number;

  /** Current number of items added to the filter */
  readonly itemCount: number;

  /** Reference to the backing storage (bit array) */
  readonly storage: BloomFilterStorage;

  /** Reference to the hash function factory */
  readonly hashFactory: HashFunctionFactory<T>;
}

/**
 * Storage interface for Bloom filter bit array.
 *
 * This abstraction allows the host platform to inject different
 * storage implementations:
 * - Standard JavaScript arrays of booleans
 * - Bit-packed arrays for memory efficiency
 * - Custom implementations
 *
 * Note: While storage has methods (get/set), this is a capability interface
 * that represents platform-provided functionality. The BloomFilter itself remains pure data.
 */
export interface BloomFilterStorage {
  /**
   * Get the bit value at the specified index.
   *
   * @param index - The bit index to read from (0 to size-1)
   * @returns True if the bit is set, false otherwise
   */
  get(index: number): boolean;

  /**
   * Set the bit at the specified index to true.
   *
   * @param index - The bit index to set (0 to size-1)
   */
  set(index: number): void;

  /**
   * Clone the storage for immutable operations.
   * Returns a new storage instance with the same bit values.
   *
   * @returns A new storage instance with copied data
   */
  clone(): BloomFilterStorage;

  /**
   * Get the total size of the bit array.
   *
   * @returns The number of bits in the array
   */
  size(): number;
}

/**
 * Factory for creating Bloom filter storage.
 *
 * Injected by the host platform to provide storage implementation.
 */
export interface BloomFilterStorageFactory {
  /**
   * Create a new storage instance with the given size.
   *
   * @param size - The number of bits the storage should hold
   * @returns A new storage instance with all bits initialized to false
   */
  create(size: number): BloomFilterStorage;
}

/**
 * Hash function that converts an item to a numeric hash value.
 *
 * @template T - The type of items to hash
 */
export interface HashFunction<T> {
  /**
   * Compute a hash value for the given item.
   *
   * @param item - The item to hash
   * @returns A numeric hash value (can be negative or exceed bit array size)
   */
  hash(item: T): number;
}

/**
 * Factory for creating hash functions.
 *
 * Injected by the host platform to provide hash function implementations.
 * The factory should generate k independent hash functions for the Bloom filter.
 *
 * @template T - The type of items to hash
 */
export interface HashFunctionFactory<T> {
  /**
   * Create a hash function with the given seed.
   * Different seeds should produce independent hash functions.
   *
   * @param seed - Seed value for the hash function
   * @returns A hash function
   */
  create(seed: number): HashFunction<T>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Types of validation errors that can occur.
 */
export type BloomFilterValidationErrorType =
  | 'invalid_bit_array_size'
  | 'invalid_num_hash_functions'
  | 'invalid_expected_items'
  | 'invalid_false_positive_rate'
  | 'invalid_item_count'
  | 'storage_size_mismatch';

/**
 * A validation error found in a Bloom filter.
 */
export interface BloomFilterValidationError {
  readonly type: BloomFilterValidationErrorType;
  readonly details: string;
}

/**
 * Result of validating a Bloom filter.
 */
export interface BloomFilterValidationResult {
  readonly valid: boolean;
  readonly errors: readonly BloomFilterValidationError[];
}

/**
 * Options for creating a Bloom filter.
 */
export interface BloomFilterOptions {
  /**
   * Expected number of items to be inserted.
   * Used to calculate optimal bit array size and number of hash functions.
   */
  readonly expectedItems: number;

  /**
   * Target false positive rate (0 to 1).
   * Lower rates require more memory but provide better accuracy.
   * Typical values: 0.01 (1%), 0.001 (0.1%)
   */
  readonly falsePositiveRate: number;
}
