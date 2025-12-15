/**
 * Tests for port-instrumentation.
 */

import type { Span, SpanHandler } from '@conveaux/contract-instrumentation';
import type { LogContext, Logger } from '@conveaux/contract-logger';
import type { WallClock } from '@conveaux/contract-wall-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInstrumenter } from './index.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Get log entry at index, throwing if not found (fails test).
 */
function getLog(logs: MockLogEntry[], index: number): MockLogEntry {
  const entry = logs[index];
  if (!entry) {
    throw new Error(`Expected log entry at index ${index}, but only ${logs.length} entries exist`);
  }
  return entry;
}

/**
 * Get span at index, throwing if not found (fails test).
 */
function getSpan(spans: Span[], index: number): Span {
  const span = spans[index];
  if (!span) {
    throw new Error(`Expected span at index ${index}, but only ${spans.length} spans exist`);
  }
  return span;
}

// =============================================================================
// Inline Mocks
// =============================================================================

interface MockLogEntry {
  level: string;
  message: string;
  context?: LogContext;
}

/**
 * Mock Logger that captures all log calls.
 */
function createMockLogger(): Logger & { logs: MockLogEntry[] } {
  const logs: MockLogEntry[] = [];

  const logMethod = (level: string) => (message: string, context?: LogContext) => {
    logs.push({ level, message, context });
  };

  const mockLogger: Logger & { logs: MockLogEntry[] } = {
    logs,
    trace: logMethod('trace'),
    debug: logMethod('debug'),
    info: logMethod('info'),
    warn: logMethod('warn'),
    error: logMethod('error'),
    fatal: logMethod('fatal'),
    child: () => createMockLogger(),
    flush: async () => {},
  };

  return mockLogger;
}

/**
 * Mock WallClock with controllable time.
 */
function createMockClock(
  initialMs: number
): WallClock & { advance: (ms: number) => void; setTime: (ms: number) => void } {
  let currentMs = initialMs;
  return {
    nowMs: () => currentMs,
    advance: (ms: number) => {
      currentMs += ms;
    },
    setTime: (ms: number) => {
      currentMs = ms;
    },
  };
}

/**
 * Mock SpanHandler that captures span events.
 */
function createMockSpanHandler(): SpanHandler & { startedSpans: Span[]; endedSpans: Span[] } {
  const startedSpans: Span[] = [];
  const endedSpans: Span[] = [];
  return {
    startedSpans,
    endedSpans,
    onSpanStart: (span: Span) => startedSpans.push(span),
    onSpanEnd: (span: Span) => endedSpans.push(span),
  };
}

/**
 * Counter-based ID generator for deterministic tests.
 */
function createMockIdGenerator(): () => string {
  let counter = 0;
  return () => `id-${++counter}`;
}

// =============================================================================
// Tests
// =============================================================================

describe('createInstrumenter', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockClock: ReturnType<typeof createMockClock>;
  let mockGenerateId: ReturnType<typeof createMockIdGenerator>;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockClock = createMockClock(1702641000000); // 2024-12-15T10:30:00.000Z
    mockGenerateId = createMockIdGenerator();
  });

  describe('wrap - sync functions', () => {
    it('should instrument sync function and log success', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const add = instrumenter.wrap(
        (a: number, b: number) => {
          mockClock.advance(10); // Advance clock during execution
          return a + b;
        },
        { operation: 'add' }
      );

      const result = add(2, 3);

      expect(result).toBe(5);
      expect(mockLogger.logs).toHaveLength(1);
      const log = getLog(mockLogger.logs, 0);
      expect(log.level).toBe('debug');
      expect(log.message).toBe('add completed');
      expect(log.context?.durationMs).toBe(10);
      expect(log.context?.success).toBe(true);
      expect(log.context?.operation).toBe('add');
    });

    it('should instrument sync function and log error', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fail = instrumenter.wrap(
        () => {
          throw new Error('Sync error');
        },
        { operation: 'fail' }
      );

      mockClock.advance(5);
      expect(() => fail()).toThrow('Sync error');

      expect(mockLogger.logs).toHaveLength(1);
      const log = getLog(mockLogger.logs, 0);
      expect(log.level).toBe('error');
      expect(log.message).toBe('fail failed');
      expect(log.context?.success).toBe(false);
      expect(log.context?.error).toBeInstanceOf(Error);
    });

    it('should use function name when operation not provided', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      function myNamedFunction() {
        return 'result';
      }

      const wrapped = instrumenter.wrap(myNamedFunction);
      wrapped();

      expect(getLog(mockLogger.logs, 0).context?.operation).toBe('myNamedFunction');
    });

    it('should use anonymous when function has no name', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const wrapped = instrumenter.wrap(() => 'result');
      wrapped();

      expect(getLog(mockLogger.logs, 0).context?.operation).toBe('anonymous');
    });

    it('should preserve this binding', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const obj = {
        value: 42,
        getValue() {
          return this.value;
        },
      };

      obj.getValue = instrumenter.wrap(obj.getValue, { operation: 'getValue' });
      const result = obj.getValue();

      expect(result).toBe(42);
    });
  });

  describe('wrap - async functions', () => {
    it('should instrument async function and log success', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fetchData = instrumenter.wrap(
        async () => {
          mockClock.advance(20);
          return 'data';
        },
        { operation: 'fetchData' }
      );

      const result = await fetchData();

      expect(result).toBe('data');
      expect(mockLogger.logs).toHaveLength(1);
      const log = getLog(mockLogger.logs, 0);
      expect(log.level).toBe('debug');
      expect(log.message).toBe('fetchData completed');
      expect(log.context?.durationMs).toBe(20);
      expect(log.context?.success).toBe(true);
    });

    it('should instrument async function and log error', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const failAsync = instrumenter.wrap(
        async () => {
          mockClock.advance(15);
          throw new Error('Async error');
        },
        { operation: 'failAsync' }
      );

      await expect(failAsync()).rejects.toThrow('Async error');

      expect(mockLogger.logs).toHaveLength(1);
      const log = getLog(mockLogger.logs, 0);
      expect(log.level).toBe('error');
      expect(log.message).toBe('failAsync failed');
      expect(log.context?.durationMs).toBe(15);
      expect(log.context?.success).toBe(false);
    });

    it('should handle non-Error throws in async', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const throwString = instrumenter.wrap(
        async () => {
          throw 'string error';
        },
        { operation: 'throwString' }
      );

      await expect(throwString()).rejects.toBe('string error');

      const log = getLog(mockLogger.logs, 0);
      expect(log.context?.error).toBeInstanceOf(Error);
      expect((log.context?.error as Error).message).toBe('string error');
    });
  });

  describe('trace context', () => {
    it('should generate traceId and spanId', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fn = instrumenter.wrap(() => 'result', { operation: 'test' });
      fn();

      const trace = getLog(mockLogger.logs, 0).context?.trace;
      expect(trace).toBeDefined();
      // spanId is generated first, then traceId (when no parent)
      expect(trace?.spanId).toBe('id-1'); // First call to generateId
      expect(trace?.traceId).toBe('id-2'); // Second call to generateId
      expect(trace?.parentSpanId).toBeUndefined();
      expect(trace?.sampled).toBe(true);
    });

    it('should inherit traceId from parent span', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const parentSpan = instrumenter.startSpan('parent');
      const childFn = instrumenter.wrap(() => 'result', {
        operation: 'child',
        parentSpan,
      });
      childFn();

      const trace = getLog(mockLogger.logs, 0).context?.trace;
      expect(trace?.traceId).toBe(parentSpan.traceId);
      expect(trace?.parentSpanId).toBe(parentSpan.spanId);
    });
  });

  describe('options', () => {
    it('should respect rethrow: false', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fail = instrumenter.wrap(
        () => {
          throw new Error('Suppressed');
        },
        { operation: 'fail', rethrow: false }
      );

      const result = fail();

      expect(result).toBeUndefined();
      expect(getLog(mockLogger.logs, 0).level).toBe('error');
    });

    it('should respect rethrow: false for async', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const failAsync = instrumenter.wrap(
        async () => {
          throw new Error('Suppressed');
        },
        { operation: 'failAsync', rethrow: false }
      );

      const result = await failAsync();

      expect(result).toBeUndefined();
      expect(getLog(mockLogger.logs, 0).level).toBe('error');
    });

    it('should use custom successLevel', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fn = instrumenter.wrap(() => 'result', {
        operation: 'test',
        successLevel: 'info',
      });
      fn();

      expect(getLog(mockLogger.logs, 0).level).toBe('info');
    });

    it('should use custom failureLevel', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fn = instrumenter.wrap(
        () => {
          throw new Error('test');
        },
        { operation: 'test', failureLevel: 'fatal' }
      );

      expect(() => fn()).toThrow();
      expect(getLog(mockLogger.logs, 0).level).toBe('fatal');
    });

    it('should include custom context in logs', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fn = instrumenter.wrap(() => 'result', {
        operation: 'test',
        context: { userId: '123', action: 'read' },
      });
      fn();

      const log = getLog(mockLogger.logs, 0);
      expect(log.context?.userId).toBe('123');
      expect(log.context?.action).toBe('read');
    });
  });

  describe('execute and executeAsync', () => {
    it('should execute sync function once', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const result = instrumenter.execute(() => 'executed', { operation: 'oneOff' });

      expect(result).toBe('executed');
      expect(getLog(mockLogger.logs, 0).context?.operation).toBe('oneOff');
    });

    it('should executeAsync once', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const result = await instrumenter.executeAsync(async () => 'async result', {
        operation: 'asyncOneOff',
      });

      expect(result).toBe('async result');
      expect(getLog(mockLogger.logs, 0).context?.operation).toBe('asyncOneOff');
    });
  });

  describe('child instrumenter', () => {
    it('should create child with bound context', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const child = instrumenter.child({ requestId: 'req-1' });
      const fn = child.wrap(() => 'result', { operation: 'childOp' });
      fn();

      expect(getLog(mockLogger.logs, 0).context?.requestId).toBe('req-1');
    });

    it('should merge child context with operation context', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const child = instrumenter.child({ requestId: 'req-1' });
      const fn = child.wrap(() => 'result', {
        operation: 'test',
        context: { extra: 'data' },
      });
      fn();

      const log = getLog(mockLogger.logs, 0);
      expect(log.context?.requestId).toBe('req-1');
      expect(log.context?.extra).toBe('data');
    });

    it('should allow nested child instrumenters', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const child1 = instrumenter.child({ level: 1 });
      const child2 = child1.child({ level: 2 });
      const fn = child2.wrap(() => 'result', { operation: 'nested' });
      fn();

      // Last level wins due to merge
      expect(getLog(mockLogger.logs, 0).context?.level).toBe(2);
    });
  });

  describe('startSpan and endSpan', () => {
    it('should create and complete span manually', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const span = instrumenter.startSpan('manual');
      expect(span.status).toBe('running');
      expect(span.operation).toBe('manual');
      expect(span.endedAt).toBeUndefined();
      expect(span.durationMs).toBeUndefined();

      mockClock.advance(100);
      const completed = instrumenter.endSpan(span);

      expect(completed.status).toBe('success');
      expect(completed.durationMs).toBe(100);
      expect(completed.endedAt).toBeDefined();
    });

    it('should create nested spans with parent', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const parent = instrumenter.startSpan('parent');
      const child = instrumenter.startSpan('child', parent);

      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentSpanId).toBe(parent.spanId);
    });

    it('should end span with error status', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const span = instrumenter.startSpan('failing');
      const error = new Error('Manual error');
      mockClock.advance(50);
      const completed = instrumenter.endSpan(span, error);

      expect(completed.status).toBe('error');
      expect(completed.error).toBe(error);
      expect(completed.durationMs).toBe(50);
    });
  });

  describe('getCurrentSpan', () => {
    it('should return undefined when no span active', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      expect(instrumenter.getCurrentSpan()).toBeUndefined();
    });

    it('should return current span during wrapped execution', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      let capturedSpan: Span | undefined;
      const fn = instrumenter.wrap(
        () => {
          capturedSpan = instrumenter.getCurrentSpan();
          return 'result';
        },
        { operation: 'test' }
      );

      fn();

      expect(capturedSpan).toBeDefined();
      expect(capturedSpan?.operation).toBe('test');
      expect(capturedSpan?.status).toBe('running');
    });

    it('should return current span during manual span', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const span = instrumenter.startSpan('manual');
      expect(instrumenter.getCurrentSpan()).toBe(span);

      instrumenter.endSpan(span);
      expect(instrumenter.getCurrentSpan()).toBeUndefined();
    });
  });

  describe('SpanHandler', () => {
    it('should call onSpanStart and onSpanEnd', () => {
      const spanHandler = createMockSpanHandler();
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
        spanHandler,
      });

      const fn = instrumenter.wrap(() => 'result', { operation: 'tracked' });
      fn();

      expect(spanHandler.startedSpans).toHaveLength(1);
      expect(getSpan(spanHandler.startedSpans, 0).operation).toBe('tracked');
      expect(getSpan(spanHandler.startedSpans, 0).status).toBe('running');

      expect(spanHandler.endedSpans).toHaveLength(1);
      expect(getSpan(spanHandler.endedSpans, 0).operation).toBe('tracked');
      expect(getSpan(spanHandler.endedSpans, 0).status).toBe('success');
    });

    it('should call handler for manual spans', () => {
      const spanHandler = createMockSpanHandler();
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
        spanHandler,
      });

      const span = instrumenter.startSpan('manual');
      expect(spanHandler.startedSpans).toHaveLength(1);

      instrumenter.endSpan(span);
      expect(spanHandler.endedSpans).toHaveLength(1);
    });
  });

  describe('InstrumenterOptions', () => {
    it('should use default success level from options', () => {
      const instrumenter = createInstrumenter(
        {
          Date,
          logger: mockLogger,
          clock: mockClock,
          generateId: mockGenerateId,
        },
        { defaultSuccessLevel: 'info' }
      );

      const fn = instrumenter.wrap(() => 'result', { operation: 'test' });
      fn();

      expect(getLog(mockLogger.logs, 0).level).toBe('info');
    });

    it('should use default failure level from options', () => {
      const instrumenter = createInstrumenter(
        {
          Date,
          logger: mockLogger,
          clock: mockClock,
          generateId: mockGenerateId,
        },
        { defaultFailureLevel: 'fatal' }
      );

      const fn = instrumenter.wrap(
        () => {
          throw new Error('test');
        },
        { operation: 'test' }
      );

      expect(() => fn()).toThrow();
      expect(getLog(mockLogger.logs, 0).level).toBe('fatal');
    });

    it('should apply base context to all operations', () => {
      const instrumenter = createInstrumenter(
        {
          Date,
          logger: mockLogger,
          clock: mockClock,
          generateId: mockGenerateId,
        },
        { baseContext: { service: 'test-service' } }
      );

      const fn = instrumenter.wrap(() => 'result', { operation: 'test' });
      fn();

      expect(getLog(mockLogger.logs, 0).context?.service).toBe('test-service');
    });
  });

  describe('type preservation', () => {
    it('should preserve function return type', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const getNumber = instrumenter.wrap((): number => 42, { operation: 'getNumber' });
      const result: number = getNumber();
      expect(result).toBe(42);
    });

    it('should preserve async function return type', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const getString = instrumenter.wrap(async (): Promise<string> => 'hello', {
        operation: 'getString',
      });
      const result: string = await getString();
      expect(result).toBe('hello');
    });

    it('should preserve function argument types', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const concat = instrumenter.wrap((a: string, b: string): string => a + b, {
        operation: 'concat',
      });
      const result = concat('hello', ' world');
      expect(result).toBe('hello world');
    });

    it('should handle void functions', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      let called = false;
      const voidFn = instrumenter.wrap(
        (): void => {
          called = true;
        },
        { operation: 'voidFn' }
      );

      const result = voidFn();
      expect(result).toBeUndefined();
      expect(called).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle function that returns Promise-like object', async () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const fn = instrumenter.wrap(() => Promise.resolve('value'), { operation: 'promiseLike' });

      const result = await fn();
      expect(result).toBe('value');
      expect(getLog(mockLogger.logs, 0).context?.success).toBe(true);
    });

    it('should handle functions with no arguments', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const noArgs = instrumenter.wrap(() => 'no args', { operation: 'noArgs' });
      expect(noArgs()).toBe('no args');
    });

    it('should handle functions with many arguments', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const manyArgs = instrumenter.wrap(
        (a: number, b: number, c: number, d: number) => a + b + c + d,
        { operation: 'manyArgs' }
      );
      expect(manyArgs(1, 2, 3, 4)).toBe(10);
    });

    it('should handle nested wrapped functions', () => {
      const instrumenter = createInstrumenter({
        Date,
        logger: mockLogger,
        clock: mockClock,
        generateId: mockGenerateId,
      });

      const inner = instrumenter.wrap(() => 'inner', { operation: 'inner' });
      const outer = instrumenter.wrap(() => inner(), { operation: 'outer' });

      const result = outer();
      expect(result).toBe('inner');
      expect(mockLogger.logs).toHaveLength(2);
      expect(getLog(mockLogger.logs, 0).context?.operation).toBe('inner');
      expect(getLog(mockLogger.logs, 1).context?.operation).toBe('outer');
    });
  });
});
