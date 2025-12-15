/**
 * Tests for port-outchannel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStderrChannel, createStdoutChannel } from './index.js';

describe('createStderrChannel', () => {
  const originalWrite = process.stderr.write;
  let writtenData: string[] = [];

  beforeEach(() => {
    writtenData = [];
    process.stderr.write = vi.fn((data: string | Uint8Array) => {
      writtenData.push(data.toString());
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(() => {
    process.stderr.write = originalWrite;
  });

  it('should write data to stderr', () => {
    const channel = createStderrChannel();
    channel.write('test message');

    expect(writtenData).toContain('test message');
  });

  it('should write multiple times', () => {
    const channel = createStderrChannel();
    channel.write('first');
    channel.write('second');

    expect(writtenData).toEqual(['first', 'second']);
  });
});

describe('createStdoutChannel', () => {
  const originalWrite = process.stdout.write;
  let writtenData: string[] = [];

  beforeEach(() => {
    writtenData = [];
    process.stdout.write = vi.fn((data: string | Uint8Array) => {
      writtenData.push(data.toString());
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    process.stdout.write = originalWrite;
  });

  it('should write data to stdout', () => {
    const channel = createStdoutChannel();
    channel.write('test message');

    expect(writtenData).toContain('test message');
  });
});
