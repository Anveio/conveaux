import { describe, expect, it } from 'vitest';

import type { SpanId, TraceId } from './index.js';
import { createTraceIdGenerator } from './index.js';

// =============================================================================
// Test Helpers
// =============================================================================

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
// Tests
// =============================================================================

describe('createTraceIdGenerator', () => {
  describe('traceId()', () => {
    it('should generate 32 character hex string', () => {
      const generator = createTraceIdGenerator();
      const id = generator.traceId();
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('should request 16 bytes from randomBytes', () => {
      const { fn, calls } = createCapturingMock();
      const generator = createTraceIdGenerator({ randomBytesFn: fn });
      generator.traceId();
      expect(calls[0]).toBe(16);
    });

    it('should generate unique IDs', () => {
      const generator = createTraceIdGenerator();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generator.traceId());
      }
      expect(ids.size).toBe(100);
    });

    it('should be deterministic with mock', () => {
      const generator = createTraceIdGenerator({
        randomBytesFn: createFixedMock([
          0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
          0x10,
        ]),
      });
      const id = generator.traceId();
      expect(id).toBe('0102030405060708090a0b0c0d0e0f10');
    });

    it('should produce lowercase hex characters', () => {
      const generator = createTraceIdGenerator({
        randomBytesFn: createFixedMock([
          0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44,
          0x55,
        ]),
      });
      const id = generator.traceId();
      expect(id).toBe('abcdef123456789abcdef01122334455');
      expect(id).toBe(id.toLowerCase());
    });
  });

  describe('spanId()', () => {
    it('should generate 16 character hex string', () => {
      const generator = createTraceIdGenerator();
      const id = generator.spanId();
      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('should request 8 bytes from randomBytes', () => {
      const { fn, calls } = createCapturingMock();
      const generator = createTraceIdGenerator({ randomBytesFn: fn });
      generator.spanId();
      expect(calls[0]).toBe(8);
    });

    it('should generate unique IDs', () => {
      const generator = createTraceIdGenerator();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generator.spanId());
      }
      expect(ids.size).toBe(100);
    });

    it('should be deterministic with mock', () => {
      const generator = createTraceIdGenerator({
        randomBytesFn: createFixedMock([0xde, 0xad, 0xbe, 0xef, 0xca, 0xfe, 0xba, 0xbe]),
      });
      const id = generator.spanId();
      expect(id).toBe('deadbeefcafebabe');
    });

    it('should produce lowercase hex characters', () => {
      const generator = createTraceIdGenerator({
        randomBytesFn: createFixedMock([0xab, 0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x9a]),
      });
      const id = generator.spanId();
      expect(id).toBe('abcdef123456789a');
      expect(id).toBe(id.toLowerCase());
    });
  });

  describe('environment override', () => {
    it('should throw when crypto is null and no randomBytesFn', () => {
      const generator = createTraceIdGenerator({
        environment: { crypto: null },
      });
      expect(() => generator.traceId()).toThrow('No crypto implementation available');
      expect(() => generator.spanId()).toThrow('No crypto implementation available');
    });

    it('should use custom crypto implementation', () => {
      const customCrypto = {
        randomBytes: (size: number) => new Uint8Array(size).fill(0xab),
      };
      const generator = createTraceIdGenerator({
        environment: { crypto: customCrypto },
      });
      expect(generator.spanId()).toBe('abababababababab');
    });

    it('should prefer randomBytesFn over environment crypto', () => {
      const customCrypto = {
        randomBytes: () => new Uint8Array(16).fill(0xee),
      };
      const generator = createTraceIdGenerator({
        randomBytesFn: (size) => new Uint8Array(size).fill(0xff),
        environment: { crypto: customCrypto },
      });
      expect(generator.spanId()).toBe('ffffffffffffffff');
    });

    it('should use host crypto when environment is undefined', () => {
      const generator = createTraceIdGenerator({
        environment: undefined,
      });
      // Should not throw - uses Node.js crypto
      const id = generator.traceId();
      expect(id).toHaveLength(32);
    });

    it('should use host crypto when crypto key is not present', () => {
      const generator = createTraceIdGenerator({
        environment: {},
      });
      // Should not throw - uses Node.js crypto
      const id = generator.traceId();
      expect(id).toHaveLength(32);
    });
  });

  describe('W3C compliance', () => {
    it('should not generate all-zero trace IDs', () => {
      // Mock that returns zeros first, then non-zeros
      let callCount = 0;
      const generator = createTraceIdGenerator({
        randomBytesFn: (size: number) => {
          callCount++;
          if (callCount === 1) {
            return new Uint8Array(size).fill(0);
          }
          return new Uint8Array(size).fill(1);
        },
      });
      const id = generator.traceId();
      expect(id).not.toBe('0'.repeat(32));
      expect(callCount).toBe(2); // Retried once
    });

    it('should not generate all-zero span IDs', () => {
      let callCount = 0;
      const generator = createTraceIdGenerator({
        randomBytesFn: (size: number) => {
          callCount++;
          if (callCount === 1) {
            return new Uint8Array(size).fill(0);
          }
          return new Uint8Array(size).fill(1);
        },
      });
      const id = generator.spanId();
      expect(id).not.toBe('0'.repeat(16));
      expect(callCount).toBe(2);
    });

    it('should handle multiple retries for all-zeros', () => {
      let callCount = 0;
      const generator = createTraceIdGenerator({
        randomBytesFn: (size: number) => {
          callCount++;
          // Return zeros for first 3 calls, then non-zeros
          if (callCount <= 3) {
            return new Uint8Array(size).fill(0);
          }
          return new Uint8Array(size).fill(0x42);
        },
      });
      const id = generator.spanId();
      expect(id).toBe('42'.repeat(8));
      expect(callCount).toBe(4);
    });
  });

  describe('type branding', () => {
    it('should return TraceId type from traceId()', () => {
      const generator = createTraceIdGenerator();
      const id: TraceId = generator.traceId();
      expect(typeof id).toBe('string');
    });

    it('should return SpanId type from spanId()', () => {
      const generator = createTraceIdGenerator();
      const id: SpanId = generator.spanId();
      expect(typeof id).toBe('string');
    });
  });

  describe('integration pattern', () => {
    it('should work as generateId function for instrumentation', () => {
      const generator = createTraceIdGenerator({
        randomBytesFn: createIncrementingMock(),
      });

      // Simulating port-instrumentation usage
      const generateId = (): string => generator.spanId();

      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toHaveLength(16);
      expect(id2).toHaveLength(16);
      expect(id1).not.toBe(id2);
    });

    it('should provide consistent traceId across multiple spanId calls', () => {
      const generator = createTraceIdGenerator();

      // Simulating a trace with multiple spans
      const traceId = generator.traceId();
      const span1 = generator.spanId();
      const span2 = generator.spanId();
      const span3 = generator.spanId();

      // All should be valid format
      expect(traceId).toHaveLength(32);
      expect(span1).toHaveLength(16);
      expect(span2).toHaveLength(16);
      expect(span3).toHaveLength(16);

      // All span IDs should be unique
      expect(new Set([span1, span2, span3]).size).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid sequential calls', () => {
      const generator = createTraceIdGenerator();
      const ids = Array.from({ length: 1000 }, () => generator.spanId());
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1000);
    });

    it('should handle mixed traceId and spanId calls', () => {
      const generator = createTraceIdGenerator();
      const ids: string[] = [];

      for (let i = 0; i < 50; i++) {
        ids.push(generator.traceId());
        ids.push(generator.spanId());
      }

      // All 100 IDs should be unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });
});
