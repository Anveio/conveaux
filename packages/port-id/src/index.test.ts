import { describe, expect, it } from 'vitest';

import type { Random } from '@conveaux/contract-random';
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
 * Create a mock Random that uses a custom bytes function.
 */
function createMockRandom(bytesFn: (size: number) => Uint8Array): Random {
  return {
    bytes: bytesFn,
  };
}

/**
 * Create a mock Random that returns incrementing byte values.
 */
function createIncrementingRandom(): Random {
  let counter = 0;
  return createMockRandom((size: number) => {
    return new Uint8Array(size).map(() => ++counter % 256);
  });
}

/**
 * Create a mock Random that returns fixed bytes.
 */
function createFixedRandom(bytes: number[]): Random {
  return createMockRandom((size: number) => new Uint8Array(bytes.slice(0, size)));
}

/**
 * Create a mock Random that fills with a specific value.
 */
function createFilledRandom(fillValue: number): Random {
  return createMockRandom((size: number) => new Uint8Array(size).fill(fillValue));
}

/**
 * Create a mock Random that tracks calls.
 */
function createCapturingRandom(): { random: Random; calls: number[] } {
  const calls: number[] = [];
  return {
    random: createMockRandom((size: number) => {
      calls.push(size);
      return new Uint8Array(size).fill(1);
    }),
    calls,
  };
}

/**
 * Create a production-like Random using Node.js crypto.
 */
function createNodeRandom(): Random {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto');
  return createMockRandom((size: number) => {
    const buffer = crypto.randomBytes(size);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  });
}

// =============================================================================
// Random ID Generator Tests
// =============================================================================

describe('createRandomIdGenerator', () => {
  describe('default implementation', () => {
    it('should generate hex string of default length (32 chars)', () => {
      const random = createNodeRandom();
      const gen = createRandomIdGenerator({ random });
      const id = gen.randomId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should generate unique IDs', () => {
      const random = createNodeRandom();
      const gen = createRandomIdGenerator({ random });
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.randomId());
      }
      expect(ids.size).toBe(100);
    });

    it('should request default 16 bytes from random', () => {
      const { random, calls } = createCapturingRandom();
      const gen = createRandomIdGenerator({ random });
      gen.randomId();
      expect(calls[0]).toBe(16);
    });
  });

  describe('custom configuration', () => {
    it('should respect sizeBytes option', () => {
      const { random, calls } = createCapturingRandom();
      const gen = createRandomIdGenerator({ random }, { config: { sizeBytes: 8 } });
      gen.randomId();
      expect(calls[0]).toBe(8);
    });

    it('should support base64 encoding', () => {
      const random = createNodeRandom();
      const gen = createRandomIdGenerator(
        { random },
        { config: { sizeBytes: 12, encoding: 'base64' } }
      );
      const id = gen.randomId();
      // 12 bytes = 16 base64 chars
      expect(id).toMatch(/^[A-Za-z0-9+/]{16}$/);
    });

    it('should support base64url encoding', () => {
      const random = createNodeRandom();
      const gen = createRandomIdGenerator(
        { random },
        { config: { sizeBytes: 12, encoding: 'base64url' } }
      );
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
      const random = createNodeRandom();
      let callCount = 0;
      const gen = createRandomIdGenerator(
        { random },
        {
          generate: () => {
            callCount++;
            return `custom-id-${callCount}`;
          },
        }
      );
      expect(gen.randomId()).toBe('custom-id-1');
      expect(gen.randomId()).toBe('custom-id-2');
      expect(callCount).toBe(2);
    });

    it('should work with uuid-like injection', () => {
      const random = createNodeRandom();
      const gen = createRandomIdGenerator(
        { random },
        { generate: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'.replace(/-/g, '') }
      );
      const id = gen.randomId();
      expect(id).toBe('a1b2c3d4e5f67890abcdef1234567890');
    });
  });

  describe('deterministic testing', () => {
    it('should use mock random for deterministic output', () => {
      const random = createFilledRandom(0xab);
      const gen = createRandomIdGenerator({ random });
      expect(gen.randomId()).toBe('ab'.repeat(16));
    });
  });

  describe('type branding', () => {
    it('should return RandomId type', () => {
      const random = createNodeRandom();
      const gen = createRandomIdGenerator({ random });
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
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });
      const id = gen.timeOrderedId();
      // 16 bytes = 26 base32 chars
      expect(id).toHaveLength(26);
      expect(id).toMatch(/^[0-9A-HJ-NP-TV-Z]{26}$/);
    });

    it('should generate sortable IDs', () => {
      const clock = createMockClock(1000);
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });

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
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });
      const id = gen.timeOrderedId();
      const extracted = gen.extractTimestamp(id);
      expect(extracted).toBe(1700000000000);
    });

    it('should generate unique IDs within same millisecond', () => {
      const clock = createMockClock(1700000000000);
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.timeOrderedId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('custom configuration', () => {
    it('should respect randomSuffixBytes option', () => {
      const { random, calls } = createCapturingRandom();
      const clock = createMockClock();
      const gen = createTimeOrderedIdGenerator(
        { clock, random },
        { config: { randomSuffixBytes: 5 } }
      );
      gen.timeOrderedId();
      expect(calls[0]).toBe(5);
    });

    it('should support hex encoding', () => {
      const clock = createMockClock(1700000000000);
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random }, { config: { encoding: 'hex' } });
      const id = gen.timeOrderedId();
      // 6 bytes timestamp + 10 bytes random = 16 bytes = 32 hex chars
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe('custom generate function', () => {
    it('should pass timestamp to generate function', () => {
      const clock = createMockClock(1700000000000);
      const random = createNodeRandom();
      let capturedTs: number | undefined;
      const gen = createTimeOrderedIdGenerator(
        { clock, random },
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
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator(
        { clock, random },
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
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random }, { generate: () => 'fixed-id' });
      expect(gen.extractTimestamp('fixed-id' as TimeOrderedId)).toBeUndefined();
    });
  });

  describe('B-tree friendliness', () => {
    it('should produce monotonically increasing prefixes for increasing timestamps', () => {
      const clock = createMockClock();
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });

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

  describe('type branding', () => {
    it('should return TimeOrderedId type', () => {
      const clock = createMockClock();
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });
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
      const random = createNodeRandom();
      const gen = createTraceIdGenerator({ random });
      const id = gen.traceId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should request 16 bytes from random', () => {
      const { random, calls } = createCapturingRandom();
      const gen = createTraceIdGenerator({ random });
      gen.traceId();
      expect(calls[0]).toBe(16);
    });

    it('should generate unique IDs', () => {
      const random = createNodeRandom();
      const gen = createTraceIdGenerator({ random });
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(gen.traceId());
      }
      expect(ids.size).toBe(100);
    });

    it('should be deterministic with mock', () => {
      const random = createFixedRandom([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
        0x10,
      ]);
      const gen = createTraceIdGenerator({ random });
      const id = gen.traceId();
      expect(id).toBe('0102030405060708090a0b0c0d0e0f10');
    });
  });

  describe('spanId()', () => {
    it('should generate 16 character hex string', () => {
      const random = createNodeRandom();
      const gen = createTraceIdGenerator({ random });
      const id = gen.spanId();
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should request 8 bytes from random', () => {
      const { random, calls } = createCapturingRandom();
      const gen = createTraceIdGenerator({ random });
      gen.spanId();
      expect(calls[0]).toBe(8);
    });

    it('should be deterministic with mock', () => {
      const random = createFixedRandom([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]);
      const gen = createTraceIdGenerator({ random });
      const id = gen.spanId();
      expect(id).toBe('deadbeefcafebabe');
    });
  });

  describe('W3C compliance', () => {
    it('should not generate all-zero trace IDs', () => {
      let callCount = 0;
      const random = createMockRandom((size: number) => {
        callCount++;
        if (callCount === 1) {
          return new Uint8Array(size).fill(0);
        }
        return new Uint8Array(size).fill(1);
      });
      const gen = createTraceIdGenerator({ random });
      const id = gen.traceId();
      expect(id).not.toBe('0'.repeat(32));
      expect(callCount).toBe(2);
    });

    it('should not generate all-zero span IDs', () => {
      let callCount = 0;
      const random = createMockRandom((size: number) => {
        callCount++;
        if (callCount === 1) {
          return new Uint8Array(size).fill(0);
        }
        return new Uint8Array(size).fill(1);
      });
      const gen = createTraceIdGenerator({ random });
      const id = gen.spanId();
      expect(id).not.toBe('0'.repeat(16));
      expect(callCount).toBe(2);
    });
  });

  describe('type branding', () => {
    it('should return TraceId type from traceId()', () => {
      const random = createNodeRandom();
      const gen = createTraceIdGenerator({ random });
      const id: TraceId = gen.traceId();
      expect(typeof id).toBe('string');
    });

    it('should return SpanId type from spanId()', () => {
      const random = createNodeRandom();
      const gen = createTraceIdGenerator({ random });
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
    const random = createNodeRandom();
    const ids = createIdGenerator({ clock, random });

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
    const random = createNodeRandom();
    const ids = createIdGenerator({ clock, random });

    const timeOrderedId = ids.timeOrderedId();
    expect(ids.extractTimestamp(timeOrderedId)).toBe(1700000000000);
  });

  it('should use shared random for all generators', () => {
    const clock = createMockClock();
    const random = createFilledRandom(0x42);
    const ids = createIdGenerator({ clock, random });

    expect(ids.randomId()).toBe('42'.repeat(16));
    expect(ids.traceId()).toBe('42'.repeat(16));
    expect(ids.spanId()).toBe('42'.repeat(8));
  });

  it('should allow per-category configuration', () => {
    const clock = createMockClock();
    const random = createNodeRandom();

    const ids = createIdGenerator(
      { clock, random },
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
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });
      const id = gen.timeOrderedId();
      const timestamp = gen.extractTimestamp(id);
      expect(timestamp).toBe(1700000000000);
    });

    it('should be lexicographically sortable', () => {
      const clock = createMockClock();
      const random = createNodeRandom();
      const gen = createTimeOrderedIdGenerator({ clock, random });

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
    const random = createIncrementingRandom();
    const gen = createRandomIdGenerator({ random });

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
    const random = createNodeRandom();
    const gen = createTimeOrderedIdGenerator({ clock, random });

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
