/**
 * @conveaux/port-bloom-filter
 *
 * Pure functions for operating on Bloom filters.
 * Platform agnostic - host provides storage and hash function factories.
 *
 * All functions are pure: they take a filter and return a new filter.
 * The original filter is never mutated.
 */

import type {
  BloomFilter,
  BloomFilterOptions,
  BloomFilterStorage,
  BloomFilterStorageFactory,
  BloomFilterValidationError,
  BloomFilterValidationResult,
  HashFunction,
  HashFunctionFactory,
} from '@conveaux/contract-bloom-filter';

// Re-export contract types for convenience
export type {
  BloomFilter,
  BloomFilterOptions,
  BloomFilterStorage,
  BloomFilterStorageFactory,
  BloomFilterValidationError,
  BloomFilterValidationResult,
  HashFunction,
  HashFunctionFactory,
} from '@conveaux/contract-bloom-filter';

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Calculate optimal bit array size for a Bloom filter.
 *
 * Formula: m = -(n * ln(p)) / (ln(2)^2)
 * where:
 * - m = bit array size
 * - n = expected number of items
 * - p = false positive rate
 *
 * @param expectedItems - Expected number of items to insert
 * @param falsePositiveRate - Target false positive rate (0 to 1)
 * @returns Optimal bit array size
 */
function calculateBitArraySize(expectedItems: number, falsePositiveRate: number): number {
  return Math.ceil(
    -(expectedItems * Math.log(falsePositiveRate)) / (Math.LN2 * Math.LN2)
  );
}

/**
 * Calculate optimal number of hash functions for a Bloom filter.
 *
 * Formula: k = (m/n) * ln(2)
 * where:
 * - k = number of hash functions
 * - m = bit array size
 * - n = expected number of items
 *
 * @param bitArraySize - Size of the bit array
 * @param expectedItems - Expected number of items to insert
 * @returns Optimal number of hash functions
 */
function calculateNumHashFunctions(bitArraySize: number, expectedItems: number): number {
  return Math.ceil((bitArraySize / expectedItems) * Math.LN2);
}

/**
 * Creates a new empty Bloom filter with the specified parameters.
 *
 * @param hashFactory - Factory for creating hash functions
 * @param storageFactory - Factory for creating the backing storage
 * @param options - Configuration options (expectedItems, falsePositiveRate)
 * @returns A new empty BloomFilter
 * @throws Error if options are invalid
 *
 * @example
 * ```typescript
 * const filter = createBloomFilter(
 *   hashFactory,
 *   storageFactory,
 *   { expectedItems: 1000, falsePositiveRate: 0.01 }
 * );
 * ```
 */
export function createBloomFilter<T>(
  hashFactory: HashFunctionFactory<T>,
  storageFactory: BloomFilterStorageFactory,
  options: BloomFilterOptions
): BloomFilter<T> {
  const { expectedItems, falsePositiveRate } = options;

  if (expectedItems < 1 || !Number.isInteger(expectedItems)) {
    throw new Error(`expectedItems must be a positive integer, got: ${expectedItems}`);
  }

  if (falsePositiveRate <= 0 || falsePositiveRate >= 1) {
    throw new Error(
      `falsePositiveRate must be between 0 and 1 (exclusive), got: ${falsePositiveRate}`
    );
  }

  const bitArraySize = calculateBitArraySize(expectedItems, falsePositiveRate);
  const numHashFunctions = calculateNumHashFunctions(bitArraySize, expectedItems);

  return {
    bitArraySize,
    numHashFunctions,
    expectedItems,
    falsePositiveRate,
    itemCount: 0,
    storage: storageFactory.create(bitArraySize),
    hashFactory,
  };
}

// =============================================================================
// Pure Operations
// =============================================================================

/**
 * Add an item to the Bloom filter.
 *
 * This operation is idempotent - adding the same item multiple times
 * has the same effect as adding it once.
 *
 * @param filter - The Bloom filter
 * @param item - The item to add
 * @returns A new filter with the item added
 *
 * @example
 * ```typescript
 * const filter1 = createBloomFilter(hashFactory, storageFactory, options);
 * const filter2 = add(filter1, 'hello');
 * const filter3 = add(filter2, 'world');
 * console.log(mayContain(filter3, 'hello')); // true
 * ```
 */
export function add<T>(filter: BloomFilter<T>, item: T): BloomFilter<T> {
  const newStorage = filter.storage.clone();

  // Set bits for each hash function
  for (let i = 0; i < filter.numHashFunctions; i++) {
    const hashFn = filter.hashFactory.create(i);
    const hash = hashFn.hash(item);
    const index = Math.abs(hash) % filter.bitArraySize;
    newStorage.set(index);
  }

  return {
    ...filter,
    storage: newStorage,
    itemCount: filter.itemCount + 1,
  };
}

/**
 * Test if an item may be in the set.
 *
 * Returns:
 * - false: item is definitely NOT in the set (100% accurate)
 * - true: item is PROBABLY in the set (may be false positive)
 *
 * @param filter - The Bloom filter
 * @param item - The item to test
 * @returns True if item may be in set, false if definitely not
 *
 * @example
 * ```typescript
 * const result = mayContain(filter, 'hello');
 * if (!result) {
 *   console.log('Definitely not in set');
 * } else {
 *   console.log('Probably in set (or false positive)');
 * }
 * ```
 */
export function mayContain<T>(filter: BloomFilter<T>, item: T): boolean {
  // Check all hash positions - if any bit is 0, item is definitely not in set
  for (let i = 0; i < filter.numHashFunctions; i++) {
    const hashFn = filter.hashFactory.create(i);
    const hash = hashFn.hash(item);
    const index = Math.abs(hash) % filter.bitArraySize;

    if (!filter.storage.get(index)) {
      return false; // Definitely not in set
    }
  }

  return true; // Probably in set
}

/**
 * Create a new empty filter with the same configuration.
 *
 * @param filter - The Bloom filter to clear
 * @param storageFactory - Factory for creating new backing storage
 * @returns A new empty filter with the same configuration
 *
 * @example
 * ```typescript
 * const cleared = clear(filter, storageFactory);
 * console.log(cleared.itemCount); // 0
 * ```
 */
export function clear<T>(
  filter: BloomFilter<T>,
  storageFactory: BloomFilterStorageFactory
): BloomFilter<T> {
  return createBloomFilter(filter.hashFactory, storageFactory, {
    expectedItems: filter.expectedItems,
    falsePositiveRate: filter.falsePositiveRate,
  });
}

/**
 * Calculate the estimated current false positive rate based on items added.
 *
 * Formula: p ≈ (1 - e^(-kn/m))^k
 * where:
 * - p = false positive rate
 * - k = number of hash functions
 * - n = number of items inserted
 * - m = bit array size
 *
 * @param filter - The Bloom filter
 * @returns Estimated false positive rate (0 to 1)
 *
 * @example
 * ```typescript
 * const rate = estimatedFalsePositiveRate(filter);
 * console.log(`Current FP rate: ${(rate * 100).toFixed(2)}%`);
 * ```
 */
export function estimatedFalsePositiveRate<T>(filter: BloomFilter<T>): number {
  if (filter.itemCount === 0) {
    return 0;
  }

  const exponent = (-filter.numHashFunctions * filter.itemCount) / filter.bitArraySize;
  return Math.pow(1 - Math.exp(exponent), filter.numHashFunctions);
}

/**
 * Check if the filter is empty (no items added).
 *
 * @param filter - The Bloom filter
 * @returns True if no items have been added
 */
export function isEmpty<T>(filter: BloomFilter<T>): boolean {
  return filter.itemCount === 0;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a Bloom filter's internal consistency.
 *
 * @param filter - The Bloom filter to validate
 * @returns Validation result with any errors found
 *
 * @example
 * ```typescript
 * const result = validateBloomFilter(filter);
 * if (!result.valid) {
 *   console.error('Invalid filter:', result.errors);
 * }
 * ```
 */
export function validateBloomFilter<T>(filter: BloomFilter<T>): BloomFilterValidationResult {
  const errors: BloomFilterValidationError[] = [];

  // Check bit array size
  if (filter.bitArraySize < 1 || !Number.isInteger(filter.bitArraySize)) {
    errors.push({
      type: 'invalid_bit_array_size',
      details: `Bit array size must be a positive integer, got: ${filter.bitArraySize}`,
    });
  }

  // Check number of hash functions
  if (filter.numHashFunctions < 1 || !Number.isInteger(filter.numHashFunctions)) {
    errors.push({
      type: 'invalid_num_hash_functions',
      details: `Number of hash functions must be a positive integer, got: ${filter.numHashFunctions}`,
    });
  }

  // Check expected items
  if (filter.expectedItems < 1 || !Number.isInteger(filter.expectedItems)) {
    errors.push({
      type: 'invalid_expected_items',
      details: `Expected items must be a positive integer, got: ${filter.expectedItems}`,
    });
  }

  // Check false positive rate
  if (filter.falsePositiveRate <= 0 || filter.falsePositiveRate >= 1) {
    errors.push({
      type: 'invalid_false_positive_rate',
      details: `False positive rate must be between 0 and 1 (exclusive), got: ${filter.falsePositiveRate}`,
    });
  }

  // Check item count
  if (filter.itemCount < 0 || !Number.isInteger(filter.itemCount)) {
    errors.push({
      type: 'invalid_item_count',
      details: `Item count must be a non-negative integer, got: ${filter.itemCount}`,
    });
  }

  // Check storage size matches bit array size
  if (filter.storage.size() !== filter.bitArraySize) {
    errors.push({
      type: 'storage_size_mismatch',
      details: `Storage size ${filter.storage.size()} does not match bit array size ${filter.bitArraySize}`,
    });
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
 * Creates a boolean array-backed storage instance.
 *
 * @internal Used by createBooleanArrayStorageFactory
 */
function createBooleanArrayStorage(array: boolean[]): BloomFilterStorage {
  return {
    get(index: number): boolean {
      return array[index] ?? false;
    },
    set(index: number): void {
      array[index] = true;
    },
    clone(): BloomFilterStorage {
      return createBooleanArrayStorage([...array]);
    },
    size(): number {
      return array.length;
    },
  };
}

/**
 * Creates a storage factory that uses boolean arrays.
 *
 * This is a convenience helper for hosts that want simple array-backed storage.
 *
 * @returns A storage factory that creates boolean array-backed storage
 *
 * @example
 * ```typescript
 * const filter = createBloomFilter(
 *   hashFactory,
 *   createBooleanArrayStorageFactory(),
 *   { expectedItems: 1000, falsePositiveRate: 0.01 }
 * );
 * ```
 */
export function createBooleanArrayStorageFactory(): BloomFilterStorageFactory {
  return {
    create(size: number): BloomFilterStorage {
      return createBooleanArrayStorage(new Array(size).fill(false));
    },
  };
}

// =============================================================================
// Hash Function Factory Helpers
// =============================================================================

/**
 * Creates a simple hash function factory for strings using DJB2 and FNV-1a algorithms.
 *
 * This is a convenience helper for basic string hashing.
 * For production use, consider more sophisticated hash functions.
 *
 * Uses double hashing: hash_i(x) = hash1(x) + i * hash2(x)
 *
 * @returns A hash function factory for strings
 *
 * @example
 * ```typescript
 * const filter = createBloomFilter(
 *   createSimpleStringHashFactory(),
 *   storageFactory,
 *   { expectedItems: 1000, falsePositiveRate: 0.01 }
 * );
 * ```
 */
export function createSimpleStringHashFactory(): HashFunctionFactory<string> {
  // DJB2 hash
  const hash1 = (str: string): number => {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
    }
    return hash;
  };

  // FNV-1a hash
  const hash2 = (str: string): number => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = (hash * 16777619) >>> 0;
    }
    return hash;
  };

  return {
    create(seed: number): HashFunction<string> {
      return {
        hash(item: string): number {
          // Double hashing: hash_i(x) = hash1(x) + i * hash2(x)
          return (hash1(item) + seed * hash2(item)) >>> 0;
        },
      };
    },
  };
}
