import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEphemeralScheduler } from './index.js';

function createScheduler() {
  return createEphemeralScheduler({
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  });
}

describe('createEphemeralScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('delay', () => {
    it('schedules callback after delay', () => {
      const scheduler = createScheduler();
      const callback = vi.fn();

      scheduler.delay(callback, 1000);

      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('removes from pending when callback executes', () => {
      const scheduler = createScheduler();

      scheduler.delay(() => {}, 1000);
      expect(scheduler.pendingCount).toBe(1);

      vi.advanceTimersByTime(1000);
      expect(scheduler.pendingCount).toBe(0);
    });

    it('cancel() prevents execution', () => {
      const scheduler = createScheduler();
      const callback = vi.fn();

      const handle = scheduler.delay(callback, 1000);
      handle.cancel();

      vi.advanceTimersByTime(1000);
      expect(callback).not.toHaveBeenCalled();
      expect(scheduler.pendingCount).toBe(0);
    });

    it('cancel() is idempotent', () => {
      const scheduler = createScheduler();

      const handle = scheduler.delay(() => {}, 1000);
      handle.cancel();
      handle.cancel();
      handle.cancel();

      expect(scheduler.pendingCount).toBe(0);
    });

    it('cancel() after execution is a no-op', () => {
      const scheduler = createScheduler();

      const handle = scheduler.delay(() => {}, 1000);
      vi.advanceTimersByTime(1000);

      handle.cancel(); // Should not throw
      expect(scheduler.pendingCount).toBe(0);
    });
  });

  describe('interval', () => {
    it('fires repeatedly at interval', () => {
      const scheduler = createScheduler();
      const callback = vi.fn();

      scheduler.interval(callback, 100);

      vi.advanceTimersByTime(350);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('immediate option executes callback synchronously', () => {
      const scheduler = createScheduler();
      const callback = vi.fn();

      scheduler.interval(callback, 100, { immediate: true });

      expect(callback).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(100);
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('cancel() stops interval', () => {
      const scheduler = createScheduler();
      const callback = vi.fn();

      const handle = scheduler.interval(callback, 100);
      vi.advanceTimersByTime(250);
      expect(callback).toHaveBeenCalledTimes(2);

      handle.cancel();
      vi.advanceTimersByTime(200);
      expect(callback).toHaveBeenCalledTimes(2); // No more calls
      expect(scheduler.pendingCount).toBe(0);
    });

    it('cancel() is idempotent', () => {
      const scheduler = createScheduler();

      const handle = scheduler.interval(() => {}, 100);
      handle.cancel();
      handle.cancel();

      expect(scheduler.pendingCount).toBe(0);
    });
  });

  describe('pendingCount', () => {
    it('tracks both timeouts and intervals', () => {
      const scheduler = createScheduler();

      scheduler.delay(() => {}, 1000);
      scheduler.delay(() => {}, 2000);
      scheduler.interval(() => {}, 100);

      expect(scheduler.pendingCount).toBe(3);
    });

    it('updates when tasks complete or cancel', () => {
      const scheduler = createScheduler();

      const h1 = scheduler.delay(() => {}, 1000);
      const h2 = scheduler.interval(() => {}, 100);

      expect(scheduler.pendingCount).toBe(2);

      h1.cancel();
      expect(scheduler.pendingCount).toBe(1);

      h2.cancel();
      expect(scheduler.pendingCount).toBe(0);
    });
  });

  describe('dispose', () => {
    it('cancels all pending tasks', () => {
      const scheduler = createScheduler();
      const callback = vi.fn();

      scheduler.delay(callback, 1000);
      scheduler.delay(callback, 2000);
      scheduler.interval(callback, 100);

      scheduler.dispose();

      vi.advanceTimersByTime(5000);
      expect(callback).not.toHaveBeenCalled();
      expect(scheduler.pendingCount).toBe(0);
    });

    it('returns count of cancelled tasks', () => {
      const scheduler = createScheduler();

      scheduler.delay(() => {}, 1000);
      scheduler.delay(() => {}, 2000);
      scheduler.interval(() => {}, 100);

      expect(scheduler.dispose()).toBe(3);
    });

    it('returns 0 when no tasks pending', () => {
      const scheduler = createScheduler();
      expect(scheduler.dispose()).toBe(0);
    });

    it('is idempotent', () => {
      const scheduler = createScheduler();

      scheduler.delay(() => {}, 1000);

      expect(scheduler.dispose()).toBe(1);
      expect(scheduler.dispose()).toBe(0);
    });

    it('allows scheduling new tasks after dispose', () => {
      const scheduler = createScheduler();

      scheduler.delay(() => {}, 1000);
      scheduler.dispose();

      scheduler.delay(() => {}, 2000);
      expect(scheduler.pendingCount).toBe(1);
    });
  });
});
