import type { HashFunctionFactory } from '@conveaux/contract-bloom-filter';
import { describe, expect, it } from 'vitest';
import {
  add,
  clear,
  createBloomFilter,
  createBooleanArrayStorageFactory,
  createSimpleStringHashFactory,
  estimatedFalsePositiveRate,
  isEmpty,
  mayContain,
  validateBloomFilter,
} from './index';

describe('createBloomFilter', () => {
  const hashFactory = createSimpleStringHashFactory();
  const storageFactory = createBooleanArrayStorageFactory();

  describe('creation', () => {
    it('creates a filter with correct parameters', () => {
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 1000,
        falsePositiveRate: 0.01,
      });

      expect(filter.expectedItems).toBe(1000);
      expect(filter.falsePositiveRate).toBe(0.01);
      expect(filter.itemCount).toBe(0);
      expect(filter.bitArraySize).toBeGreaterThan(0);
      expect(filter.numHashFunctions).toBeGreaterThan(0);
      expect(isEmpty(filter)).toBe(true);
    });

    it('calculates optimal bit array size', () => {
      // For 1000 items and 1% FP rate, optimal size is ~9586 bits
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 1000,
        falsePositiveRate: 0.01,
      });

      expect(filter.bitArraySize).toBeGreaterThan(9000);
      expect(filter.bitArraySize).toBeLessThan(10000);
    });

    it('calculates optimal number of hash functions', () => {
      // For 1000 items and 1% FP rate, optimal k is ~7
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 1000,
        falsePositiveRate: 0.01,
      });

      expect(filter.numHashFunctions).toBeGreaterThanOrEqual(6);
      expect(filter.numHashFunctions).toBeLessThanOrEqual(8);
    });

    it('throws for non-positive expectedItems', () => {
      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: 0,
          falsePositiveRate: 0.01,
        })
      ).toThrow('expectedItems must be a positive integer, got: 0');

      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: -1,
          falsePositiveRate: 0.01,
        })
      ).toThrow('expectedItems must be a positive integer, got: -1');
    });

    it('throws for non-integer expectedItems', () => {
      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: 100.5,
          falsePositiveRate: 0.01,
        })
      ).toThrow('expectedItems must be a positive integer, got: 100.5');
    });

    it('throws for invalid falsePositiveRate', () => {
      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: 1000,
          falsePositiveRate: 0,
        })
      ).toThrow('falsePositiveRate must be between 0 and 1 (exclusive), got: 0');

      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: 1000,
          falsePositiveRate: 1,
        })
      ).toThrow('falsePositiveRate must be between 0 and 1 (exclusive), got: 1');

      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: 1000,
          falsePositiveRate: 1.5,
        })
      ).toThrow('falsePositiveRate must be between 0 and 1 (exclusive), got: 1.5');

      expect(() =>
        createBloomFilter(hashFactory, storageFactory, {
          expectedItems: 1000,
          falsePositiveRate: -0.01,
        })
      ).toThrow('falsePositiveRate must be between 0 and 1 (exclusive), got: -0.01');
    });
  });

  describe('add', () => {
    it('adds items to the filter immutably', () => {
      const filter0 = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      const filter1 = add(filter0, 'hello');

      // Original unchanged
      expect(filter0.itemCount).toBe(0);
      expect(isEmpty(filter0)).toBe(true);

      // New filter has item
      expect(filter1.itemCount).toBe(1);
      expect(isEmpty(filter1)).toBe(false);

      const filter2 = add(filter1, 'world');
      expect(filter2.itemCount).toBe(2);
    });

    it('sets multiple bits for each item', () => {
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      const updated = add(filter, 'test');

      // Check that multiple bits were set (via mayContain)
      expect(mayContain(updated, 'test')).toBe(true);
    });

    it('is idempotent - adding same item multiple times', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'duplicate');
      filter = add(filter, 'duplicate');
      filter = add(filter, 'duplicate');

      // Item count increases each time (implementation choice)
      expect(filter.itemCount).toBe(3);
      expect(mayContain(filter, 'duplicate')).toBe(true);
    });
  });

  describe('mayContain', () => {
    it('returns false for items not in empty filter', () => {
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      expect(mayContain(filter, 'nothere')).toBe(false);
    });

    it('returns true for items that were added', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'hello');
      filter = add(filter, 'world');
      filter = add(filter, 'test');

      expect(mayContain(filter, 'hello')).toBe(true);
      expect(mayContain(filter, 'world')).toBe(true);
      expect(mayContain(filter, 'test')).toBe(true);
    });

    it('returns false for items definitely not in set', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'apple');
      filter = add(filter, 'banana');

      expect(mayContain(filter, 'orange')).toBe(false);
      expect(mayContain(filter, 'grape')).toBe(false);
    });

    it('may have false positives but no false negatives', () => {
      // With very low capacity, we can observe false positives
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 10,
        falsePositiveRate: 0.5, // High FP rate
      });

      const addedItems = ['a', 'b', 'c', 'd', 'e'];
      for (const item of addedItems) {
        filter = add(filter, item);
      }

      // All added items must return true (no false negatives)
      for (const item of addedItems) {
        expect(mayContain(filter, item)).toBe(true);
      }

      // Some non-added items might return true (false positives are allowed)
      // We can't deterministically test this, but the implementation allows it
    });

    it('does not modify filter state', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'test');
      const itemCountBefore = filter.itemCount;

      mayContain(filter, 'test');
      mayContain(filter, 'other');

      expect(filter.itemCount).toBe(itemCountBefore);
    });
  });

  describe('clear', () => {
    it('creates new empty filter with same configuration', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'a');
      filter = add(filter, 'b');
      filter = add(filter, 'c');

      const cleared = clear(filter, storageFactory);

      // New filter is empty
      expect(cleared.itemCount).toBe(0);
      expect(isEmpty(cleared)).toBe(true);
      expect(mayContain(cleared, 'a')).toBe(false);

      // Configuration preserved
      expect(cleared.expectedItems).toBe(filter.expectedItems);
      expect(cleared.falsePositiveRate).toBe(filter.falsePositiveRate);
      expect(cleared.bitArraySize).toBe(filter.bitArraySize);
      expect(cleared.numHashFunctions).toBe(filter.numHashFunctions);

      // Original unchanged
      expect(filter.itemCount).toBe(3);
      expect(mayContain(filter, 'a')).toBe(true);
    });

    it('allows adding items after clear', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'old');
      let cleared = clear(filter, storageFactory);
      cleared = add(cleared, 'new');

      expect(mayContain(cleared, 'new')).toBe(true);
      expect(mayContain(cleared, 'old')).toBe(false);
      expect(cleared.itemCount).toBe(1);
    });
  });

  describe('estimatedFalsePositiveRate', () => {
    it('returns 0 for empty filter', () => {
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      expect(estimatedFalsePositiveRate(filter)).toBe(0);
    });

    it('returns low rate when under capacity', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 1000,
        falsePositiveRate: 0.01,
      });

      // Add 100 items (10% of capacity)
      for (let i = 0; i < 100; i++) {
        filter = add(filter, `item${i}`);
      }

      const rate = estimatedFalsePositiveRate(filter);
      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThan(0.01); // Should be well below target
    });

    it('returns higher rate when at expected capacity', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      // Add expected number of items
      for (let i = 0; i < 100; i++) {
        filter = add(filter, `item${i}`);
      }

      const rate = estimatedFalsePositiveRate(filter);
      expect(rate).toBeGreaterThan(0.005);
      expect(rate).toBeLessThan(0.02); // Should be close to target 0.01
    });

    it('returns increasing rate as more items are added', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      const rates: number[] = [];
      let itemsAdded = 0;

      // Test at 0, 50, 100, 150, 200 items
      for (const targetCount of [0, 50, 100, 150, 200]) {
        while (itemsAdded < targetCount) {
          filter = add(filter, `item${itemsAdded}`);
          itemsAdded++;
        }
        rates.push(estimatedFalsePositiveRate(filter));
      }

      // Rates should generally increase
      expect(rates).toHaveLength(5);
      expect(rates[0]).toBe(0); // Empty
      expect(rates[1]).toBeGreaterThan(0); // 50 items
      expect(rates[2]!).toBeGreaterThan(rates[1]!); // 100 items
      expect(rates[3]!).toBeGreaterThan(rates[2]!); // 150 items
      expect(rates[4]!).toBeGreaterThan(rates[3]!); // 200 items
    });
  });

  describe('isEmpty', () => {
    it('returns true for newly created filter', () => {
      const filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      expect(isEmpty(filter)).toBe(true);
    });

    it('returns false after adding items', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'test');
      expect(isEmpty(filter)).toBe(false);
    });

    it('returns true after clear', () => {
      let filter = createBloomFilter(hashFactory, storageFactory, {
        expectedItems: 100,
        falsePositiveRate: 0.01,
      });

      filter = add(filter, 'test');
      const cleared = clear(filter, storageFactory);

      expect(isEmpty(cleared)).toBe(true);
    });
  });
});

describe('validateBloomFilter', () => {
  const hashFactory = createSimpleStringHashFactory();
  const storageFactory = createBooleanArrayStorageFactory();

  it('validates a correct filter', () => {
    let filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    filter = add(filter, 'test');

    const result = validateBloomFilter(filter);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid bit array size', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const invalidFilter = { ...filter, bitArraySize: 0 };
    const result = validateBloomFilter(invalidFilter);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_bit_array_size');
  });

  it('detects invalid number of hash functions', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const invalidFilter = { ...filter, numHashFunctions: 0 };
    const result = validateBloomFilter(invalidFilter);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_num_hash_functions');
  });

  it('detects invalid expected items', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const invalidFilter = { ...filter, expectedItems: -1 };
    const result = validateBloomFilter(invalidFilter);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_expected_items');
  });

  it('detects invalid false positive rate', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const invalidFilter1 = { ...filter, falsePositiveRate: 0 };
    const result1 = validateBloomFilter(invalidFilter1);
    expect(result1.valid).toBe(false);
    expect(result1.errors[0]?.type).toBe('invalid_false_positive_rate');

    const invalidFilter2 = { ...filter, falsePositiveRate: 1 };
    const result2 = validateBloomFilter(invalidFilter2);
    expect(result2.valid).toBe(false);
    expect(result2.errors[0]?.type).toBe('invalid_false_positive_rate');
  });

  it('detects invalid item count', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const invalidFilter = { ...filter, itemCount: -1 };
    const result = validateBloomFilter(invalidFilter);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_item_count');
  });

  it('detects storage size mismatch', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    // Create filter with mismatched storage
    const invalidFilter = {
      ...filter,
      bitArraySize: filter.bitArraySize + 100,
    };

    const result = validateBloomFilter(invalidFilter);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('storage_size_mismatch');
  });

  it('detects multiple errors', () => {
    const filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const invalidFilter = {
      ...filter,
      bitArraySize: 0,
      numHashFunctions: -1,
      itemCount: -1,
    };

    const result = validateBloomFilter(invalidFilter);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('createBooleanArrayStorageFactory', () => {
  it('creates storage with all bits initialized to false', () => {
    const factory = createBooleanArrayStorageFactory();
    const storage = factory.create(10);

    expect(storage.size()).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(storage.get(i)).toBe(false);
    }
  });

  it('sets bits to true', () => {
    const factory = createBooleanArrayStorageFactory();
    const storage = factory.create(5);

    storage.set(0);
    storage.set(2);
    storage.set(4);

    expect(storage.get(0)).toBe(true);
    expect(storage.get(1)).toBe(false);
    expect(storage.get(2)).toBe(true);
    expect(storage.get(3)).toBe(false);
    expect(storage.get(4)).toBe(true);
  });

  it('setting bit multiple times is idempotent', () => {
    const factory = createBooleanArrayStorageFactory();
    const storage = factory.create(3);

    storage.set(1);
    storage.set(1);
    storage.set(1);

    expect(storage.get(1)).toBe(true);
  });

  it('clone creates independent copy', () => {
    const factory = createBooleanArrayStorageFactory();
    const storage = factory.create(5);

    storage.set(0);
    storage.set(2);

    const cloned = storage.clone();
    cloned.set(1);
    cloned.set(3);

    // Original unchanged
    expect(storage.get(0)).toBe(true);
    expect(storage.get(1)).toBe(false);
    expect(storage.get(2)).toBe(true);
    expect(storage.get(3)).toBe(false);

    // Clone modified
    expect(cloned.get(0)).toBe(true);
    expect(cloned.get(1)).toBe(true);
    expect(cloned.get(2)).toBe(true);
    expect(cloned.get(3)).toBe(true);
  });

  it('returns false for out of bounds indices', () => {
    const factory = createBooleanArrayStorageFactory();
    const storage = factory.create(5);

    expect(storage.get(10)).toBe(false);
    expect(storage.get(-1)).toBe(false);
  });
});

describe('createSimpleStringHashFactory', () => {
  it('creates hash functions', () => {
    const factory = createSimpleStringHashFactory();
    const hash0 = factory.create(0);
    const hash1 = factory.create(1);

    expect(hash0.hash('test')).toBeTypeOf('number');
    expect(hash1.hash('test')).toBeTypeOf('number');
  });

  it('different seeds produce different hashes', () => {
    const factory = createSimpleStringHashFactory();
    const hash0 = factory.create(0);
    const hash1 = factory.create(1);
    const hash2 = factory.create(2);

    const str = 'hello';
    const h0 = hash0.hash(str);
    const h1 = hash1.hash(str);
    const h2 = hash2.hash(str);

    expect(h0).not.toBe(h1);
    expect(h1).not.toBe(h2);
    expect(h0).not.toBe(h2);
  });

  it('same seed produces consistent hashes', () => {
    const factory = createSimpleStringHashFactory();
    const hash1 = factory.create(5);
    const hash2 = factory.create(5);

    const str = 'consistent';
    expect(hash1.hash(str)).toBe(hash2.hash(str));
  });

  it('different strings produce different hashes', () => {
    const factory = createSimpleStringHashFactory();
    const hash = factory.create(0);

    const h1 = hash.hash('apple');
    const h2 = hash.hash('banana');
    const h3 = hash.hash('cherry');

    expect(h1).not.toBe(h2);
    expect(h2).not.toBe(h3);
    expect(h1).not.toBe(h3);
  });

  it('produces non-negative hash values', () => {
    const factory = createSimpleStringHashFactory();
    const hash = factory.create(0);

    const testStrings = ['a', 'test', 'hello world', '12345', '!@#$%'];
    for (const str of testStrings) {
      const h = hash.hash(str);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('immutability', () => {
  const hashFactory = createSimpleStringHashFactory();
  const storageFactory = createBooleanArrayStorageFactory();

  it('add does not modify original filter', () => {
    const original = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const added = add(original, 'test');

    expect(original.itemCount).toBe(0);
    expect(added.itemCount).toBe(1);
    expect(mayContain(original, 'test')).toBe(false);
    expect(mayContain(added, 'test')).toBe(true);
  });

  it('supports time-travel debugging pattern', () => {
    const history: ReturnType<typeof createBloomFilter<string>>[] = [];

    let filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });
    history.push(filter);

    filter = add(filter, 'a');
    history.push(filter);

    filter = add(filter, 'b');
    history.push(filter);

    filter = add(filter, 'c');
    history.push(filter);

    // Can inspect any previous state
    expect(history[0]!.itemCount).toBe(0);
    expect(history[1]!.itemCount).toBe(1);
    expect(history[2]!.itemCount).toBe(2);
    expect(history[3]!.itemCount).toBe(3);

    expect(mayContain(history[0]!, 'a')).toBe(false);
    expect(mayContain(history[1]!, 'a')).toBe(true);
    expect(mayContain(history[1]!, 'b')).toBe(false);
    expect(mayContain(history[2]!, 'b')).toBe(true);
  });
});

describe('complex scenarios', () => {
  const hashFactory = createSimpleStringHashFactory();
  const storageFactory = createBooleanArrayStorageFactory();

  it('handles large number of items', () => {
    let filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 10000,
      falsePositiveRate: 0.001,
    });

    const items: string[] = [];
    for (let i = 0; i < 10000; i++) {
      const item = `item${i}`;
      items.push(item);
      filter = add(filter, item);
    }

    // All added items should be found (no false negatives)
    for (const item of items) {
      expect(mayContain(filter, item)).toBe(true);
    }

    expect(filter.itemCount).toBe(10000);
  });

  it('works with different string types', () => {
    let filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    const testStrings = [
      'simple',
      'with spaces',
      'with-dashes',
      'with_underscores',
      'UPPERCASE',
      'MixedCase',
      '12345',
      'special!@#$%',
      'unicode-émojis-🎉',
      '',
    ];

    for (const str of testStrings) {
      filter = add(filter, str);
    }

    for (const str of testStrings) {
      expect(mayContain(filter, str)).toBe(true);
    }
  });

  it('maintains accuracy with multiple add/check cycles', () => {
    let filter = createBloomFilter(hashFactory, storageFactory, {
      expectedItems: 1000,
      falsePositiveRate: 0.01,
    });

    for (let cycle = 0; cycle < 10; cycle++) {
      const cycleItems: string[] = [];

      // Add items for this cycle
      for (let i = 0; i < 100; i++) {
        const item = `cycle${cycle}-item${i}`;
        cycleItems.push(item);
        filter = add(filter, item);
      }

      // Verify all items from this cycle are found
      for (const item of cycleItems) {
        expect(mayContain(filter, item)).toBe(true);
      }
    }

    expect(filter.itemCount).toBe(1000);
    const fpRate = estimatedFalsePositiveRate(filter);
    expect(fpRate).toBeLessThan(0.02); // Should be close to target
  });
});

describe('custom hash function factory', () => {
  it('allows injection of custom hash implementation', () => {
    const storageFactory = createBooleanArrayStorageFactory();

    // Simple custom hash factory that just uses char codes
    const customHashFactory: HashFunctionFactory<string> = {
      create(seed: number) {
        return {
          hash(item: string): number {
            let h = seed;
            for (let i = 0; i < item.length; i++) {
              h = (h * 31 + item.charCodeAt(i)) >>> 0;
            }
            return h;
          },
        };
      },
    };

    let filter = createBloomFilter(customHashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    filter = add(filter, 'custom');
    expect(mayContain(filter, 'custom')).toBe(true);
    expect(mayContain(filter, 'other')).toBe(false);
  });

  it('works with numeric hash factory', () => {
    const storageFactory = createBooleanArrayStorageFactory();

    // Hash factory for numbers
    const numberHashFactory: HashFunctionFactory<number> = {
      create(seed: number) {
        return {
          hash(item: number): number {
            // Simple number hash using seed
            return (item * 2654435761 + seed) >>> 0;
          },
        };
      },
    };

    let filter = createBloomFilter(numberHashFactory, storageFactory, {
      expectedItems: 100,
      falsePositiveRate: 0.01,
    });

    filter = add(filter, 42);
    filter = add(filter, 123);
    filter = add(filter, 999);

    expect(mayContain(filter, 42)).toBe(true);
    expect(mayContain(filter, 123)).toBe(true);
    expect(mayContain(filter, 999)).toBe(true);
    expect(mayContain(filter, 1000)).toBe(false);
  });
});
