import { describe, expect, it } from 'vitest';
import { createHighResolutionClock } from './index.js';

describe('createHighResolutionClock', () => {
  describe('now()', () => {
    it('returns 0 on first call with default origin', () => {
      const time = 1000;
      const clock = createHighResolutionClock({
        readMs: () => time,
      });

      // First call should be 0 (time - origin = 1000 - 1000 = 0)
      expect(clock.now()).toBe(0);
    });

    it('returns elapsed time from origin', () => {
      let time = 1000;
      const clock = createHighResolutionClock({
        readMs: () => time,
      });

      // First call: 0
      expect(clock.now()).toBe(0);

      // Advance time
      time = 1050;
      expect(clock.now()).toBe(50);

      time = 1100;
      expect(clock.now()).toBe(100);
    });

    it('uses custom originMs when provided', () => {
      const time = 1000;
      const clock = createHighResolutionClock({
        readMs: () => time,
        originMs: 500, // Custom origin
      });

      // 1000 - 500 = 500
      expect(clock.now()).toBe(500);
    });

    it('guarantees monotonic non-decreasing time', () => {
      let time = 100;
      const clock = createHighResolutionClock({
        readMs: () => time,
      });

      const t1 = clock.now(); // 0
      time = 150;
      const t2 = clock.now(); // 50
      time = 120; // Regress!
      const t3 = clock.now(); // Should be >= t2, not 20

      expect(t1).toBe(0);
      expect(t2).toBe(50);
      expect(t3).toBeGreaterThanOrEqual(t2);
    });

    it('handles multiple regressions', () => {
      let time = 100;
      const clock = createHighResolutionClock({
        readMs: () => time,
      });

      const readings: number[] = [];

      clock.now(); // Initialize
      time = 200;
      readings.push(clock.now()); // 100

      // Multiple regressions
      for (let i = 0; i < 5; i++) {
        time = 50; // Regress
        readings.push(clock.now());
      }

      // Each reading should be >= previous
      for (let i = 1; i < readings.length; i++) {
        expect(readings[i]).toBeGreaterThanOrEqual(readings[i - 1]);
      }
    });
  });

  describe('hrtime()', () => {
    it('returns bigint from native hrtime when available', () => {
      const mockHrtime = Object.assign(() => [0, 0] as [number, number], {
        bigint: () => 123456789n,
      });

      const clock = createHighResolutionClock({
        environment: {
          process: { hrtime: mockHrtime },
        },
      });

      expect(clock.hrtime()).toBe(123456789n);
    });

    it('falls back to derived nanoseconds when no hrtime', () => {
      let time = 1000;
      const clock = createHighResolutionClock({
        readMs: () => time,
        environment: {
          process: null, // Disable process.hrtime
        },
      });

      // First call: now() = 0, hrtime = 0 ns
      expect(clock.hrtime()).toBe(0n);

      // After 10ms: now() = 10, hrtime = 10_000_000 ns
      time = 1010;
      expect(clock.hrtime()).toBe(10_000_000n);
    });

    it('uses custom readHrtime when provided', () => {
      const clock = createHighResolutionClock({
        readHrtime: () => 999_999_999n,
      });

      expect(clock.hrtime()).toBe(999_999_999n);
    });

    it('falls back when custom readHrtime returns undefined', () => {
      let time = 1000;
      const clock = createHighResolutionClock({
        readMs: () => time,
        readHrtime: () => undefined,
        environment: { process: null },
      });

      time = 1005; // 5ms elapsed
      expect(clock.hrtime()).toBe(5_000_000n);
    });
  });

  describe('nowNs()', () => {
    it('returns nanoseconds derived from now()', () => {
      let time = 1000;
      const clock = createHighResolutionClock({
        readMs: () => time,
        environment: { process: null },
      });

      // First call: now() = 0, nowNs() = 0
      expect(clock.nowNs()).toBe(0n);

      // After 10ms: now() = 10, nowNs() = 10_000_000
      time = 1010;
      expect(clock.nowNs()).toBe(10_000_000n);

      // After 100ms: now() = 100, nowNs() = 100_000_000
      time = 1100;
      expect(clock.nowNs()).toBe(100_000_000n);
    });

    it('is always consistent with now() regardless of hrtime availability', () => {
      let time = 1000;
      const mockHrtime = Object.assign(() => [0, 0] as [number, number], {
        bigint: () => 999_999_999n, // Native hrtime returns different value
      });

      const clock = createHighResolutionClock({
        readMs: () => time,
        environment: {
          process: { hrtime: mockHrtime },
        },
      });

      // nowNs() should be derived from now(), NOT from native hrtime
      expect(clock.nowNs()).toBe(0n); // now() = 0

      time = 1050;
      expect(clock.nowNs()).toBe(50_000_000n); // now() = 50ms = 50_000_000ns

      // hrtime() uses native source (different value)
      expect(clock.hrtime()).toBe(999_999_999n);
    });

    it('maintains monotonicity when now() is monotonic', () => {
      let time = 100;
      const clock = createHighResolutionClock({
        readMs: () => time,
        environment: { process: null },
      });

      clock.now(); // Initialize
      time = 200;
      const ns1 = clock.nowNs(); // 100ms = 100_000_000ns

      // Regress time
      time = 50;
      const ns2 = clock.nowNs();

      // nowNs should still be monotonic (because now() is monotonic)
      expect(ns2).toBeGreaterThanOrEqual(ns1);
    });

    it('throws on non-finite values', () => {
      const clock = createHighResolutionClock({
        readMs: () => Number.POSITIVE_INFINITY,
        environment: { process: null },
      });

      expect(() => clock.nowNs()).toThrow('non-finite');
    });
  });

  describe('wallClockMs()', () => {
    it('returns current wall-clock time', () => {
      let wallTime = 1702648800000; // Some epoch time
      const clock = createHighResolutionClock({
        environment: {
          dateNow: () => wallTime,
        },
      });

      expect(clock.wallClockMs()).toBe(wallTime);

      wallTime += 1000;
      expect(clock.wallClockMs()).toBe(1702648801000);
    });

    it('is independent of monotonic now()', () => {
      let monotonicTime = 1000;
      let wallTime = 1702648800000;

      const clock = createHighResolutionClock({
        readMs: () => monotonicTime,
        environment: {
          dateNow: () => wallTime,
        },
      });

      // wallClockMs uses dateNow, not the monotonic readMs
      expect(clock.wallClockMs()).toBe(wallTime);

      // Even if monotonic time regresses, wall time continues
      monotonicTime = 500; // Regress monotonic
      wallTime += 1000; // Wall time advances
      expect(clock.wallClockMs()).toBe(1702648801000);
    });
  });

  describe('environment resolution', () => {
    it('uses performance.now when available', () => {
      let perfTime = 1000;
      const mockPerformance = {
        now: () => perfTime,
      };

      const clock = createHighResolutionClock({
        environment: {
          performance: mockPerformance,
          process: null,
        },
      });

      expect(clock.now()).toBe(0);

      perfTime = 1100;
      expect(clock.now()).toBe(100);
    });

    it('falls back to dateNow when performance is null', () => {
      let dateTime = 1000;
      const clock = createHighResolutionClock({
        environment: {
          performance: null,
          dateNow: () => dateTime,
        },
      });

      expect(clock.now()).toBe(0);

      dateTime = 1050;
      expect(clock.now()).toBe(50);
    });

    it('uses default Date.now when no dateNow override', () => {
      // This test verifies the default behavior works
      const clock = createHighResolutionClock({
        environment: {
          performance: null,
          process: null,
          // No dateNow override - should use Date.now
        },
      });

      const t1 = clock.wallClockMs();
      expect(typeof t1).toBe('number');
      expect(t1).toBeGreaterThan(0);
    });

    it('distinguishes undefined (use default) from null (disable)', () => {
      // When performance is undefined, use globalThis.performance
      // When performance is null, explicitly disable it

      let dateTime = 5000;
      const clock = createHighResolutionClock({
        environment: {
          performance: null, // Explicitly disable
          dateNow: () => dateTime,
        },
      });

      // Should use dateNow since performance is disabled
      expect(clock.now()).toBe(0);
      dateTime = 5100;
      expect(clock.now()).toBe(100);
    });

    it('uses globalThis defaults when no environment override provided', () => {
      // When no environment object is passed at all, should use globalThis defaults
      // This exercises the fallback path in resolveEnvironment
      const clock = createHighResolutionClock();

      // Should be able to read time (using whatever globalThis provides)
      const t1 = clock.now();
      expect(typeof t1).toBe('number');

      // wallClockMs should return current time
      const wall = clock.wallClockMs();
      expect(typeof wall).toBe('number');
      expect(wall).toBeGreaterThan(0);
    });

    it('uses globalThis.performance when environment key not present', () => {
      // Environment object exists but doesn't have performance key
      // Should fall back to globalThis.performance
      const clock = createHighResolutionClock({
        environment: {
          // performance not specified - should use globalThis.performance
          // process not specified - should use globalThis.process
        },
      });

      const t1 = clock.now();
      expect(typeof t1).toBe('number');
    });
  });

  describe('edge cases', () => {
    it('handles very large time values', () => {
      const largeTime = Number.MAX_SAFE_INTEGER - 1000;
      const clock = createHighResolutionClock({
        readMs: () => largeTime,
      });

      expect(clock.now()).toBe(0);
    });

    it('throws on non-finite values in msToNs conversion', () => {
      const clock = createHighResolutionClock({
        readMs: () => Number.POSITIVE_INFINITY,
        environment: { process: null },
      });

      // First now() is 0 (Infinity - Infinity = NaN, but origin capture happens first)
      // This is a bit tricky - the origin is captured as Infinity
      // So subsequent calls return NaN, which when converted to ns throws
      expect(() => clock.hrtime()).toThrow('non-finite');
    });

    it('works with zero origin', () => {
      const time = 100;
      const clock = createHighResolutionClock({
        readMs: () => time,
        originMs: 0,
      });

      expect(clock.now()).toBe(100);
    });

    it('each clock instance has independent state', () => {
      let time = 1000;
      const readMs = () => time;

      const clock1 = createHighResolutionClock({ readMs });
      time = 1100;
      const clock2 = createHighResolutionClock({ readMs });

      // clock1 origin = 1000, clock2 origin = 1100
      time = 1200;
      expect(clock1.now()).toBe(200); // 1200 - 1000
      expect(clock2.now()).toBe(100); // 1200 - 1100
    });
  });
});
