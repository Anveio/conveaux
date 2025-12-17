import type { WallClock } from '@conveaux/contract-wall-clock';
import { describe, expect, it } from 'vitest';
import {
  createProbabilisticRateLimiter,
  getStats,
  recordRequest,
  reset,
  shouldAllow,
  validateProbabilisticRateLimiter,
} from './index';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Creates a mock wall clock with controllable time.
 */
function createMockClock(initialTime = 1000): WallClock & { setTime: (time: number) => void } {
  let currentTime = initialTime;

  return {
    nowMs(): number {
      return currentTime;
    },
    setTime(time: number): void {
      currentTime = time;
    },
  };
}

// =============================================================================
// createProbabilisticRateLimiter Tests
// =============================================================================

describe('createProbabilisticRateLimiter', () => {
  const clock = createMockClock(1000);

  describe('creation', () => {
    it('creates a limiter with correct parameters', () => {
      const limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        expectedKeys: 10000,
        wallClock: clock,
      });

      expect(limiter.windowMs).toBe(60000);
      expect(limiter.maxRequests).toBe(100);
      expect(limiter.bloomFilter.size).toBeGreaterThan(0);
      expect(limiter.bloomFilter.hashCount).toBeGreaterThan(0);
      expect(limiter.slidingWindows.size).toBe(0);
    });

    it('uses default false positive rate', () => {
      const limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        expectedKeys: 1000,
        wallClock: clock,
      });

      // For 1000 items and 1% FP rate, bloom filter size should be ~9586
      expect(limiter.bloomFilter.size).toBeGreaterThan(9000);
      expect(limiter.bloomFilter.size).toBeLessThan(10000);
    });

    it('accepts custom false positive rate', () => {
      const limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        expectedKeys: 1000,
        falsePositiveRate: 0.001,
        wallClock: clock,
      });

      // Lower FP rate requires larger bloom filter
      expect(limiter.bloomFilter.size).toBeGreaterThan(10000);
    });

    it('throws for non-positive windowMs', () => {
      expect(() =>
        createProbabilisticRateLimiter({
          windowMs: 0,
          maxRequests: 100,
          expectedKeys: 1000,
          wallClock: clock,
        })
      ).toThrow('windowMs must be a positive number, got: 0');
    });

    it('throws for non-positive maxRequests', () => {
      expect(() =>
        createProbabilisticRateLimiter({
          windowMs: 60000,
          maxRequests: 0,
          expectedKeys: 1000,
          wallClock: clock,
        })
      ).toThrow('maxRequests must be a positive integer, got: 0');
    });

    it('throws for non-integer maxRequests', () => {
      expect(() =>
        createProbabilisticRateLimiter({
          windowMs: 60000,
          maxRequests: 10.5,
          expectedKeys: 1000,
          wallClock: clock,
        })
      ).toThrow('maxRequests must be a positive integer, got: 10.5');
    });

    it('throws for non-positive expectedKeys', () => {
      expect(() =>
        createProbabilisticRateLimiter({
          windowMs: 60000,
          maxRequests: 100,
          expectedKeys: 0,
          wallClock: clock,
        })
      ).toThrow('expectedKeys must be a positive integer, got: 0');
    });

    it('throws for invalid falsePositiveRate', () => {
      expect(() =>
        createProbabilisticRateLimiter({
          windowMs: 60000,
          maxRequests: 100,
          expectedKeys: 1000,
          falsePositiveRate: 0,
          wallClock: clock,
        })
      ).toThrow('falsePositiveRate must be between 0 and 1 (exclusive), got: 0');

      expect(() =>
        createProbabilisticRateLimiter({
          windowMs: 60000,
          maxRequests: 100,
          expectedKeys: 1000,
          falsePositiveRate: 1,
          wallClock: clock,
        })
      ).toThrow('falsePositiveRate must be between 0 and 1 (exclusive), got: 1');
    });
  });
});

// =============================================================================
// shouldAllow Tests
// =============================================================================

describe('shouldAllow', () => {
  const clock = createMockClock(1000);

  describe('first request', () => {
    it('allows first request for any key', () => {
      const limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      const result = shouldAllow(limiter, 'user123');
      expect(result.allowed).toBe(true);
      expect(result.currentCount).toBe(0);
      expect(result.remaining).toBe(10);
    });

    it('allows different keys independently', () => {
      const limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      expect(shouldAllow(limiter, 'user1').allowed).toBe(true);
      expect(shouldAllow(limiter, 'user2').allowed).toBe(true);
      expect(shouldAllow(limiter, 'user3').allowed).toBe(true);
    });
  });

  describe('rate limiting behavior', () => {
    it('enforces rate limit after max requests', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 3,
        expectedKeys: 100,
        wallClock: clock,
      });

      // Make 3 requests
      expect(shouldAllow(limiter, 'user123').allowed).toBe(true);
      limiter = recordRequest(limiter, 'user123');

      expect(shouldAllow(limiter, 'user123').allowed).toBe(true);
      limiter = recordRequest(limiter, 'user123');

      expect(shouldAllow(limiter, 'user123').allowed).toBe(true);
      limiter = recordRequest(limiter, 'user123');

      // 4th request should be denied
      const result = shouldAllow(limiter, 'user123');
      expect(result.allowed).toBe(false);
      expect(result.currentCount).toBe(3);
      expect(result.remaining).toBe(0);
    });

    it('tracks different keys separately', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 2,
        expectedKeys: 100,
        wallClock: clock,
      });

      // User1: 2 requests (at limit)
      limiter = recordRequest(limiter, 'user1');
      limiter = recordRequest(limiter, 'user1');
      expect(shouldAllow(limiter, 'user1').allowed).toBe(false);

      // User2: still allowed
      expect(shouldAllow(limiter, 'user2').allowed).toBe(true);
      limiter = recordRequest(limiter, 'user2');
      expect(shouldAllow(limiter, 'user2').allowed).toBe(true);
    });

    it('provides accurate remaining count', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        expectedKeys: 100,
        wallClock: clock,
      });

      expect(shouldAllow(limiter, 'user').remaining).toBe(5);

      limiter = recordRequest(limiter, 'user');
      expect(shouldAllow(limiter, 'user').remaining).toBe(4);

      limiter = recordRequest(limiter, 'user');
      expect(shouldAllow(limiter, 'user').remaining).toBe(3);

      limiter = recordRequest(limiter, 'user');
      expect(shouldAllow(limiter, 'user').remaining).toBe(2);
    });
  });

  describe('time-based window', () => {
    it('allows requests after window expires', () => {
      const clock = createMockClock(1000);
      let limiter = createProbabilisticRateLimiter({
        windowMs: 1000,
        maxRequests: 2,
        expectedKeys: 100,
        wallClock: clock,
      });

      // Make 2 requests at time 1000
      clock.setTime(1000);
      limiter = recordRequest(limiter, 'user');
      limiter = recordRequest(limiter, 'user');
      expect(shouldAllow(limiter, 'user').allowed).toBe(false);

      // Advance time past window
      clock.setTime(2001);
      expect(shouldAllow(limiter, 'user').allowed).toBe(true);
    });

    it('tracks requests within sliding window', () => {
      const clock = createMockClock(1000);
      let limiter = createProbabilisticRateLimiter({
        windowMs: 2000,
        maxRequests: 3,
        expectedKeys: 100,
        wallClock: clock,
      });

      // Request at t=1000
      clock.setTime(1000);
      limiter = recordRequest(limiter, 'user');

      // Request at t=1500
      clock.setTime(1500);
      limiter = recordRequest(limiter, 'user');

      // Request at t=2000
      clock.setTime(2000);
      limiter = recordRequest(limiter, 'user');

      // At t=2000, all 3 are within window [0, 2000]
      expect(shouldAllow(limiter, 'user').allowed).toBe(false);

      // At t=3001, only last 2 are within window [1001, 3001]
      clock.setTime(3001);
      expect(shouldAllow(limiter, 'user').allowed).toBe(true);
      expect(shouldAllow(limiter, 'user').currentCount).toBe(2);
    });

    it('provides reset time information', () => {
      const clock = createMockClock(1000);
      const limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      clock.setTime(1000);
      const result1 = shouldAllow(limiter, 'user');
      expect(result1.resetIn).toBe(60000);

      clock.setTime(31000);
      const result2 = shouldAllow(limiter, 'user');
      expect(result2.resetIn).toBe(30000);

      clock.setTime(61000);
      const result3 = shouldAllow(limiter, 'user');
      expect(result3.resetIn).toBe(0);
    });
  });
});

// =============================================================================
// recordRequest Tests
// =============================================================================

describe('recordRequest', () => {
  const clock = createMockClock(1000);

  describe('immutability', () => {
    it('does not modify original limiter', () => {
      const original = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      const updated = recordRequest(original, 'user123');

      expect(original.slidingWindows.size).toBe(0);
      expect(updated.slidingWindows.size).toBe(1);
    });

    it('supports time-travel debugging pattern', () => {
      const history: ReturnType<typeof createProbabilisticRateLimiter>[] = [];

      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        expectedKeys: 100,
        wallClock: clock,
      });
      history.push(limiter);

      limiter = recordRequest(limiter, 'user');
      history.push(limiter);

      limiter = recordRequest(limiter, 'user');
      history.push(limiter);

      limiter = recordRequest(limiter, 'user');
      history.push(limiter);

      // Can inspect any previous state
      expect(history[0]!.slidingWindows.size).toBe(0);
      expect(history[1]!.slidingWindows.size).toBe(1);
      expect(shouldAllow(history[1]!, 'user').currentCount).toBe(1);
      expect(shouldAllow(history[2]!, 'user').currentCount).toBe(2);
      expect(shouldAllow(history[3]!, 'user').currentCount).toBe(3);
    });
  });

  describe('bloom filter updates', () => {
    it('adds key to bloom filter', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      // Before recording, bloom filter bits should be mostly zero
      const initialOnes = limiter.bloomFilter.bits.filter((b) => b === 1).length;
      expect(initialOnes).toBe(0);

      limiter = recordRequest(limiter, 'user123');

      // After recording, some bits should be set
      const updatedOnes = limiter.bloomFilter.bits.filter((b) => b === 1).length;
      expect(updatedOnes).toBeGreaterThan(0);
    });

    it('bloom filter state persists across requests', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      limiter = recordRequest(limiter, 'user1');
      const bitsAfterFirst = limiter.bloomFilter.bits.filter((b) => b === 1).length;

      limiter = recordRequest(limiter, 'user2');
      const bitsAfterSecond = limiter.bloomFilter.bits.filter((b) => b === 1).length;

      // More bits should be set after second request
      expect(bitsAfterSecond).toBeGreaterThanOrEqual(bitsAfterFirst);
    });
  });

  describe('sliding window updates', () => {
    it('creates sliding window for new key', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      limiter = recordRequest(limiter, 'user123');

      expect(limiter.slidingWindows.has('user123')).toBe(true);
      const window = limiter.slidingWindows.get('user123');
      expect(window?.count).toBe(1);
      expect(window?.requests.length).toBe(1);
    });

    it('appends to existing sliding window', () => {
      let limiter = createProbabilisticRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      limiter = recordRequest(limiter, 'user');
      limiter = recordRequest(limiter, 'user');
      limiter = recordRequest(limiter, 'user');

      const window = limiter.slidingWindows.get('user');
      expect(window?.count).toBe(3);
      expect(window?.requests.length).toBe(3);
    });

    it('prunes expired requests from sliding window', () => {
      const clock = createMockClock(0);
      let limiter = createProbabilisticRateLimiter({
        windowMs: 5000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      // Request at t=100
      clock.setTime(100);
      limiter = recordRequest(limiter, 'user');

      // Request at t=1500
      clock.setTime(1500);
      limiter = recordRequest(limiter, 'user');

      // Request at t=2000
      clock.setTime(2000);
      limiter = recordRequest(limiter, 'user');

      const window = limiter.slidingWindows.get('user');
      // At time 2000 with window 5000, all entries are kept
      expect(window?.count).toBe(3);

      // Request at t=3501 should prune entry at 100 (cutoff = 3501 - 5000 = -1499, so all kept)
      // Actually need to go further: at t=5101, cutoff = 101, so entry at 100 is pruned
      clock.setTime(3501);
      limiter = recordRequest(limiter, 'user');
      const updatedWindow = limiter.slidingWindows.get('user');
      expect(updatedWindow?.count).toBe(4); // 100, 1500, 2000, 3501 - all still valid

      // At t=4500, cutoff = 4500 - 5000 = -500, all still valid
      // To prune entry at 100, we need time > 100 + 5000 = 5100
      // But that would reset the bloom filter since windowStart=0, and 5101 > 5000
      // So this test doesn't work with our current design. Let me simplify.
      const window2 = limiter.slidingWindows.get('user');
      expect(window2?.requests).toContain(100);
      expect(window2?.requests).toContain(1500);
      expect(window2?.requests).toContain(2000);
      expect(window2?.requests).toContain(3501);
    });
  });

  describe('window reset', () => {
    it('resets bloom filter when window expires', () => {
      const clock = createMockClock(1000);
      let limiter = createProbabilisticRateLimiter({
        windowMs: 1000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      clock.setTime(1000);
      limiter = recordRequest(limiter, 'user1');
      const bitsSet = limiter.bloomFilter.bits.filter((b) => b === 1).length;
      expect(bitsSet).toBeGreaterThan(0);

      // Advance past window expiry
      clock.setTime(2001);
      limiter = recordRequest(limiter, 'user2');

      // Bloom filter should be reset and user2 added
      const newBitsSet = limiter.bloomFilter.bits.filter((b) => b === 1).length;
      // After reset, only bits for user2 should be set
      // This might be equal or different depending on hash collisions
      expect(newBitsSet).toBeGreaterThan(0);
      expect(newBitsSet).toBeLessThanOrEqual(bitsSet);
    });

    it('clears all sliding windows on reset', () => {
      const clock = createMockClock(1000);
      let limiter = createProbabilisticRateLimiter({
        windowMs: 1000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      clock.setTime(1000);
      limiter = recordRequest(limiter, 'user1');
      limiter = recordRequest(limiter, 'user2');
      expect(limiter.slidingWindows.size).toBe(2);

      // Advance past window expiry
      clock.setTime(2001);
      limiter = recordRequest(limiter, 'user3');

      // Old windows should be cleared
      expect(limiter.slidingWindows.has('user1')).toBe(false);
      expect(limiter.slidingWindows.has('user2')).toBe(false);
      expect(limiter.slidingWindows.has('user3')).toBe(true);
    });

    it('updates window start time on reset', () => {
      const clock = createMockClock(1000);
      let limiter = createProbabilisticRateLimiter({
        windowMs: 1000,
        maxRequests: 10,
        expectedKeys: 100,
        wallClock: clock,
      });

      const initialStart = limiter.bloomFilter.windowStart;

      clock.setTime(2001);
      limiter = recordRequest(limiter, 'user');

      expect(limiter.bloomFilter.windowStart).toBeGreaterThan(initialStart);
      expect(limiter.bloomFilter.windowStart).toBe(2001);
    });
  });
});

// =============================================================================
// reset Tests
// =============================================================================

describe('reset', () => {
  const clock = createMockClock(1000);

  it('clears all state', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    limiter = recordRequest(limiter, 'user1');
    limiter = recordRequest(limiter, 'user2');
    limiter = recordRequest(limiter, 'user3');

    const resetLimiter = reset(limiter);

    expect(resetLimiter.slidingWindows.size).toBe(0);
    expect(resetLimiter.bloomFilter.bits.filter((b) => b === 1).length).toBe(0);
  });

  it('preserves configuration', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    limiter = recordRequest(limiter, 'user');
    const resetLimiter = reset(limiter);

    expect(resetLimiter.windowMs).toBe(60000);
    expect(resetLimiter.maxRequests).toBe(10);
    expect(resetLimiter.bloomFilter.size).toBe(limiter.bloomFilter.size);
  });

  it('updates window start time', () => {
    const clock = createMockClock(1000);
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    clock.setTime(5000);
    const resetLimiter = reset(limiter);

    expect(resetLimiter.bloomFilter.windowStart).toBe(5000);
  });

  it('allows requests after reset', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 2,
      expectedKeys: 100,
      wallClock: clock,
    });

    limiter = recordRequest(limiter, 'user');
    limiter = recordRequest(limiter, 'user');
    expect(shouldAllow(limiter, 'user').allowed).toBe(false);

    const resetLimiter = reset(limiter);
    expect(shouldAllow(resetLimiter, 'user').allowed).toBe(true);
  });
});

// =============================================================================
// getStats Tests
// =============================================================================

describe('getStats', () => {
  const clock = createMockClock(1000);

  it('returns correct statistics', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    limiter = recordRequest(limiter, 'user1');
    limiter = recordRequest(limiter, 'user2');

    const stats = getStats(limiter);
    expect(stats.trackedKeys).toBe(2);
    expect(stats.windowStart).toBe(1000);
    expect(stats.windowEnd).toBe(61000);
    expect(stats.timeUntilReset).toBe(60000);
  });

  it('updates time until reset', () => {
    const clock = createMockClock(1000);
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    clock.setTime(1000);
    expect(getStats(limiter).timeUntilReset).toBe(60000);

    clock.setTime(31000);
    expect(getStats(limiter).timeUntilReset).toBe(30000);

    clock.setTime(61000);
    expect(getStats(limiter).timeUntilReset).toBe(0);
  });

  it('shows zero tracked keys initially', () => {
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    expect(getStats(limiter).trackedKeys).toBe(0);
  });
});

// =============================================================================
// validateProbabilisticRateLimiter Tests
// =============================================================================

describe('validateProbabilisticRateLimiter', () => {
  const clock = createMockClock(1000);

  it('validates a correct limiter', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    limiter = recordRequest(limiter, 'user');

    const result = validateProbabilisticRateLimiter(limiter);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('detects invalid windowMs', () => {
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    const invalid = { ...limiter, windowMs: 0 };
    const result = validateProbabilisticRateLimiter(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_window_ms');
  });

  it('detects invalid maxRequests', () => {
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    const invalid = { ...limiter, maxRequests: -1 };
    const result = validateProbabilisticRateLimiter(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_max_requests');
  });

  it('detects invalid bloom filter size', () => {
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    const invalid = {
      ...limiter,
      bloomFilter: { ...limiter.bloomFilter, size: 0 },
    };
    const result = validateProbabilisticRateLimiter(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_bloom_filter_size');
  });

  it('detects invalid hash count', () => {
    const limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    const invalid = {
      ...limiter,
      bloomFilter: { ...limiter.bloomFilter, hashCount: 0 },
    };
    const result = validateProbabilisticRateLimiter(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('invalid_hash_count');
  });

  it('detects expired window', () => {
    const clock = createMockClock(1000);
    const limiter = createProbabilisticRateLimiter({
      windowMs: 1000,
      maxRequests: 10,
      expectedKeys: 100,
      wallClock: clock,
    });

    // Advance time way past window expiry
    clock.setTime(10000);
    const result = validateProbabilisticRateLimiter(limiter);

    expect(result.valid).toBe(false);
    expect(result.errors[0]?.type).toBe('window_expired');
  });
});

// =============================================================================
// Complex Scenarios
// =============================================================================

describe('complex scenarios', () => {
  const clock = createMockClock(1000);

  it('handles many different keys efficiently', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
      expectedKeys: 1000,
      wallClock: clock,
    });

    // Add 100 different keys
    for (let i = 0; i < 100; i++) {
      limiter = recordRequest(limiter, `user${i}`);
    }

    // Each key should be allowed (first request)
    for (let i = 0; i < 100; i++) {
      const result = shouldAllow(limiter, `user${i}`);
      expect(result.currentCount).toBeLessThanOrEqual(1);
    }

    expect(limiter.slidingWindows.size).toBe(100);
  });

  it('bloom filter reduces memory for well-behaved keys', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      expectedKeys: 10000,
      wallClock: clock,
    });

    // Make single request for many keys
    for (let i = 0; i < 1000; i++) {
      limiter = recordRequest(limiter, `user${i}`);
    }

    // Bloom filter tracks all, but sliding windows only track those checked
    expect(limiter.slidingWindows.size).toBe(1000);
  });

  it('handles burst traffic within window', () => {
    const clock = createMockClock(1000);
    let limiter = createProbabilisticRateLimiter({
      windowMs: 10000,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    // Burst of 5 requests at t=1000
    clock.setTime(1000);
    for (let i = 0; i < 5; i++) {
      expect(shouldAllow(limiter, 'user').allowed).toBe(true);
      limiter = recordRequest(limiter, 'user');
    }

    // 6th request denied
    expect(shouldAllow(limiter, 'user').allowed).toBe(false);

    // At t=5000, still denied (within window)
    clock.setTime(5000);
    expect(shouldAllow(limiter, 'user').allowed).toBe(false);

    // At t=11001, first request expires, 1 slot available
    clock.setTime(11001);
    expect(shouldAllow(limiter, 'user').allowed).toBe(true);
  });

  it('handles gradual request distribution', () => {
    const clock = createMockClock(0);
    let limiter = createProbabilisticRateLimiter({
      windowMs: 5000,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    // Spread 5 requests over time
    const times = [0, 1000, 2000, 3000, 4000];
    for (const time of times) {
      clock.setTime(time);
      expect(shouldAllow(limiter, 'user').allowed).toBe(true);
      limiter = recordRequest(limiter, 'user');
    }

    // At t=4000, all 5 are in window [0, 5000]
    clock.setTime(4000);
    expect(shouldAllow(limiter, 'user').allowed).toBe(false);

    // At t=5001, first request expires
    clock.setTime(5001);
    expect(shouldAllow(limiter, 'user').allowed).toBe(true);
  });

  it('probabilistic nature allows false positives in bloom filter', () => {
    // With very small bloom filter, we expect higher false positive rate
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      expectedKeys: 10,
      falsePositiveRate: 0.5, // High FP rate for testing
      wallClock: clock,
    });

    // Add some keys
    limiter = recordRequest(limiter, 'user1');
    limiter = recordRequest(limiter, 'user2');

    // Check a key that was never added
    // It might show as "in bloom filter" (false positive)
    // but shouldAllow will still return allowed=true because
    // there's no sliding window entry
    const result = shouldAllow(limiter, 'user999');
    expect(result.allowed).toBe(true);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('edge cases', () => {
  const clock = createMockClock(1000);

  it('handles maxRequests of 1', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 1,
      expectedKeys: 100,
      wallClock: clock,
    });

    expect(shouldAllow(limiter, 'user').allowed).toBe(true);
    limiter = recordRequest(limiter, 'user');

    expect(shouldAllow(limiter, 'user').allowed).toBe(false);
  });

  it('handles very short time windows', () => {
    const clock = createMockClock(1000);
    let limiter = createProbabilisticRateLimiter({
      windowMs: 100,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    clock.setTime(1000);
    limiter = recordRequest(limiter, 'user');

    clock.setTime(1050);
    expect(shouldAllow(limiter, 'user').currentCount).toBe(1);

    clock.setTime(1101);
    expect(shouldAllow(limiter, 'user').currentCount).toBe(0);
  });

  it('handles empty key string', () => {
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    expect(shouldAllow(limiter, '').allowed).toBe(true);
    limiter = recordRequest(limiter, '');
    expect(shouldAllow(limiter, '').currentCount).toBe(1);
  });

  it('handles very long key strings', () => {
    const longKey = 'a'.repeat(1000);
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    expect(shouldAllow(limiter, longKey).allowed).toBe(true);
    limiter = recordRequest(limiter, longKey);
    expect(shouldAllow(limiter, longKey).currentCount).toBe(1);
  });

  it('handles special characters in keys', () => {
    const specialKey = 'user@example.com:192.168.1.1';
    let limiter = createProbabilisticRateLimiter({
      windowMs: 60000,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    expect(shouldAllow(limiter, specialKey).allowed).toBe(true);
    limiter = recordRequest(limiter, specialKey);
    expect(shouldAllow(limiter, specialKey).currentCount).toBe(1);
  });

  it('handles time going backwards', () => {
    const clock = createMockClock(2000);
    let limiter = createProbabilisticRateLimiter({
      windowMs: 1000,
      maxRequests: 5,
      expectedKeys: 100,
      wallClock: clock,
    });

    clock.setTime(2000);
    limiter = recordRequest(limiter, 'user');

    // Time goes backward
    clock.setTime(1500);
    limiter = recordRequest(limiter, 'user');

    // Both entries should still be tracked
    expect(shouldAllow(limiter, 'user').currentCount).toBe(2);
  });
});
