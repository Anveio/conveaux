/**
 * Tests for port-logger.
 */

import type { Clock } from '@conveaux/contract-clock';
import type { OutChannel } from '@conveaux/contract-outchannel';
import { beforeEach, describe, expect, it } from 'vitest';
import { LOG_LEVEL_PRIORITY, createLogger } from './index.js';

// Inline mock for OutChannel that captures writes
function createMockChannel(): OutChannel & { lines: string[] } {
  const lines: string[] = [];
  return {
    lines,
    write(data: string): void {
      lines.push(data);
    },
  };
}

// Inline mock for Clock with fixed time
function createMockClock(timestamp: string): Clock {
  const date = new Date(timestamp);
  let monotonicMs = 0;
  return {
    now: () => monotonicMs++,
    hrtime: () => BigInt(monotonicMs) * 1_000_000n,
    wallClockMs: () => date.getTime(),
  };
}

describe('createLogger', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: Clock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should log debug messages', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.debug('test message');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.level).toBe('debug');
    expect(entry.message).toBe('test message');
    expect(entry.timestamp).toBe('2024-12-15T10:30:00.000Z');
  });

  it('should log info messages', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.info('info message');

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('info message');
  });

  it('should log warn messages', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.warn('warning');

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.level).toBe('warn');
  });

  it('should log error messages', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.error('error occurred');

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.level).toBe('error');
  });

  it('should include context fields in log entry', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.info('request handled', { userId: '123', duration: 45 });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.userId).toBe('123');
    expect(entry.duration).toBe(45);
  });

  it('should include trace context', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.info('traced operation', {
      trace: {
        traceId: 'trace-123',
        spanId: 'span-456',
      },
    });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.trace).toEqual({
      traceId: 'trace-123',
      spanId: 'span-456',
    });
  });

  it('should append newline to each log entry', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    logger.info('message');

    expect(mockChannel.lines[0].endsWith('\n')).toBe(true);
  });

  describe('child logger', () => {
    it('should create child logger with bound context', () => {
      const logger = createLogger({ channel: mockChannel, clock: mockClock });
      const child = logger.child!({ requestId: 'req-1' });

      child.info('child message');

      const entry = JSON.parse(mockChannel.lines[0]);
      expect(entry.requestId).toBe('req-1');
      expect(entry.message).toBe('child message');
    });

    it('should merge child context with log context', () => {
      const logger = createLogger({ channel: mockChannel, clock: mockClock });
      const child = logger.child!({ requestId: 'req-1' });

      child.info('message', { extra: 'data' });

      const entry = JSON.parse(mockChannel.lines[0]);
      expect(entry.requestId).toBe('req-1');
      expect(entry.extra).toBe('data');
    });

    it('should allow nested child loggers', () => {
      const logger = createLogger({ channel: mockChannel, clock: mockClock });
      const child1 = logger.child!({ level1: 'a' });
      const child2 = child1.child!({ level2: 'b' });

      child2.info('nested message');

      const entry = JSON.parse(mockChannel.lines[0]);
      expect(entry.level1).toBe('a');
      expect(entry.level2).toBe('b');
    });

    it('should override bound context with log context', () => {
      const logger = createLogger({ channel: mockChannel, clock: mockClock });
      const child = logger.child!({ key: 'bound' });

      child.info('message', { key: 'override' });

      const entry = JSON.parse(mockChannel.lines[0]);
      expect(entry.key).toBe('override');
    });
  });
});

describe('minLevel filtering', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: Clock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should log all levels when minLevel is debug', () => {
    const logger = createLogger({
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'debug' },
    });

    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');

    expect(mockChannel.lines).toHaveLength(4);
  });

  it('should suppress debug when minLevel is info', () => {
    const logger = createLogger({
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'info' },
    });

    logger.debug('should be suppressed');
    logger.info('should appear');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.level).toBe('info');
  });

  it('should suppress debug and info when minLevel is warn', () => {
    const logger = createLogger({
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'warn' },
    });

    logger.debug('suppressed');
    logger.info('suppressed');
    logger.warn('should appear');
    logger.error('should appear');

    expect(mockChannel.lines).toHaveLength(2);
  });

  it('should only log error when minLevel is error', () => {
    const logger = createLogger({
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'error' },
    });

    logger.debug('suppressed');
    logger.info('suppressed');
    logger.warn('suppressed');
    logger.error('should appear');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.level).toBe('error');
  });

  it('should default to debug level when no options provided', () => {
    const logger = createLogger({
      channel: mockChannel,
      clock: mockClock,
    });

    logger.debug('should appear');

    expect(mockChannel.lines).toHaveLength(1);
  });

  it('should apply minLevel to child loggers', () => {
    const logger = createLogger({
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'warn' },
    });
    const child = logger.child!({ component: 'test' });

    child.debug('suppressed');
    child.info('suppressed');
    child.warn('should appear');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.component).toBe('test');
  });
});

describe('error serialization', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: Clock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should serialize basic Error', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const error = new Error('Something went wrong');

    logger.error('operation failed', { error });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error).toBeDefined();
    expect(entry.error.name).toBe('Error');
    expect(entry.error.message).toBe('Something went wrong');
    expect(entry.error.stack).toBeDefined();
  });

  it('should serialize TypeError', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const error = new TypeError('Invalid type');

    logger.error('type error', { error });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error.name).toBe('TypeError');
    expect(entry.error.message).toBe('Invalid type');
  });

  it('should serialize custom Error subclass', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }

    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const error = new CustomError('Custom problem');

    logger.error('custom error', { error });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error.name).toBe('CustomError');
    expect(entry.error.message).toBe('Custom problem');
  });

  it('should serialize Error with cause chain', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const rootCause = new Error('Root cause');
    const error = new Error('Wrapper error', { cause: rootCause });

    logger.error('error with cause', { error });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error.name).toBe('Error');
    expect(entry.error.message).toBe('Wrapper error');
    expect(entry.error.cause).toBeDefined();
    expect(entry.error.cause.name).toBe('Error');
    expect(entry.error.cause.message).toBe('Root cause');
  });

  it('should handle deeply nested cause chain', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const level3 = new Error('Level 3');
    const level2 = new Error('Level 2', { cause: level3 });
    const level1 = new Error('Level 1', { cause: level2 });

    logger.error('deep chain', { error: level1 });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error.message).toBe('Level 1');
    expect(entry.error.cause.message).toBe('Level 2');
    expect(entry.error.cause.cause.message).toBe('Level 3');
  });

  it('should ignore non-Error cause', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const error = new Error('Error with string cause', { cause: 'not an error' });

    logger.error('string cause', { error });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error.cause).toBeUndefined();
  });

  it('should preserve other context fields alongside error', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const error = new Error('Test error');

    logger.error('failed operation', { error, userId: '123', operation: 'delete' });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.error).toBeDefined();
    expect(entry.userId).toBe('123');
    expect(entry.operation).toBe('delete');
  });
});

describe('edge cases', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: Clock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should handle empty context object', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });

    logger.info('message', {});

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.message).toBe('message');
  });

  it('should handle undefined context', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });

    logger.info('message', undefined);

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.message).toBe('message');
  });

  it('should handle special characters in message', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });

    logger.info('Message with "quotes" and \\backslashes\\');

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.message).toContain('quotes');
    expect(entry.message).toContain('backslashes');
  });

  it('should handle deeply nested child loggers (4+ levels)', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });
    const child1 = logger.child!({ l: 1 });
    const child2 = child1.child!({ l: 2 });
    const child3 = child2.child!({ l: 3 });
    const child4 = child3.child!({ l: 4 });

    child4.info('deep message');

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.l).toBe(4); // Last level wins due to merge
    expect(entry.message).toBe('deep message');
  });

  it('should handle context with null values', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });

    logger.info('test', { nullField: null });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.nullField).toBeNull();
  });

  it('should handle context with array values', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });

    logger.info('test', { items: [1, 2, 3] });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.items).toEqual([1, 2, 3]);
  });

  it('should handle context with nested objects', () => {
    const logger = createLogger({ channel: mockChannel, clock: mockClock });

    logger.info('test', { nested: { deep: { value: 'found' } } });

    const entry = JSON.parse(mockChannel.lines[0]);
    expect(entry.nested.deep.value).toBe('found');
  });
});

describe('channel error handling', () => {
  let mockClock: Clock;

  beforeEach(() => {
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should propagate channel write errors', () => {
    const throwingChannel: OutChannel = {
      write(): void {
        throw new Error('Write failed');
      },
    };
    const logger = createLogger({ channel: throwingChannel, clock: mockClock });

    expect(() => logger.info('test')).toThrow('Write failed');
  });
});

describe('LOG_LEVEL_PRIORITY export', () => {
  it('should export LOG_LEVEL_PRIORITY for consumer use', () => {
    expect(LOG_LEVEL_PRIORITY.debug).toBe(0);
    expect(LOG_LEVEL_PRIORITY.info).toBe(1);
    expect(LOG_LEVEL_PRIORITY.warn).toBe(2);
    expect(LOG_LEVEL_PRIORITY.error).toBe(3);
  });

  it('should have debug as lowest priority', () => {
    expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
    expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn);
    expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error);
  });
});
