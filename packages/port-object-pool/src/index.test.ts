import type { ObjectFactory, ObjectPool, ObjectValidator } from '@conveaux/contract-object-pool';
import { describe, expect, it } from 'vitest';
import {
  acquire,
  available,
  createObjectPool,
  drain,
  inUse,
  release,
  size,
  validateObjectPool,
} from './index';

// Test helpers
interface TestObject {
  readonly id: number;
  readonly valid: boolean;
}

function createTestFactory(): ObjectFactory<TestObject> {
  let counter = 0;
  return {
    async create() {
      return { id: counter++, valid: true };
    },
  };
}

function createTestValidator(): ObjectValidator<TestObject> {
  return {
    async validate(obj: TestObject) {
      return obj.valid;
    },
  };
}

describe('createObjectPool', () => {
  describe('creation', () => {
    it('creates a pool with minSize objects', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 3, maxSize: 5 });

      expect(size(pool)).toBe(3);
      expect(available(pool)).toBe(3);
      expect(inUse(pool)).toBe(0);
    });

    it('creates an empty pool when minSize is 0', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 0, maxSize: 5 });

      expect(size(pool)).toBe(0);
      expect(available(pool)).toBe(0);
      expect(inUse(pool)).toBe(0);
    });

    it('stores the factory and validator', async () => {
      const factory = createTestFactory();
      const validator = createTestValidator();
      const pool = await createObjectPool(factory, { minSize: 1, maxSize: 5 }, validator);

      expect(pool.factory).toBe(factory);
      expect(pool.validator).toBe(validator);
    });

    it('throws for invalid minSize', async () => {
      const factory = createTestFactory();

      await expect(createObjectPool(factory, { minSize: -1, maxSize: 5 })).rejects.toThrow(
        'minSize must be a non-negative integer, got: -1'
      );

      await expect(createObjectPool(factory, { minSize: 2.5, maxSize: 5 })).rejects.toThrow(
        'minSize must be a non-negative integer, got: 2.5'
      );
    });

    it('throws for invalid maxSize', async () => {
      const factory = createTestFactory();

      await expect(createObjectPool(factory, { minSize: 0, maxSize: 0 })).rejects.toThrow(
        'maxSize must be a positive integer, got: 0'
      );

      await expect(createObjectPool(factory, { minSize: 0, maxSize: -1 })).rejects.toThrow(
        'maxSize must be a positive integer, got: -1'
      );

      await expect(createObjectPool(factory, { minSize: 0, maxSize: 3.5 })).rejects.toThrow(
        'maxSize must be a positive integer, got: 3.5'
      );
    });

    it('throws when minSize > maxSize', async () => {
      const factory = createTestFactory();

      await expect(createObjectPool(factory, { minSize: 10, maxSize: 5 })).rejects.toThrow(
        'minSize (10) cannot be greater than maxSize (5)'
      );
    });
  });

  describe('acquire', () => {
    it('acquires an available object', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const { item, pool: newPool } = await acquire(pool);

      expect(item).toBeDefined();
      expect(item.id).toBe(0); // First object created
      expect(available(newPool)).toBe(1);
      expect(inUse(newPool)).toBe(1);

      // Original pool unchanged
      expect(available(pool)).toBe(2);
      expect(inUse(pool)).toBe(0);
    });

    it('creates new object when pool is empty but under maxSize', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 0, maxSize: 5 });

      expect(size(pool)).toBe(0);

      const { item, pool: newPool } = await acquire(pool);

      expect(item).toBeDefined();
      expect(size(newPool)).toBe(1);
      expect(available(newPool)).toBe(0);
      expect(inUse(newPool)).toBe(1);
    });

    it('throws when pool is exhausted (no available objects)', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 2 });

      // Acquire both objects
      const result1 = await acquire(pool);
      const result2 = await acquire(result1.pool);

      expect(inUse(result2.pool)).toBe(2);
      expect(available(result2.pool)).toBe(0);

      // Try to acquire when all are in use
      await expect(acquire(result2.pool)).rejects.toThrow(
        'Pool exhausted: all 2 objects are in use and no valid objects are available'
      );
    });

    it('creates new object when available is empty but under maxSize', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 1, maxSize: 3 });

      // Clear available to force creation
      const emptyPool = {
        ...pool,
        available: [],
        inUse: [],
        factory: pool.factory,
        minSize: pool.minSize,
        maxSize: pool.maxSize,
      };

      const { item, pool: newPool } = await acquire(emptyPool);

      expect(item).toBeDefined();
      expect(size(newPool)).toBe(1); // 0 initial + 1 new created
      expect(inUse(newPool)).toBe(1);
      expect(available(newPool)).toBe(0);
    });

    it('validates objects before reuse', async () => {
      const factory: ObjectFactory<TestObject> = {
        async create() {
          return { id: Math.random(), valid: true };
        },
      };

      const validator = createTestValidator();

      // Create pool with one invalid object
      const pool = await createObjectPool(factory, { minSize: 0, maxSize: 3 }, validator);

      const invalidObj: TestObject = { id: 999, valid: false };
      const poolWithInvalid = {
        ...pool,
        available: [invalidObj],
      };

      // Should skip invalid and create new
      const { item, pool: newPool } = await acquire(poolWithInvalid);

      expect(item.valid).toBe(true);
      expect(item.id).not.toBe(999);
      expect(size(newPool)).toBe(2); // Invalid one still in available + new in inUse
    });

    it('sequential acquires return different objects', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 3, maxSize: 5 });

      const result1 = await acquire(pool);
      const result2 = await acquire(result1.pool);
      const result3 = await acquire(result2.pool);

      expect(result1.item.id).toBe(0);
      expect(result2.item.id).toBe(1);
      expect(result3.item.id).toBe(2);
      expect(inUse(result3.pool)).toBe(3);
    });

    it('throws when all available objects are invalid and pool is at maxSize (equal)', async () => {
      const factory = createTestFactory();
      const validator = createTestValidator();

      // Create pool at max capacity with validator
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 2 }, validator);

      // Acquire one object to get 1 in use, 1 available
      const r1 = await acquire(pool);
      expect(inUse(r1.pool)).toBe(1);
      expect(available(r1.pool)).toBe(1);

      // Replace the available object with an invalid one
      const invalidObj: TestObject = { id: 999, valid: false };
      const poolWithInvalid: ObjectPool<TestObject> = {
        available: [invalidObj], // 1 invalid object
        inUse: [...r1.pool.inUse], // 1 valid object in use
        minSize: r1.pool.minSize,
        maxSize: r1.pool.maxSize,
        factory: r1.pool.factory,
        validator: r1.pool.validator,
      };

      // totalSize = 1 (invalid available) + 1 (inUse) = 2 = maxSize
      // Validator will reject the invalid object, so loop completes without finding valid object
      // Then totalSize >= maxSize (2 >= 2), so false branch is taken and error is thrown
      await expect(acquire(poolWithInvalid)).rejects.toThrow(
        'Pool exhausted: all 2 objects are in use and no valid objects are available'
      );
    });

    it('throws when all available objects are invalid and pool exceeds maxSize', async () => {
      const factory = createTestFactory();
      const validator = createTestValidator();

      // Manually create a pool in invalid state (totalSize > maxSize) for coverage
      const invalidObj1: TestObject = { id: 998, valid: false };
      const invalidObj2: TestObject = { id: 999, valid: false };
      const validObj: TestObject = { id: 1, valid: true };

      const poolOverMax: ObjectPool<TestObject> = {
        available: [invalidObj1, invalidObj2], // 2 invalid objects
        inUse: [validObj], // 1 valid object in use
        minSize: 1,
        maxSize: 2, // totalSize = 3 > maxSize = 2
        factory,
        validator,
      };

      // Both available objects are invalid, totalSize (3) > maxSize (2)
      // Should throw when trying to acquire
      await expect(acquire(poolOverMax)).rejects.toThrow(
        'Pool exhausted: all 2 objects are in use and no valid objects are available'
      );
    });
  });

  describe('release', () => {
    it('releases an object back to available', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const { item, pool: afterAcquire } = await acquire(pool);

      expect(inUse(afterAcquire)).toBe(1);
      expect(available(afterAcquire)).toBe(1);

      const afterRelease = release(afterAcquire, item);

      expect(inUse(afterRelease)).toBe(0);
      expect(available(afterRelease)).toBe(2);
    });

    it('throws when releasing object not in use', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 1, maxSize: 5 });

      const fakeObject: TestObject = { id: 999, valid: true };

      expect(() => release(pool, fakeObject)).toThrow('Cannot release object that is not in use');
    });

    it('allows object to be reacquired after release', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 1, maxSize: 5 });

      const result1 = await acquire(pool);
      const firstId = result1.item.id;

      const afterRelease = release(result1.pool, result1.item);
      const result2 = await acquire(afterRelease);

      expect(result2.item.id).toBe(firstId); // Same object
      expect(inUse(result2.pool)).toBe(1);
    });

    it('does not modify original pool', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const { item, pool: afterAcquire } = await acquire(pool);
      const afterRelease = release(afterAcquire, item);

      // afterAcquire unchanged
      expect(inUse(afterAcquire)).toBe(1);
      expect(available(afterAcquire)).toBe(1);

      // afterRelease has changes
      expect(inUse(afterRelease)).toBe(0);
      expect(available(afterRelease)).toBe(2);
    });
  });

  describe('size helpers', () => {
    it('size returns total objects', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 3, maxSize: 5 });

      expect(size(pool)).toBe(3);

      const result = await acquire(pool);
      expect(size(result.pool)).toBe(3);

      const result2 = await acquire(result.pool);
      const result3 = await acquire(result2.pool);
      expect(size(result3.pool)).toBe(3);

      // Create new when acquiring beyond initial
      const result4 = await acquire(result3.pool);
      expect(size(result4.pool)).toBe(4);
    });

    it('available returns count of available objects', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 3, maxSize: 5 });

      expect(available(pool)).toBe(3);

      const result = await acquire(pool);
      expect(available(result.pool)).toBe(2);

      const afterRelease = release(result.pool, result.item);
      expect(available(afterRelease)).toBe(3);
    });

    it('inUse returns count of in-use objects', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      expect(inUse(pool)).toBe(0);

      const result1 = await acquire(pool);
      expect(inUse(result1.pool)).toBe(1);

      const result2 = await acquire(result1.pool);
      expect(inUse(result2.pool)).toBe(2);

      const afterRelease = release(result2.pool, result1.item);
      expect(inUse(afterRelease)).toBe(1);
    });
  });

  describe('drain', () => {
    it('removes invalid objects and replenishes to minSize', async () => {
      const factory = createTestFactory();
      const validator = createTestValidator();

      const pool = await createObjectPool(factory, { minSize: 3, maxSize: 5 }, validator);

      // Manually add invalid objects
      const invalidObj1: TestObject = { id: 901, valid: false };
      const invalidObj2: TestObject = { id: 902, valid: false };

      const poolWithInvalid = {
        ...pool,
        available: [...pool.available, invalidObj1, invalidObj2],
      };

      expect(available(poolWithInvalid)).toBe(5);

      const drained = await drain(poolWithInvalid);

      // Should have 3 valid available (original) after removing 2 invalid
      expect(available(drained)).toBe(3);
      expect(drained.available.every((obj) => obj.valid)).toBe(true);
    });

    it('creates new objects to reach minSize if needed', async () => {
      const factory = createTestFactory();
      const validator = createTestValidator();

      const pool = await createObjectPool(factory, { minSize: 5, maxSize: 10 }, validator);

      // Move some to inUse
      const result1 = await acquire(pool);
      const result2 = await acquire(result1.pool);

      expect(available(result2.pool)).toBe(3);
      expect(inUse(result2.pool)).toBe(2);

      // Add invalid objects
      const invalidObj: TestObject = { id: 999, valid: false };
      const poolWithInvalid = {
        ...result2.pool,
        available: [...result2.pool.available.slice(0, 2), invalidObj],
      };

      expect(available(poolWithInvalid)).toBe(3); // 2 valid + 1 invalid

      const drained = await drain(poolWithInvalid);

      // Should have 5 total (minSize) - 2 in use = 3 available
      // But we only had 2 valid, so should create 1 more
      expect(available(drained)).toBe(3);
      expect(inUse(drained)).toBe(2);
      expect(size(drained)).toBe(5);
    });

    it('works without validator', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 3, maxSize: 5 });

      const drained = await drain(pool);

      expect(available(drained)).toBe(3);
      expect(size(drained)).toBe(3);
    });

    it('does not remove objects in use', async () => {
      const factory = createTestFactory();
      const validator = createTestValidator();

      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 }, validator);

      const result1 = await acquire(pool);
      const result2 = await acquire(result1.pool);

      expect(inUse(result2.pool)).toBe(2);
      expect(available(result2.pool)).toBe(0);

      const drained = await drain(result2.pool);

      // Should still have 2 in use, and 0 available (since minSize=2 and we have 2 total)
      expect(inUse(drained)).toBe(2);
      expect(available(drained)).toBe(0);
      expect(size(drained)).toBe(2);
    });
  });

  describe('validateObjectPool', () => {
    it('validates a correct pool', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const result = validateObjectPool(pool);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects invalid minSize', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 0, maxSize: 5 });

      const invalidPool = { ...pool, minSize: -1 };
      const result = validateObjectPool(invalidPool);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('invalid_size_config');
    });

    it('detects invalid maxSize', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 0, maxSize: 5 });

      const invalidPool = { ...pool, maxSize: 0 };
      const result = validateObjectPool(invalidPool);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('invalid_size_config');
    });

    it('detects minSize > maxSize', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const invalidPool = { ...pool, minSize: 10 };
      const result = validateObjectPool(invalidPool);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('invalid_size_config');
    });

    it('detects size constraint violation', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 3 });

      // Manually create invalid state
      const invalidPool = {
        ...pool,
        available: [
          { id: 1, valid: true },
          { id: 2, valid: true },
          { id: 3, valid: true },
          { id: 4, valid: true },
        ],
      };

      const result = validateObjectPool(invalidPool);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('size_constraint_violation');
    });

    it('detects duplicate objects', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const duplicate: TestObject = { id: 999, valid: true };

      const invalidPool = {
        ...pool,
        available: [duplicate],
        inUse: [duplicate],
      };

      const result = validateObjectPool(invalidPool);

      expect(result.valid).toBe(false);
      expect(result.errors[0]?.type).toBe('duplicate_object');
    });
  });

  describe('immutability', () => {
    it('acquire does not modify original pool', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const originalAvailable = available(pool);
      const originalInUse = inUse(pool);

      await acquire(pool);

      expect(available(pool)).toBe(originalAvailable);
      expect(inUse(pool)).toBe(originalInUse);
    });

    it('release does not modify original pool', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const { item, pool: afterAcquire } = await acquire(pool);
      const originalAvailable = available(afterAcquire);
      const originalInUse = inUse(afterAcquire);

      release(afterAcquire, item);

      expect(available(afterAcquire)).toBe(originalAvailable);
      expect(inUse(afterAcquire)).toBe(originalInUse);
    });

    it('drain does not modify original pool', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 5 });

      const originalAvailable = available(pool);

      await drain(pool);

      expect(available(pool)).toBe(originalAvailable);
    });
  });

  describe('complex scenarios', () => {
    it('handles multiple acquire and release cycles', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 4 });

      // Acquire all initial objects
      const r1 = await acquire(pool);
      const r2 = await acquire(r1.pool);

      expect(inUse(r2.pool)).toBe(2);
      expect(available(r2.pool)).toBe(0);

      // Release one
      const afterRelease1 = release(r2.pool, r1.item);
      expect(available(afterRelease1)).toBe(1);

      // Acquire two more (one reused, one created)
      const r3 = await acquire(afterRelease1);
      const r4 = await acquire(r3.pool);

      expect(r3.item.id).toBe(0); // Reused
      expect(r4.item.id).toBe(2); // New
      expect(inUse(r4.pool)).toBe(3);
      expect(available(r4.pool)).toBe(0);
    });

    it('works with minSize = maxSize', async () => {
      const factory = createTestFactory();
      const pool = await createObjectPool(factory, { minSize: 2, maxSize: 2 });

      expect(size(pool)).toBe(2);

      const r1 = await acquire(pool);
      const r2 = await acquire(r1.pool);

      expect(inUse(r2.pool)).toBe(2);

      // Should throw when trying to acquire more
      await expect(acquire(r2.pool)).rejects.toThrow('Pool exhausted');

      // Release and reacquire
      const afterRelease = release(r2.pool, r1.item);
      const r3 = await acquire(afterRelease);

      expect(r3.item.id).toBe(r1.item.id); // Same object
    });

    it('handles validator rejecting all objects', async () => {
      const factory = createTestFactory();
      const alwaysInvalidValidator: ObjectValidator<TestObject> = {
        async validate() {
          return false;
        },
      };

      const pool = await createObjectPool(
        factory,
        { minSize: 2, maxSize: 3 },
        alwaysInvalidValidator
      );

      // All initial objects are invalid, should create new one
      const { item, pool: newPool } = await acquire(pool);

      expect(item).toBeDefined();
      expect(size(newPool)).toBe(3); // 2 invalid + 1 new
      expect(inUse(newPool)).toBe(1);
    });

    it('works with async factory', async () => {
      const asyncFactory: ObjectFactory<TestObject> = {
        async create() {
          // Simulate async operation
          await new Promise((resolve) => setTimeout(resolve, 1));
          return { id: Math.random(), valid: true };
        },
      };

      const pool = await createObjectPool(asyncFactory, { minSize: 2, maxSize: 5 });

      expect(size(pool)).toBe(2);

      const { item } = await acquire(pool);
      expect(item).toBeDefined();
      expect(item.valid).toBe(true);
    });

    it('handles complex object types', async () => {
      interface Connection {
        readonly id: string;
        readonly host: string;
        readonly connected: boolean;
      }

      const connectionFactory: ObjectFactory<Connection> = {
        async create() {
          return {
            id: `conn-${Math.random()}`,
            host: 'localhost',
            connected: true,
          };
        },
      };

      const validator: ObjectValidator<Connection> = {
        async validate(conn) {
          return conn.connected;
        },
      };

      const pool = await createObjectPool(connectionFactory, { minSize: 1, maxSize: 3 }, validator);

      const { item, pool: newPool } = await acquire(pool);

      expect(item.host).toBe('localhost');
      expect(item.connected).toBe(true);

      const afterRelease = release(newPool, item);
      expect(available(afterRelease)).toBe(1);
    });
  });
});
