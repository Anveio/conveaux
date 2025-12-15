/**
 * Tests for port-logger.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createLogger } from './index.js';
import type { OutChannel } from '@conveaux/contract-outchannel';
import type { Clock } from '@conveaux/contract-clock';

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
  return {
    now: () => date,
    timestamp: () => timestamp,
    epochMs: () => date.getTime(),
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
