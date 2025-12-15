/**
 * Tests for port-outchannel.
 *
 * Uses inline mock targets instead of patching process globals.
 */

import { describe, expect, it } from 'vitest';
import type { WritableTarget } from './index.js';
import { createOutChannel } from './index.js';

/**
 * Creates an inline mock target that captures written data.
 */
function createMockTarget(): WritableTarget & { captured: string[] } {
  const captured: string[] = [];
  return {
    captured,
    write(data: string): void {
      captured.push(data);
    },
  };
}

describe('createOutChannel', () => {
  it('delegates write to target', () => {
    const target = createMockTarget();
    const channel = createOutChannel(target);

    channel.write('hello');

    expect(target.captured).toEqual(['hello']);
  });

  it('handles multiple writes', () => {
    const target = createMockTarget();
    const channel = createOutChannel(target);

    channel.write('first');
    channel.write('second');
    channel.write('third');

    expect(target.captured).toEqual(['first', 'second', 'third']);
  });

  it('passes data through unchanged', () => {
    const target = createMockTarget();
    const channel = createOutChannel(target);

    const testData = 'line 1\nline 2\ttabbed';
    channel.write(testData);

    expect(target.captured).toEqual([testData]);
  });

  it('handles empty string', () => {
    const target = createMockTarget();
    const channel = createOutChannel(target);

    channel.write('');

    expect(target.captured).toEqual(['']);
  });

  it('can use independent channels with different targets', () => {
    const target1 = createMockTarget();
    const target2 = createMockTarget();

    const channel1 = createOutChannel(target1);
    const channel2 = createOutChannel(target2);

    channel1.write('to target 1');
    channel2.write('to target 2');

    expect(target1.captured).toEqual(['to target 1']);
    expect(target2.captured).toEqual(['to target 2']);
  });
});
