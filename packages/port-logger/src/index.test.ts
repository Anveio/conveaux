/**
 * Tests for port-logger.
 */

import type { OutChannel } from '@conveaux/contract-outchannel';
import type { WallClock } from '@conveaux/contract-wall-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  ANSI_BG_COLORS,
  ANSI_COLORS,
  ANSI_RESET,
  ANSI_STYLES,
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
  LOG_LEVEL_PRIORITY,
  MINIMAL_THEME,
  PRESET_THEMES,
  createColorEnvironment,
  createJsonFormatter,
  createLogger,
  createPrettyFormatter,
  isLevelEnabled,
  serializeError,
} from './index.js';

// Helper to get first line and parse as JSON (fails test if missing)
function getFirstLine(lines: string[]): string {
  const line = lines[0];
  if (line === undefined) {
    throw new Error('Expected at least one line in output');
  }
  return line;
}

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

// Inline mock for WallClock with fixed time
function createMockClock(timestamp: string): WallClock {
  const date = new Date(timestamp);
  return {
    nowMs: () => date.getTime(),
  };
}

describe('createLogger', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: WallClock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should log trace messages', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.trace('trace message');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('trace');
    expect(entry.message).toBe('trace message');
    expect(entry.timestamp).toBe('2024-12-15T10:30:00.000Z');
  });

  it('should log debug messages', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.debug('test message');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('debug');
    expect(entry.message).toBe('test message');
    expect(entry.timestamp).toBe('2024-12-15T10:30:00.000Z');
  });

  it('should log info messages', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.info('info message');

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('info');
    expect(entry.message).toBe('info message');
  });

  it('should log warn messages', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.warn('warning');

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('warn');
  });

  it('should log error messages', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.error('error occurred');

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('error');
  });

  it('should log fatal messages', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.fatal('fatal error');

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('fatal');
    expect(entry.message).toBe('fatal error');
  });

  it('should include context fields in log entry', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.info('request handled', { userId: '123', duration: 45 });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.userId).toBe('123');
    expect(entry.duration).toBe(45);
  });

  it('should include trace context', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.info('traced operation', {
      trace: {
        traceId: 'trace-123',
        spanId: 'span-456',
      },
    });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.trace).toEqual({
      traceId: 'trace-123',
      spanId: 'span-456',
    });
  });

  it('should append newline to each log entry', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    logger.info('message');

    expect(getFirstLine(mockChannel.lines).endsWith('\n')).toBe(true);
  });

  describe('child logger', () => {
    it('should create child logger with bound context', () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
      const child = logger.child({ requestId: 'req-1' });

      child.info('child message');

      const entry = JSON.parse(getFirstLine(mockChannel.lines));
      expect(entry.requestId).toBe('req-1');
      expect(entry.message).toBe('child message');
    });

    it('should merge child context with log context', () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
      const child = logger.child({ requestId: 'req-1' });

      child.info('message', { extra: 'data' });

      const entry = JSON.parse(getFirstLine(mockChannel.lines));
      expect(entry.requestId).toBe('req-1');
      expect(entry.extra).toBe('data');
    });

    it('should allow nested child loggers', () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
      const child1 = logger.child({ level1: 'a' });
      const child2 = child1.child({ level2: 'b' });

      child2.info('nested message');

      const entry = JSON.parse(getFirstLine(mockChannel.lines));
      expect(entry.level1).toBe('a');
      expect(entry.level2).toBe('b');
    });

    it('should override bound context with log context', () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
      const child = logger.child({ key: 'bound' });

      child.info('message', { key: 'override' });

      const entry = JSON.parse(getFirstLine(mockChannel.lines));
      expect(entry.key).toBe('override');
    });

    it('child logger should support all 6 log levels', () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
      const child = logger.child({ component: 'test' });

      child.trace('t');
      child.debug('d');
      child.info('i');
      child.warn('w');
      child.error('e');
      child.fatal('f');

      expect(mockChannel.lines).toHaveLength(6);
    });
  });

  describe('flush', () => {
    it('should return a promise that resolves', async () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

      // flush() is a no-op for sync logger but should return a resolved promise
      await expect(logger.flush()).resolves.toBeUndefined();
    });

    it('child logger flush should return a promise that resolves', async () => {
      const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
      const child = logger.child({ component: 'test' });

      await expect(child.flush()).resolves.toBeUndefined();
    });
  });
});

describe('minLevel filtering', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: WallClock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should log all 6 levels when minLevel is trace', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'trace' },
    });

    logger.trace('trace msg');
    logger.debug('debug msg');
    logger.info('info msg');
    logger.warn('warn msg');
    logger.error('error msg');
    logger.fatal('fatal msg');

    expect(mockChannel.lines).toHaveLength(6);
  });

  it('should suppress trace when minLevel is debug', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'debug' },
    });

    logger.trace('should be suppressed');
    logger.debug('should appear');
    logger.info('should appear');
    logger.warn('should appear');
    logger.error('should appear');
    logger.fatal('should appear');

    expect(mockChannel.lines).toHaveLength(5);
  });

  it('should suppress trace and debug when minLevel is info', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'info' },
    });

    logger.trace('should be suppressed');
    logger.debug('should be suppressed');
    logger.info('should appear');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('info');
  });

  it('should suppress trace, debug, and info when minLevel is warn', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'warn' },
    });

    logger.trace('suppressed');
    logger.debug('suppressed');
    logger.info('suppressed');
    logger.warn('should appear');
    logger.error('should appear');
    logger.fatal('should appear');

    expect(mockChannel.lines).toHaveLength(3);
  });

  it('should only log error and fatal when minLevel is error', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'error' },
    });

    logger.trace('suppressed');
    logger.debug('suppressed');
    logger.info('suppressed');
    logger.warn('suppressed');
    logger.error('should appear');
    logger.fatal('should appear');

    expect(mockChannel.lines).toHaveLength(2);
  });

  it('should only log fatal when minLevel is fatal', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'fatal' },
    });

    logger.trace('suppressed');
    logger.debug('suppressed');
    logger.info('suppressed');
    logger.warn('suppressed');
    logger.error('suppressed');
    logger.fatal('should appear');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.level).toBe('fatal');
  });

  it('should default to trace level when no options provided', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
    });

    logger.trace('should appear');
    logger.debug('should appear');

    expect(mockChannel.lines).toHaveLength(2);
  });

  it('should apply minLevel to child loggers', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { minLevel: 'warn' },
    });
    const child = logger.child({ component: 'test' });

    child.trace('suppressed');
    child.debug('suppressed');
    child.info('suppressed');
    child.warn('should appear');

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.component).toBe('test');
  });
});

describe('error serialization', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: WallClock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should serialize basic Error', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const error = new Error('Something went wrong');

    logger.error('operation failed', { error });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.error).toBeDefined();
    expect(entry.error.name).toBe('Error');
    expect(entry.error.message).toBe('Something went wrong');
    expect(entry.error.stack).toBeDefined();
  });

  it('should serialize TypeError', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const error = new TypeError('Invalid type');

    logger.error('type error', { error });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
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

    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const error = new CustomError('Custom problem');

    logger.error('custom error', { error });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.error.name).toBe('CustomError');
    expect(entry.error.message).toBe('Custom problem');
  });

  it('should serialize Error with cause chain', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const rootCause = new Error('Root cause');
    const error = new Error('Wrapper error', { cause: rootCause });

    logger.error('error with cause', { error });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.error.name).toBe('Error');
    expect(entry.error.message).toBe('Wrapper error');
    expect(entry.error.cause).toBeDefined();
    expect(entry.error.cause.name).toBe('Error');
    expect(entry.error.cause.message).toBe('Root cause');
  });

  it('should handle deeply nested cause chain', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const level3 = new Error('Level 3');
    const level2 = new Error('Level 2', { cause: level3 });
    const level1 = new Error('Level 1', { cause: level2 });

    logger.error('deep chain', { error: level1 });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.error.message).toBe('Level 1');
    expect(entry.error.cause.message).toBe('Level 2');
    expect(entry.error.cause.cause.message).toBe('Level 3');
  });

  it('should ignore non-Error cause', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const error = new Error('Error with string cause', { cause: 'not an error' });

    logger.error('string cause', { error });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.error.cause).toBeUndefined();
  });

  it('should preserve other context fields alongside error', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const error = new Error('Test error');

    logger.error('failed operation', { error, userId: '123', operation: 'delete' });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.error).toBeDefined();
    expect(entry.userId).toBe('123');
    expect(entry.operation).toBe('delete');
  });
});

describe('edge cases', () => {
  let mockChannel: ReturnType<typeof createMockChannel>;
  let mockClock: WallClock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should handle empty context object', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

    logger.info('message', {});

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.message).toBe('message');
  });

  it('should handle undefined context', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

    logger.info('message', undefined);

    expect(mockChannel.lines).toHaveLength(1);
    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.message).toBe('message');
  });

  it('should handle special characters in message', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

    logger.info('Message with "quotes" and \\backslashes\\');

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.message).toContain('quotes');
    expect(entry.message).toContain('backslashes');
  });

  it('should handle deeply nested child loggers (4+ levels)', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });
    const child1 = logger.child({ l: 1 });
    const child2 = child1.child({ l: 2 });
    const child3 = child2.child({ l: 3 });
    const child4 = child3.child({ l: 4 });

    child4.info('deep message');

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.l).toBe(4); // Last level wins due to merge
    expect(entry.message).toBe('deep message');
  });

  it('should handle context with null values', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

    logger.info('test', { nullField: null });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.nullField).toBeNull();
  });

  it('should handle context with array values', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

    logger.info('test', { items: [1, 2, 3] });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.items).toEqual([1, 2, 3]);
  });

  it('should handle context with nested objects', () => {
    const logger = createLogger({ Date, channel: mockChannel, clock: mockClock });

    logger.info('test', { nested: { deep: { value: 'found' } } });

    const entry = JSON.parse(getFirstLine(mockChannel.lines));
    expect(entry.nested.deep.value).toBe('found');
  });
});

describe('channel error handling', () => {
  let mockClock: WallClock;

  beforeEach(() => {
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should propagate channel write errors', () => {
    const throwingChannel: OutChannel = {
      write(): void {
        throw new Error('Write failed');
      },
    };
    const logger = createLogger({ Date, channel: throwingChannel, clock: mockClock });

    expect(() => logger.info('test')).toThrow('Write failed');
  });
});

describe('LOG_LEVEL_PRIORITY export', () => {
  it('should export LOG_LEVEL_PRIORITY for all 6 levels', () => {
    expect(LOG_LEVEL_PRIORITY.trace).toBe(0);
    expect(LOG_LEVEL_PRIORITY.debug).toBe(1);
    expect(LOG_LEVEL_PRIORITY.info).toBe(2);
    expect(LOG_LEVEL_PRIORITY.warn).toBe(3);
    expect(LOG_LEVEL_PRIORITY.error).toBe(4);
    expect(LOG_LEVEL_PRIORITY.fatal).toBe(5);
  });

  it('should have trace as lowest priority and fatal as highest', () => {
    expect(LOG_LEVEL_PRIORITY.trace).toBeLessThan(LOG_LEVEL_PRIORITY.debug);
    expect(LOG_LEVEL_PRIORITY.debug).toBeLessThan(LOG_LEVEL_PRIORITY.info);
    expect(LOG_LEVEL_PRIORITY.info).toBeLessThan(LOG_LEVEL_PRIORITY.warn);
    expect(LOG_LEVEL_PRIORITY.warn).toBeLessThan(LOG_LEVEL_PRIORITY.error);
    expect(LOG_LEVEL_PRIORITY.error).toBeLessThan(LOG_LEVEL_PRIORITY.fatal);
  });
});

describe('isLevelEnabled utility', () => {
  it('should return true when current level equals min level', () => {
    expect(isLevelEnabled('info', 'info')).toBe(true);
    expect(isLevelEnabled('trace', 'trace')).toBe(true);
    expect(isLevelEnabled('fatal', 'fatal')).toBe(true);
  });

  it('should return true when current level is above min level', () => {
    expect(isLevelEnabled('info', 'debug')).toBe(true);
    expect(isLevelEnabled('error', 'info')).toBe(true);
    expect(isLevelEnabled('fatal', 'trace')).toBe(true);
  });

  it('should return false when current level is below min level', () => {
    expect(isLevelEnabled('debug', 'info')).toBe(false);
    expect(isLevelEnabled('info', 'warn')).toBe(false);
    expect(isLevelEnabled('trace', 'debug')).toBe(false);
    expect(isLevelEnabled('error', 'fatal')).toBe(false);
  });
});

describe('serializeError utility', () => {
  it('should serialize basic Error', () => {
    const error = new Error('Test error');
    const serialized = serializeError(error);

    expect(serialized.name).toBe('Error');
    expect(serialized.message).toBe('Test error');
    expect(serialized.stack).toBeDefined();
  });

  it('should serialize Error with cause chain', () => {
    const root = new Error('Root cause');
    const wrapper = new Error('Wrapper', { cause: root });
    const serialized = serializeError(wrapper);

    expect(serialized.message).toBe('Wrapper');
    expect(serialized.cause).toBeDefined();
    expect(serialized.cause?.message).toBe('Root cause');
  });

  it('should serialize Error with code property', () => {
    const error = new Error('File not found') as Error & { code: string };
    error.code = 'ENOENT';
    const serialized = serializeError(error);

    expect(serialized.code).toBe('ENOENT');
    expect(serialized.message).toBe('File not found');
  });

  it('should serialize Error with both code and cause', () => {
    const root = new Error('Permission denied') as Error & { code: string };
    root.code = 'EACCES';
    const wrapper = new Error('Operation failed', { cause: root }) as Error & { code: string };
    wrapper.code = 'EFAILED';

    const serialized = serializeError(wrapper);

    expect(serialized.code).toBe('EFAILED');
    expect(serialized.cause).toBeDefined();
    expect(serialized.cause?.code).toBe('EACCES');
  });

  it('should handle custom Error subclass', () => {
    class ValidationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
      }
    }

    const error = new ValidationError('Invalid input');
    const serialized = serializeError(error);

    expect(serialized.name).toBe('ValidationError');
    expect(serialized.message).toBe('Invalid input');
  });
});

describe('createJsonFormatter', () => {
  it('should format entry as JSON with newline', () => {
    const formatter = createJsonFormatter();
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Test message',
    };

    const output = formatter.format(entry);

    expect(output).toBe(
      '{"timestamp":"2024-12-15T10:30:00.000Z","level":"info","message":"Test message"}\n'
    );
  });

  it('should include all fields in JSON output', () => {
    const formatter = createJsonFormatter();
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Test',
      userId: '123',
      duration: 45,
    };

    const output = formatter.format(entry);
    const parsed = JSON.parse(output.trim());

    expect(parsed.userId).toBe('123');
    expect(parsed.duration).toBe(45);
  });
});

describe('createPrettyFormatter', () => {
  it('should format entry in human-readable format', () => {
    const formatter = createPrettyFormatter({ colors: false });
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Server started',
    };

    const output = formatter.format(entry);

    expect(output).toContain('10:30:00.000');
    expect(output).toContain('INFO');
    expect(output).toContain('Server started');
    expect(output.endsWith('\n')).toBe(true);
  });

  it('should include fields in output', () => {
    const formatter = createPrettyFormatter({ colors: false });
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Request',
      userId: '123',
    };

    const output = formatter.format(entry);

    expect(output).toContain('userId');
    expect(output).toContain('123');
  });

  it('should format all 6 log levels', () => {
    const formatter = createPrettyFormatter({ colors: false });
    const levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const;

    for (const level of levels) {
      const entry = {
        timestamp: '2024-12-15T10:30:00.000Z',
        level,
        message: 'test',
      };
      const output = formatter.format(entry);
      expect(output).toContain(level.toUpperCase());
    }
  });

  it('should format errors with stack trace', () => {
    const formatter = createPrettyFormatter({ colors: false });
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'error' as const,
      message: 'Request failed',
      error: {
        name: 'TypeError',
        message: 'Cannot read property',
        stack:
          'TypeError: Cannot read property\n    at Object.<anonymous> (/test.ts:10:5)\n    at Module._compile (node:internal/modules/cjs/loader:1234:14)',
      },
    };

    const output = formatter.format(entry);

    expect(output).toContain('TypeError: Cannot read property');
    expect(output).toContain('at Object.<anonymous>');
  });

  it('should include ANSI colors when enabled', () => {
    const formatter = createPrettyFormatter({ colors: true });
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Test',
    };

    const output = formatter.format(entry);

    // Check for ANSI escape codes
    expect(output).toContain('\x1b[');
  });

  it('should omit ANSI colors when disabled', () => {
    const formatter = createPrettyFormatter({ colors: false });
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Test',
    };

    const output = formatter.format(entry);

    // Should not contain ANSI escape codes
    expect(output).not.toContain('\x1b[');
  });

  it('should default to colors enabled', () => {
    const formatter = createPrettyFormatter();
    const entry = {
      timestamp: '2024-12-15T10:30:00.000Z',
      level: 'info' as const,
      message: 'Test',
    };

    const output = formatter.format(entry);

    expect(output).toContain('\x1b[');
  });
});

describe('logger with custom formatter', () => {
  let mockChannel: OutChannel & { lines: string[] };
  let mockClock: WallClock;

  beforeEach(() => {
    mockChannel = createMockChannel();
    mockClock = createMockClock('2024-12-15T10:30:00.000Z');
  });

  it('should use custom formatter when provided', () => {
    const customFormatter = {
      format: (entry: { level: string; message: string }) => `[${entry.level}] ${entry.message}\n`,
    };

    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { formatter: customFormatter },
    });

    logger.info('Hello');

    expect(mockChannel.lines[0]).toBe('[info] Hello\n');
  });

  it('should use pretty formatter for human-readable output', () => {
    const logger = createLogger({
      Date,
      channel: mockChannel,
      clock: mockClock,
      options: { formatter: createPrettyFormatter({ colors: false }) },
    });

    logger.info('Server started', { port: 3000 });

    const output = mockChannel.lines[0];
    expect(output).toContain('INFO');
    expect(output).toContain('Server started');
    expect(output).toContain('port');
    expect(output).toContain('3000');
  });
});

// =============================================================================
// Color Configuration Tests
// =============================================================================

describe('createColorEnvironment', () => {
  it('should detect NO_COLOR when set', () => {
    const env = createColorEnvironment({
      getEnv: (name) => (name === 'NO_COLOR' ? '1' : undefined),
    });

    expect(env.isNoColorSet()).toBe(true);
    expect(env.isForceColorSet()).toBe(false);
  });

  it('should detect NO_COLOR when set to empty string', () => {
    const env = createColorEnvironment({
      getEnv: (name) => (name === 'NO_COLOR' ? '' : undefined),
    });

    // NO_COLOR should be detected even with empty string (per spec)
    expect(env.isNoColorSet()).toBe(true);
  });

  it('should detect FORCE_COLOR when set', () => {
    const env = createColorEnvironment({
      getEnv: (name) => (name === 'FORCE_COLOR' ? '1' : undefined),
    });

    expect(env.isNoColorSet()).toBe(false);
    expect(env.isForceColorSet()).toBe(true);
  });

  it('should not detect FORCE_COLOR when set to 0', () => {
    const env = createColorEnvironment({
      getEnv: (name) => (name === 'FORCE_COLOR' ? '0' : undefined),
    });

    expect(env.isForceColorSet()).toBe(false);
  });

  it('should not detect FORCE_COLOR when set to empty string', () => {
    const env = createColorEnvironment({
      getEnv: (name) => (name === 'FORCE_COLOR' ? '' : undefined),
    });

    expect(env.isForceColorSet()).toBe(false);
  });

  it('should detect TTY support', () => {
    const env = createColorEnvironment({
      getEnv: () => undefined,
      isTTY: () => true,
    });

    expect(env.supportsColor()).toBe(true);
  });

  it('should default to no TTY support', () => {
    const env = createColorEnvironment({
      getEnv: () => undefined,
    });

    expect(env.supportsColor()).toBe(false);
  });
});

describe('createPrettyFormatter with ColorConfig', () => {
  const testEntry = {
    timestamp: '2024-12-15T10:30:00.000Z',
    level: 'info' as const,
    message: 'Test message',
  };

  describe('backward compatibility', () => {
    it('should work with colors: true (legacy)', () => {
      const formatter = createPrettyFormatter({ colors: true });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[');
    });

    it('should work with colors: false (legacy)', () => {
      const formatter = createPrettyFormatter({ colors: false });
      const output = formatter.format(testEntry);

      expect(output).not.toContain('\x1b[');
    });

    it('should work with no options', () => {
      const formatter = createPrettyFormatter();
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[');
    });
  });

  describe('colorConfig.enabled', () => {
    it('should disable colors when enabled: false', () => {
      const formatter = createPrettyFormatter({
        colorConfig: { enabled: false },
      });
      const output = formatter.format(testEntry);

      expect(output).not.toContain('\x1b[');
    });

    it('should enable colors when enabled: true', () => {
      const formatter = createPrettyFormatter({
        colorConfig: { enabled: true },
      });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[');
    });

    it('should prefer colorConfig over legacy colors option', () => {
      const formatter = createPrettyFormatter({
        colors: true,
        colorConfig: { enabled: false },
      });
      const output = formatter.format(testEntry);

      expect(output).not.toContain('\x1b[');
    });
  });

  describe('NO_COLOR support', () => {
    it('should disable colors when NO_COLOR is set', () => {
      const colorEnv = createColorEnvironment({
        getEnv: (name) => (name === 'NO_COLOR' ? '1' : undefined),
      });

      const formatter = createPrettyFormatter({ colorEnv });
      const output = formatter.format(testEntry);

      expect(output).not.toContain('\x1b[');
    });

    it('should allow disabling NO_COLOR respect', () => {
      const colorEnv = createColorEnvironment({
        getEnv: (name) => (name === 'NO_COLOR' ? '1' : undefined),
      });

      const formatter = createPrettyFormatter({
        colorConfig: { respectNoColor: false },
        colorEnv,
      });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[');
    });

    it('should override NO_COLOR when forceColor is true', () => {
      const colorEnv = createColorEnvironment({
        getEnv: (name) => (name === 'NO_COLOR' ? '1' : undefined),
      });

      const formatter = createPrettyFormatter({
        colorConfig: { forceColor: true },
        colorEnv,
      });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[');
    });

    it('should override NO_COLOR when FORCE_COLOR env is set', () => {
      const colorEnv = createColorEnvironment({
        getEnv: (name) => {
          if (name === 'NO_COLOR') return '1';
          if (name === 'FORCE_COLOR') return '1';
          return undefined;
        },
      });

      const formatter = createPrettyFormatter({ colorEnv });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[');
    });
  });

  describe('preset themes', () => {
    it('should use default theme', () => {
      const formatter = createPrettyFormatter({
        colorConfig: { theme: 'default' },
      });
      const output = formatter.format(testEntry);

      // Default info is green (\x1b[32m)
      expect(output).toContain('\x1b[32m');
    });

    it('should use high-contrast theme', () => {
      const formatter = createPrettyFormatter({
        colorConfig: { theme: 'high-contrast' },
      });
      const output = formatter.format(testEntry);

      // High-contrast info is brightGreen + bold (\x1b[92m and \x1b[1m)
      expect(output).toContain('\x1b[92m');
      expect(output).toContain('\x1b[1m');
    });

    it('should use minimal theme', () => {
      const formatter = createPrettyFormatter({
        colorConfig: { theme: 'minimal' },
      });
      const entry = {
        timestamp: '2024-12-15T10:30:00.000Z',
        level: 'info' as const,
        message: 'Test',
        fields: { key: 'value' },
      };
      const output = formatter.format(entry);

      // Minimal theme should not apply dim to fields
      // Fields should still have color for the level
      expect(output).toContain('\x1b[32m'); // info green
      // But should not have dim for fields (no \x1b[2m on the fields part)
    });
  });

  describe('custom themes', () => {
    it('should apply custom level colors', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: 'brightMagenta' },
          },
        },
      });
      const output = formatter.format(testEntry);

      // brightMagenta is \x1b[95m
      expect(output).toContain('\x1b[95m');
    });

    it('should apply custom styles', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: 'green', styles: ['bold', 'underline'] },
          },
        },
      });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[32m'); // green
      expect(output).toContain('\x1b[1m'); // bold
      expect(output).toContain('\x1b[4m'); // underline
    });

    it('should apply background colors', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: 'white', background: 'blue' },
          },
        },
      });
      const output = formatter.format(testEntry);

      expect(output).toContain('\x1b[37m'); // white foreground
      expect(output).toContain('\x1b[44m'); // blue background
    });
  });

  describe('level overrides', () => {
    it('should override specific levels on top of theme', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: 'default',
          levels: {
            fatal: { color: 'brightWhite', background: 'red', styles: ['bold'] },
          },
        },
      });
      const fatalEntry = {
        timestamp: '2024-12-15T10:30:00.000Z',
        level: 'fatal' as const,
        message: 'System crash',
      };
      const output = formatter.format(fatalEntry);

      expect(output).toContain('\x1b[97m'); // brightWhite
      expect(output).toContain('\x1b[41m'); // red background
      expect(output).toContain('\x1b[1m'); // bold
    });
  });

  describe('256-color support', () => {
    it('should render 256-color foreground', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: '256', index: 196 } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // 256 color format: \x1b[38;5;{index}m
      expect(output).toContain('\x1b[38;5;196m');
    });

    it('should render 256-color background', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { background: { type: '256', index: 21 } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // 256 color background: \x1b[48;5;{index}m
      expect(output).toContain('\x1b[48;5;21m');
    });

    it('should clamp invalid 256-color index', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: '256', index: 300 } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // Should clamp to 255
      expect(output).toContain('\x1b[38;5;255m');
    });
  });

  describe('RGB color support', () => {
    it('should render RGB foreground', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: 'rgb', r: 255, g: 100, b: 50 } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // RGB format: \x1b[38;2;{r};{g};{b}m
      expect(output).toContain('\x1b[38;2;255;100;50m');
    });

    it('should render RGB background', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { background: { type: 'rgb', r: 0, g: 50, b: 100 } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // RGB background: \x1b[48;2;{r};{g};{b}m
      expect(output).toContain('\x1b[48;2;0;50;100m');
    });

    it('should clamp invalid RGB values', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: 'rgb', r: 300, g: -10, b: 128.7 } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // Should clamp to valid range and floor
      expect(output).toContain('\x1b[38;2;255;0;128m');
    });
  });

  describe('hex color support', () => {
    it('should render hex color with hash', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: 'hex', value: '#FF5733' } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // Hex converts to RGB: FF=255, 57=87, 33=51
      expect(output).toContain('\x1b[38;2;255;87;51m');
    });

    it('should render hex color without hash', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: 'hex', value: 'aabbcc' } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // Hex converts to RGB: aa=170, bb=187, cc=204
      expect(output).toContain('\x1b[38;2;170;187;204m');
    });

    it('should handle invalid hex gracefully', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            info: { color: { type: 'hex', value: 'invalid' } },
          },
        },
      });
      const output = formatter.format(testEntry);

      // Should not crash, just no color applied for that spec
      expect(output).toContain('INFO');
    });
  });

  describe('error formatting with themes', () => {
    it('should apply errorText style to error messages', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            errorText: { color: 'brightRed', styles: ['bold'] },
          },
        },
      });
      const entry = {
        timestamp: '2024-12-15T10:30:00.000Z',
        level: 'error' as const,
        message: 'Failed',
        error: {
          name: 'Error',
          message: 'Something went wrong',
        },
      };
      const output = formatter.format(entry);

      expect(output).toContain('\x1b[91m'); // brightRed
      expect(output).toContain('\x1b[1m'); // bold
    });

    it('should apply stackTrace style to stack frames', () => {
      const formatter = createPrettyFormatter({
        colorConfig: {
          theme: {
            stackTrace: { color: 'gray' },
          },
        },
      });
      const entry = {
        timestamp: '2024-12-15T10:30:00.000Z',
        level: 'error' as const,
        message: 'Failed',
        error: {
          name: 'Error',
          message: 'Oops',
          stack: 'Error: Oops\n    at test.ts:10:5\n    at run.ts:20:3',
        },
      };
      const output = formatter.format(entry);

      expect(output).toContain('\x1b[90m'); // gray for stack
    });
  });
});

describe('exported theme constants', () => {
  it('should export DEFAULT_THEME', () => {
    expect(DEFAULT_THEME).toBeDefined();
    expect(DEFAULT_THEME.info).toEqual({ color: 'green' });
    expect(DEFAULT_THEME.error).toEqual({ color: 'red' });
    expect(DEFAULT_THEME.fatal).toEqual({ color: 'magenta', styles: ['bold'] });
  });

  it('should export HIGH_CONTRAST_THEME', () => {
    expect(HIGH_CONTRAST_THEME).toBeDefined();
    expect(HIGH_CONTRAST_THEME.info).toEqual({ color: 'brightGreen', styles: ['bold'] });
    expect(HIGH_CONTRAST_THEME.fatal).toEqual({
      color: 'brightWhite',
      background: 'red',
      styles: ['bold'],
    });
  });

  it('should export MINIMAL_THEME', () => {
    expect(MINIMAL_THEME).toBeDefined();
    expect(MINIMAL_THEME.timestamp).toEqual({});
    expect(MINIMAL_THEME.fields).toEqual({});
  });

  it('should export PRESET_THEMES', () => {
    expect(PRESET_THEMES).toBeDefined();
    expect(PRESET_THEMES.default).toBe(DEFAULT_THEME);
    expect(PRESET_THEMES['high-contrast']).toBe(HIGH_CONTRAST_THEME);
    expect(PRESET_THEMES.minimal).toBe(MINIMAL_THEME);
  });

  it('should export ANSI constants', () => {
    expect(ANSI_RESET).toBe('\x1b[0m');
    expect(ANSI_COLORS.red).toBe('\x1b[31m');
    expect(ANSI_BG_COLORS.blue).toBe('\x1b[44m');
    expect(ANSI_STYLES.bold).toBe('\x1b[1m');
  });
});
