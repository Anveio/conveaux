import { describe, expect, it } from 'vitest';
import { createWallClock } from './index.js';

describe('createWallClock', () => {
  it('returns current time from Date.now by default', () => {
    const clock = createWallClock({ Date });
    const before = Date.now();
    const result = clock.nowMs();
    const after = Date.now();

    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });

  it('uses custom nowMs when provided', () => {
    let time = 1702648800000;
    const clock = createWallClock({ Date }, { nowMs: () => time });

    expect(clock.nowMs()).toBe(1702648800000);

    time += 1000;
    expect(clock.nowMs()).toBe(1702648801000);
  });

  it('returns consistent values on multiple calls', () => {
    const fixedTime = 1702648800000;
    const clock = createWallClock({ Date }, { nowMs: () => fixedTime });

    expect(clock.nowMs()).toBe(fixedTime);
    expect(clock.nowMs()).toBe(fixedTime);
    expect(clock.nowMs()).toBe(fixedTime);
  });

  it('each clock instance is independent', () => {
    let time1 = 1000;
    let time2 = 2000;

    const clock1 = createWallClock({ Date }, { nowMs: () => time1 });
    const clock2 = createWallClock({ Date }, { nowMs: () => time2 });

    expect(clock1.nowMs()).toBe(1000);
    expect(clock2.nowMs()).toBe(2000);

    time1 = 1500;
    time2 = 2500;

    expect(clock1.nowMs()).toBe(1500);
    expect(clock2.nowMs()).toBe(2500);
  });
});
