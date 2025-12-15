import { describe, expect, it } from 'vitest';
import {
  createBrowserTimestamper,
  createDateTimestamper,
  createHighResolutionClock,
  createNodeTimestamper,
} from './index.js';
import type { Timestamper } from './index.js';

// Helper to create a mock timestamper with controllable time
function createMockTimestamper(initialNs = 0n): Timestamper & { time: bigint } {
  const mock = {
    time: initialNs,
    nowNs: () => mock.time,
  };
  return mock;
}

describe('createHighResolutionClock', () => {
  describe('now()', () => {
    it('returns 0 on first call with default origin', () => {
      const timestamper = createMockTimestamper(1_000_000_000n);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.now()).toBe(0);
    });

    it('returns elapsed time in milliseconds', () => {
      const timestamper = createMockTimestamper(0n);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.now()).toBe(0);

      // Advance 50ms (50_000_000 nanoseconds)
      timestamper.time = 50_000_000n;
      expect(clock.now()).toBe(50);

      // Advance 100ms total
      timestamper.time = 100_000_000n;
      expect(clock.now()).toBe(100);
    });

    it('uses custom originNs when provided', () => {
      const timestamper = createMockTimestamper(1_000_000_000n); // 1 second
      const clock = createHighResolutionClock({
        timestamper,
        originNs: 500_000_000n, // 500ms origin
      });

      // 1000ms - 500ms = 500ms
      expect(clock.now()).toBe(500);
    });

    it('guarantees monotonic non-decreasing time', () => {
      const timestamper = createMockTimestamper(100_000_000n);
      const clock = createHighResolutionClock({ timestamper });

      const t1 = clock.now(); // 0
      timestamper.time = 150_000_000n;
      const t2 = clock.now(); // 50
      timestamper.time = 120_000_000n; // Regress!
      const t3 = clock.now(); // Should be >= t2

      expect(t1).toBe(0);
      expect(t2).toBe(50);
      expect(t3).toBeGreaterThanOrEqual(t2);
    });

    it('handles multiple regressions', () => {
      const timestamper = createMockTimestamper(100_000_000n);
      const clock = createHighResolutionClock({ timestamper });

      clock.now(); // Initialize
      timestamper.time = 200_000_000n;
      const readings: number[] = [clock.now()]; // 100ms

      // Multiple regressions
      for (let i = 0; i < 5; i++) {
        timestamper.time = 50_000_000n; // Regress
        readings.push(clock.now());
      }

      // Each reading should be >= previous
      for (let i = 1; i < readings.length; i++) {
        expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1]);
      }
    });
  });

  describe('nowNs()', () => {
    it('returns 0n on first call with default origin', () => {
      const timestamper = createMockTimestamper(1_000_000_000n);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.nowNs()).toBe(0n);
    });

    it('returns elapsed time in nanoseconds', () => {
      const timestamper = createMockTimestamper(0n);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.nowNs()).toBe(0n);

      timestamper.time = 10_000_000n; // 10ms
      expect(clock.nowNs()).toBe(10_000_000n);

      timestamper.time = 100_000_000n; // 100ms
      expect(clock.nowNs()).toBe(100_000_000n);
    });

    it('maintains monotonicity', () => {
      const timestamper = createMockTimestamper(100_000_000n);
      const clock = createHighResolutionClock({ timestamper });

      clock.nowNs(); // Initialize
      timestamper.time = 200_000_000n;
      const ns1 = clock.nowNs();

      timestamper.time = 50_000_000n; // Regress
      const ns2 = clock.nowNs();

      expect(ns2).toBeGreaterThanOrEqual(ns1);
    });

    it('is consistent with now()', () => {
      const timestamper = createMockTimestamper(0n);
      const clock = createHighResolutionClock({ timestamper });

      timestamper.time = 50_000_000n;
      const ms = clock.now();
      const ns = clock.nowNs();

      // They should be consistent (ns = ms * 1_000_000)
      // Note: after first call, nowNs reads from lastNs which was set by now()
      expect(Number(ns) / 1_000_000).toBeCloseTo(ms, 0);
    });
  });

  describe('hrtime()', () => {
    it('returns raw timestamper value', () => {
      const timestamper = createMockTimestamper(123_456_789n);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.hrtime()).toBe(123_456_789n);
    });

    it('reflects timestamper changes directly', () => {
      const timestamper = createMockTimestamper(0n);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.hrtime()).toBe(0n);

      timestamper.time = 999_999_999n;
      expect(clock.hrtime()).toBe(999_999_999n);
    });

    it('is independent of clock origin', () => {
      const timestamper = createMockTimestamper(1_000_000_000n);
      const clock = createHighResolutionClock({
        timestamper,
        originNs: 500_000_000n,
      });

      // hrtime returns raw timestamper value, not relative to origin
      expect(clock.hrtime()).toBe(1_000_000_000n);
    });
  });

  describe('wallClockMs()', () => {
    it('returns current wall-clock time from default Date.now', () => {
      const timestamper = createMockTimestamper(0n);
      const clock = createHighResolutionClock({ timestamper });

      const wall = clock.wallClockMs();
      const dateNow = Date.now();

      // Should be within 100ms of Date.now()
      expect(Math.abs(wall - dateNow)).toBeLessThan(100);
    });

    it('uses custom wallClock when provided', () => {
      const timestamper = createMockTimestamper(0n);
      let wallTime = 1702648800000; // Fixed epoch time
      const clock = createHighResolutionClock({
        timestamper,
        wallClock: () => wallTime,
      });

      expect(clock.wallClockMs()).toBe(1702648800000);

      wallTime += 1000;
      expect(clock.wallClockMs()).toBe(1702648801000);
    });

    it('is independent of monotonic time', () => {
      const timestamper = createMockTimestamper(0n);
      let wallTime = 1702648800000;
      const clock = createHighResolutionClock({
        timestamper,
        wallClock: () => wallTime,
      });

      // Monotonic time regresses
      timestamper.time = 100_000_000n;
      timestamper.time = 50_000_000n; // Regress

      // Wall time continues forward regardless
      wallTime += 1000;
      expect(clock.wallClockMs()).toBe(1702648801000);
    });
  });

  describe('independent clock instances', () => {
    it('each clock has independent state', () => {
      const timestamper = createMockTimestamper(1_000_000_000n);

      const clock1 = createHighResolutionClock({ timestamper });
      timestamper.time = 1_100_000_000n;
      const clock2 = createHighResolutionClock({ timestamper });

      // clock1 origin = 1_000_000_000n, clock2 origin = 1_100_000_000n
      timestamper.time = 1_200_000_000n;
      expect(clock1.now()).toBe(200); // 1200 - 1000 = 200ms
      expect(clock2.now()).toBe(100); // 1200 - 1100 = 100ms
    });
  });

  describe('edge cases', () => {
    it('handles zero origin', () => {
      const timestamper = createMockTimestamper(100_000_000n);
      const clock = createHighResolutionClock({
        timestamper,
        originNs: 0n,
      });

      expect(clock.now()).toBe(100);
    });

    it('handles very large nanosecond values', () => {
      // ~24 hours in nanoseconds
      const largeNs = 86_400_000_000_000n;
      const timestamper = createMockTimestamper(largeNs);
      const clock = createHighResolutionClock({ timestamper });

      expect(clock.nowNs()).toBe(0n);
      timestamper.time = largeNs + 1_000_000_000n; // +1 second
      expect(clock.nowNs()).toBe(1_000_000_000n);
    });
  });
});

describe('Platform Timestamper Factories', () => {
  describe('createNodeTimestamper()', () => {
    it('returns a timestamper using process.hrtime.bigint()', () => {
      const timestamper = createNodeTimestamper();

      const t1 = timestamper.nowNs();
      expect(typeof t1).toBe('bigint');
      expect(t1).toBeGreaterThan(0n);

      // Should increase over time
      const t2 = timestamper.nowNs();
      expect(t2).toBeGreaterThanOrEqual(t1);
    });
  });

  describe('createBrowserTimestamper()', () => {
    it('returns a timestamper using performance.now()', () => {
      const timestamper = createBrowserTimestamper();

      const t1 = timestamper.nowNs();
      expect(typeof t1).toBe('bigint');
      expect(t1).toBeGreaterThanOrEqual(0n);

      // Should increase over time
      const t2 = timestamper.nowNs();
      expect(t2).toBeGreaterThanOrEqual(t1);
    });

    it('converts milliseconds to nanoseconds', () => {
      const timestamper = createBrowserTimestamper();
      const ns = timestamper.nowNs();

      // performance.now() returns ms since page load (usually small)
      // In Node.js test environment, this should be reasonable
      expect(ns).toBeGreaterThanOrEqual(0n);
    });
  });

  describe('createDateTimestamper()', () => {
    it('returns a timestamper using Date.now()', () => {
      const timestamper = createDateTimestamper();

      const t1 = timestamper.nowNs();
      expect(typeof t1).toBe('bigint');

      // Should be roughly Date.now() * 1_000_000
      const expectedNs = BigInt(Date.now()) * 1_000_000n;
      const diff = t1 > expectedNs ? t1 - expectedNs : expectedNs - t1;
      expect(diff).toBeLessThan(1_000_000_000n); // Within 1 second
    });

    it('converts milliseconds to nanoseconds correctly', () => {
      const timestamper = createDateTimestamper();
      const ns = timestamper.nowNs();

      // Unix epoch in ns should be large (since 1970)
      expect(ns).toBeGreaterThan(1_000_000_000_000_000_000n); // > year 2001
    });
  });
});

describe('Integration: Clock with Platform Timestampers', () => {
  it('works with createNodeTimestamper()', () => {
    const clock = createHighResolutionClock({
      timestamper: createNodeTimestamper(),
    });

    const t1 = clock.now();
    expect(typeof t1).toBe('number');
    expect(t1).toBeGreaterThanOrEqual(0);

    const t2 = clock.now();
    expect(t2).toBeGreaterThanOrEqual(t1);
  });

  it('works with createBrowserTimestamper()', () => {
    const clock = createHighResolutionClock({
      timestamper: createBrowserTimestamper(),
    });

    const t1 = clock.now();
    expect(typeof t1).toBe('number');
    expect(t1).toBeGreaterThanOrEqual(0);
  });

  it('works with createDateTimestamper()', () => {
    const clock = createHighResolutionClock({
      timestamper: createDateTimestamper(),
    });

    const t1 = clock.now();
    expect(typeof t1).toBe('number');
    expect(t1).toBeGreaterThanOrEqual(0);
  });
});
