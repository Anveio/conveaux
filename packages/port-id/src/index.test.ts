import { describe, expect, it } from 'vitest';

import type { WallClock } from '@conveaux/contract-wall-clock';

import type { RandomId, SpanId, TimeOrderedId, TraceId } from './index.js';
import {
  createIdGenerator,
  createRandomIdGenerator,
  createTimeOrderedIdGenerator,
  createTraceIdGenerator,
} from './index.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock clock with fixed or controllable time.
 */
function createMockClock(
  initialMs: number = Date.now()
): WallClock & { setTime: (ms: number) => void } {
  let currentMs = initialMs;
  return {
    nowMs: () => currentMs,
    setTime: (ms: number) => {
      currentMs = ms;
    },
  };
}

/**
 * Create deterministic mock that returns incrementing byte values.
 */
function createIncrementingMock(): (size: number) => Uint8Array {
  let counter = 0;
  return (size: number) => {
    return new Uint8Array(size).map(() => ++counter % 256);
  };
}

/**
 * Create mock that returns specific bytes.
 */
function createFixedMock(bytes: number[]): (size: number) => Uint8Array {
  return (size: number) => new Uint8Array(bytes.slice(0, size));
}

/**
 * Create mock that tracks calls.
 */
function createCapturingMock(): { fn: (size: number) => Uint8Array; calls: number[] } {
  const calls: number[] = [];
  return {
    fn: (size: number): Uint8Array => {
      calls.push(size);
      return new Uint8Array(size).fill(1);
    },
    calls,
  };
}

// =============================================================================
// Random ID Generator Tests
// =============================================================================

describe('createRandomIdGenerator', () => {
  describe('default implementation', () => {
    it('should generate hex string of default length (32 chars)', () => {
      const gen = createRandomIdGenerator();
      const id = gen.randomId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique IDs', () => {
      const gen = createRandomIdGenerator();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.randomId());
      }
      expect(ids.size).toBe(100);
    });

    it('should request default 16 bytes from crypto', () => {
      const { fn, calls } = createCapturingMock();
      const gen = createRandomIdGenerator({
        environment: { crypto: { randomBytes: fn } },
      });
      gen.randomId();
      expect(calls[0]).toBe(16);
    });
  });

  describe('custom configuration', () => {
    it('should respect sizeBytes option', () => {
      const { fn, calls } = createCapturingMock();
      const gen = createRandomIdGenerator({
        config: { sizeBytes: 8 },
        environment: { crypto: { randomBytes: fn } },
      });
      gen.randomId();
      expect(calls[0]).toBe(8);
    });

    it('should support base64 encoding', () => {
      const gen = createRandomIdGenerator({
        config: { sizeBytes: 12, encoding: 'base64' },
      });
      const id = gen.randomId();
      // 12 bytes = 16 base64 chars
      expect(id).toMatch(/^[A-Za-z0-9+/]{16}$/);
    });

    it('should support base64url encoding', () => {
      const gen = createRandomIdGenerator({
        config: { sizeBytes: 12, encoding: 'base64url' },
      });
      const id = gen.randomId();
      // base64url: no +, /, or = padding
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(id).not.toContain('+');
      expect(id).not.toContain('/');
      expect(id).not.toContain('=');
    });
  });

  describe('custom generate function', () => {
    it('should use injected generate function', () => {
      let callCount = 0;
      const gen = createRandomIdGenerator({
        generate: () => {
          callCount++;
          return `custom-id-${callCount}`;
        },
      });
      expect(gen.randomId()).toBe('custom-id-1');
      expect(gen.randomId()).toBe('custom-id-2');
      expect(callCount).toBe(2);
    });

    it('should work with uuid-like injection', () => {
      const gen = createRandomIdGenerator({
        generate: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'.replace(/-/g, ''),
      });
      const id = gen.randomId();
      expect(id).toBe('a1b2c3d4e5f67890abcdef1234567890');
    });
  });

  describe('environment override', () => {
    it('should throw when crypto is null and no generate', () => {
      const gen = createRandomIdGenerator({
        environment: { crypto: null },
      });
      expect(() => gen.randomId()).toThrow('No crypto implementation available');
    });

    it('should use custom crypto implementation', () => {
      const customCrypto = {
        randomBytes: (size: number) => new Uint8Array(size).fill(0xab),
      };
      const gen = createRandomIdGenerator({
        environment: { crypto: customCrypto },
      });
      expect(gen.randomId()).toBe('ab'.repeat(16));
    });
  });

  describe('type branding', () => {
    it('should return RandomId type', () => {
      const gen = createRandomIdGenerator();
      const id: RandomId = gen.randomId();
      expect(typeof id).toBe('string');
    });
  });
});

// =============================================================================
// Time-Ordered ID Generator Tests
// =============================================================================

describe('createTimeOrderedIdGenerator', () => {
  describe('default implementation', () => {
    it('should generate Crockford Base32 string', () => {
      const clock = createMockClock(1700000000000);
      const gen = createTimeOrderedIdGenerator({ clock });
      const id = gen.timeOrderedId();
      // 16 bytes = 26 base32 chars
      expect(id).toHaveLength(26);
      expect(id).toMatch(/^[0-9A-HJ-NP-TV-Z]{26}$/);
    });

    it('should generate sortable IDs', () => {
      const clock = createMockClock(1000);
      const gen = createTimeOrderedIdGenerator({ clock });

      clock.setTime(1000);
      const id1 = gen.timeOrderedId();

      clock.setTime(2000);
      const id2 = gen.timeOrderedId();

      clock.setTime(3000);
      const id3 = gen.timeOrderedId();

      // Lexicographic sort should equal time sort
      const sorted = [id3, id1, id2].sort();
      expect(sorted).toEqual([id1, id2, id3]);
    });

    it('should extract timestamp correctly', () => {
      const clock = createMockClock(1700000000000);
      const gen = createTimeOrderedIdGenerator({ clock });
      const id = gen.timeOrderedId();
      const extracted = gen.extractTimestamp(id);
      expect(extracted).toBe(1700000000000);
    });

    it('should generate unique IDs within same millisecond', () => {
      const clock = createMockClock(1700000000000);
      const gen = createTimeOrderedIdGenerator({ clock });
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.timeOrderedId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('custom configuration', () => {
    it('should respect randomSuffixBytes option', () => {
      const { fn, calls } = createCapturingMock();
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator(
        { clock },
        {
          config: { randomSuffixBytes: 5 },
          environment: { crypto: { randomBytes: fn } },
        }
      );
      gen.timeOrderedId();
      expect(calls[0]).toBe(5);
    });

    it('should support hex encoding', () => {
      const clock = createMockClock(1700000000000);
      const gen = createTimeOrderedIdGenerator({ clock }, { config: { encoding: 'hex' } });
      const id = gen.timeOrderedId();
      // 6 bytes timestamp + 10 bytes random = 16 bytes = 32 hex chars
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('custom generate function', () => {
    it('should pass timestamp to generate function', () => {
      const clock = createMockClock(1700000000000);
      let capturedTs: number | undefined;
      const gen = createTimeOrderedIdGenerator(
        { clock },
        {
          generate: (ts) => {
            capturedTs = ts;
            return `ulid-${ts}`;
          },
        }
      );
      gen.timeOrderedId();
      expect(capturedTs).toBe(1700000000000);
    });

    it('should use custom extractTimestamp', () => {
      const clock = createMockClock(1700000000000);
      const gen = createTimeOrderedIdGenerator(
        { clock },
        {
          generate: (ts) => `custom-${ts}`,
          extractTimestamp: (id) => {
            const match = id.match(/custom-(\d+)/);
            return match?.[1] ? Number.parseInt(match[1], 10) : undefined;
          },
        }
      );
      const id = gen.timeOrderedId();
      expect(gen.extractTimestamp(id)).toBe(1700000000000);
    });

    it('should return undefined when no extractTimestamp provided', () => {
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator({ clock }, { generate: () => 'fixed-id' });
      expect(gen.extractTimestamp('fixed-id' as TimeOrderedId)).toBeUndefined();
    });
  });

  describe('B-tree friendliness', () => {
    it('should produce monotonically increasing prefixes for increasing timestamps', () => {
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator({ clock });

      const timestamps = [1000, 2000, 5000, 10000, 100000];
      const ids: string[] = [];

      for (const ts of timestamps) {
        clock.setTime(ts);
        ids.push(gen.timeOrderedId());
      }

      // First 10 chars encode the timestamp in base32
      const prefixes = ids.map((id) => id.slice(0, 10));
      const sortedPrefixes = [...prefixes].sort();
      expect(prefixes).toEqual(sortedPrefixes);
    });
  });

  describe('environment override', () => {
    it('should throw when crypto is null and no generate', () => {
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator({ clock }, { environment: { crypto: null } });
      expect(() => gen.timeOrderedId()).toThrow('No crypto implementation available');
    });
  });

  describe('type branding', () => {
    it('should return TimeOrderedId type', () => {
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator({ clock });
      const id: TimeOrderedId = gen.timeOrderedId();
      expect(typeof id).toBe('string');
    });
  });
});

// =============================================================================
// Trace ID Generator Tests
// =============================================================================

describe('createTraceIdGenerator', () => {
  describe('traceId()', () => {
    it('should generate 32 character hex string', () => {
      const gen = createTraceIdGenerator();
      const id = gen.traceId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should request 16 bytes from randomBytes', () => {
      const { fn, calls } = createCapturingMock();
      const gen = createTraceIdGenerator({
        environment: { crypto: { randomBytes: fn } },
      });
      gen.traceId();
      expect(calls[0]).toBe(16);
    });

    it('should generate unique IDs', () => {
      const gen = createTraceIdGenerator();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.traceId());
      }
      expect(ids.size).toBe(100);
    });

    it('should be deterministic with mock', () => {
      const gen = createTraceIdGenerator({
        randomBytesFn: createFixedMock([
          0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
          0x10,
        ]),
      });
      const id = gen.traceId();
      expect(id).toBe('0102030405060708090a0b0c0d0e0f10');
    });
  });

  describe('spanId()', () => {
    it('should generate 16 character hex string', () => {
      const gen = createTraceIdGenerator();
      const id = gen.spanId();
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should request 8 bytes from randomBytes', () => {
      const { fn, calls } = createCapturingMock();
      const gen = createTraceIdGenerator({
        environment: { crypto: { randomBytes: fn } },
      });
      gen.spanId();
      expect(calls[0]).toBe(8);
    });

    it('should be deterministic with mock', () => {
      const gen = createTraceIdGenerator({
        randomBytesFn: createFixedMock([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]),
      });
      const id = gen.spanId();
      expect(id).toBe('deadbeefcafebabe');
    });
  });

  describe('W3C compliance', () => {
    it('should not generate all-zero trace IDs', () => {
      let callCount = 0;
      const gen = createTraceIdGenerator({
        randomBytesFn: (size: number) => {
          callCount++;
          if (callCount === 1) {
            return new Uint8Array(size).fill(0);
          }
          return new Uint8Array(size).fill(1);
        },
      });
      const id = gen.traceId();
      expect(id).not.toBe('0'.repeat(32));
      expect(callCount).toBe(2);
    });

    it('should not generate all-zero span IDs', () => {
      let callCount = 0;
      const gen = createTraceIdGenerator({
        randomBytesFn: (size: number) => {
          callCount++;
          if (callCount === 1) {
            return new Uint8Array(size).fill(0);
          }
          return new Uint8Array(size).fill(1);
        },
      });
      const id = gen.spanId();
      expect(id).not.toBe('0'.repeat(16));
      expect(callCount).toBe(2);
    });
  });

  describe('type branding', () => {
    it('should return TraceId type from traceId()', () => {
      const gen = createTraceIdGenerator();
      const id: TraceId = gen.traceId();
      expect(typeof id).toBe('string');
    });

    it('should return SpanId type from spanId()', () => {
      const gen = createTraceIdGenerator();
      const id: SpanId = gen.spanId();
      expect(typeof id).toBe('string');
    });
  });
});

// =============================================================================
// Unified ID Generator Tests
// =============================================================================

describe('createIdGenerator', () => {
  it('should compose all generators', () => {
    const clock = createMockClock(1700000000000);
    const ids = createIdGenerator({ clock });

    const randomId = ids.randomId();
    const timeOrderedId = ids.timeOrderedId();
    const traceId = ids.traceId();
    const spanId = ids.spanId();

    expect(randomId).toHaveLength(32);
    expect(timeOrderedId).toHaveLength(26);
    expect(traceId).toHaveLength(32);
    expect(spanId).toHaveLength(16);
  });

  it('should support extractTimestamp', () => {
    const clock = createMockClock(1700000000000);
    const ids = createIdGenerator({ clock });

    const timeOrderedId = ids.timeOrderedId();
    expect(ids.extractTimestamp(timeOrderedId)).toBe(1700000000000);
  });

  it('should share environment across generators', () => {
    const clock = createMockClock();
    const customCrypto = {
      randomBytes: (size: number) => new Uint8Array(size).fill(0x42),
    };

    const ids = createIdGenerator({ clock }, { environment: { crypto: customCrypto } });

    expect(ids.randomId()).toBe('42'.repeat(16));
    expect(ids.traceId()).toBe('42'.repeat(16));
    expect(ids.spanId()).toBe('42'.repeat(8));
  });

  it('should allow per-category configuration', () => {
    const clock = createMockClock();

    const ids = createIdGenerator(
      { clock },
      {
        random: {
          generate: () => 'custom-random',
        },
        timeOrdered: {
          generate: (ts) => `custom-time-${ts}`,
        },
      }
    );

    expect(ids.randomId()).toBe('custom-random');
    expect(ids.timeOrderedId()).toMatch(/^custom-time-\d+$/);
    // Trace IDs should still use default
    expect(ids.traceId()).toHaveLength(32);
  });
});

// =============================================================================
// Encoding Tests
// =============================================================================

describe('encoding', () => {
  describe('Crockford Base32', () => {
    it('should encode and decode round-trip', () => {
      const clock = createMockClock(1700000000000);
      const gen = createTimeOrderedIdGenerator({ clock });
      const id = gen.timeOrderedId();
      const timestamp = gen.extractTimestamp(id);
      expect(timestamp).toBe(1700000000000);
    });

    it('should be lexicographically sortable', () => {
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator({ clock });

      const ids: string[] = [];
      for (let ts = 1000; ts <= 10000; ts += 1000) {
        clock.setTime(ts);
        ids.push(gen.timeOrderedId());
      }

      const sorted = [...ids].sort();
      expect(ids).toEqual(sorted);
    });
  });
});

// =============================================================================
// Integration Pattern Tests
// =============================================================================

describe('integration patterns', () => {
  it('should work as generateId function for instrumentation', () => {
    const gen = createRandomIdGenerator({
      environment: {
        crypto: {
          randomBytes: createIncrementingMock(),
        },
      },
    });

    // Simulating port-instrumentation usage
    const generateId = (): string => gen.randomId();

    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toHaveLength(32);
    expect(id2).toHaveLength(32);
    expect(id1).not.toBe(id2);
  });

  it('should work as database ID generator', () => {
    const clock = createMockClock(Date.now());
    const gen = createTimeOrderedIdGenerator({ clock });

    // Generate IDs simulating database inserts
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      ids.push(gen.timeOrderedId());
      // Simulate 10ms between inserts
      clock.setTime(clock.nowMs() + 10);
    }

    // All unique
    expect(new Set(ids).size).toBe(10);

    // Sortable
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);

    // Timestamp extractable
    for (const id of ids) {
      const ts = gen.extractTimestamp(id as TimeOrderedId);
      expect(ts).toBeDefined();
      expect(ts).toBeGreaterThan(0);
    }
  });
});
