import { describe, expect, it } from 'vitest';
import { createRandom } from './index.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock randomBytes function that fills with a value.
 */
function createFilledRandomBytes(fillValue: number): (size: number) => Uint8Array {
  return (size: number) => new Uint8Array(size).fill(fillValue);
}

/**
 * Create a mock randomBytes function that returns incrementing values.
 */
function createIncrementingRandomBytes(): (size: number) => Uint8Array {
  let counter = 0;
  return (size: number) => new Uint8Array(size).map(() => ++counter % 256);
}

/**
 * Create a mock randomBytes function that tracks calls.
 */
function createCapturingRandomBytes(): { fn: (size: number) => Uint8Array; calls: number[] } {
  const calls: number[] = [];
  return {
    fn: (size: number) => {
      calls.push(size);
      return new Uint8Array(size).fill(1);
    },
    calls,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('createRandom', () => {
  describe('with injected randomBytes', () => {
    it('should generate bytes using injected function', () => {
      const random = createRandom({ randomBytes: createFilledRandomBytes(0xab) });
      const bytes = random.bytes(16);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toHaveLength(16);
      expect(Array.from(bytes)).toEqual(Array(16).fill(0xab));
    });

    it('should pass size to injected function', () => {
      const { fn, calls } = createCapturingRandomBytes();
      const random = createRandom({ randomBytes: fn });

      random.bytes(8);
      random.bytes(16);
      random.bytes(32);

      expect(calls).toEqual([8, 16, 32]);
    });

    it('should handle zero size', () => {
      const random = createRandom({ randomBytes: createFilledRandomBytes(0) });
      const bytes = random.bytes(0);

      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes).toHaveLength(0);
    });

    it('should return unique bytes when injected function provides them', () => {
      const random = createRandom({ randomBytes: createIncrementingRandomBytes() });

      const bytes1 = random.bytes(4);
      const bytes2 = random.bytes(4);

      expect(Array.from(bytes1)).toEqual([1, 2, 3, 4]);
      expect(Array.from(bytes2)).toEqual([5, 6, 7, 8]);
    });
  });

  describe('with bytes option override', () => {
    it('should use bytes option instead of deps.randomBytes', () => {
      const random = createRandom(
        { randomBytes: createFilledRandomBytes(0x00) }, // Should not be used
        { bytes: createFilledRandomBytes(0xff) }
      );
      const bytes = random.bytes(4);

      expect(Array.from(bytes)).toEqual([0xff, 0xff, 0xff, 0xff]);
    });

    it('should allow deterministic testing with bytes override', () => {
      let counter = 0;
      const random = createRandom(
        { randomBytes: () => new Uint8Array(0) }, // Unused
        {
          bytes: (size) => {
            const bytes = new Uint8Array(size);
            for (let i = 0; i < size; i++) {
              bytes[i] = (counter + i) % 256;
            }
            counter += size;
            return bytes;
          },
        }
      );

      const first = random.bytes(4);
      expect(Array.from(first)).toEqual([0, 1, 2, 3]);

      const second = random.bytes(4);
      expect(Array.from(second)).toEqual([4, 5, 6, 7]);
    });
  });

  describe('instance independence', () => {
    it('each random instance uses its own injected function', () => {
      const random1 = createRandom({ randomBytes: createFilledRandomBytes(0x11) });
      const random2 = createRandom({ randomBytes: createFilledRandomBytes(0x22) });

      expect(random1.bytes(1)[0]).toBe(0x11);
      expect(random2.bytes(1)[0]).toBe(0x22);
    });
  });
});
