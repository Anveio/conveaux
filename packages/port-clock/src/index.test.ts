/**
 * Tests for port-clock.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSystemClock } from './index.js';

describe('createSystemClock', () => {
  const fixedDate = new Date('2024-12-15T10:30:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return current date from now()', () => {
    const clock = createSystemClock();
    const result = clock.now();

    expect(result.getTime()).toBe(fixedDate.getTime());
  });

  it('should return ISO 8601 timestamp from timestamp()', () => {
    const clock = createSystemClock();
    const result = clock.timestamp();

    expect(result).toBe('2024-12-15T10:30:00.000Z');
  });

  it('should return epoch milliseconds from epochMs()', () => {
    const clock = createSystemClock();
    const result = clock.epochMs();

    expect(result).toBe(fixedDate.getTime());
  });

  it('should return new Date instances each call', () => {
    const clock = createSystemClock();
    const first = clock.now();
    const second = clock.now();

    expect(first).not.toBe(second);
    expect(first.getTime()).toBe(second.getTime());
  });
});
