import { describe, expect, it } from 'vitest';

import { extractSignal, parseSignalLine, parseSignals } from './signals.js';

// =============================================================================
// parseSignalLine Tests
// =============================================================================

describe('parseSignalLine', () => {
  describe('INITIALIZATION_COMPLETE signal', () => {
    it('should parse valid initialization complete signal', () => {
      const result = parseSignalLine('INITIALIZATION_COMPLETE:featureCount=5');
      expect(result).toEqual({
        type: 'INITIALIZATION_COMPLETE',
        featureCount: 5,
      });
    });

    it('should parse zero feature count', () => {
      const result = parseSignalLine('INITIALIZATION_COMPLETE:featureCount=0');
      expect(result).toEqual({
        type: 'INITIALIZATION_COMPLETE',
        featureCount: 0,
      });
    });

    it('should parse large feature count', () => {
      const result = parseSignalLine('INITIALIZATION_COMPLETE:featureCount=999');
      expect(result).toEqual({
        type: 'INITIALIZATION_COMPLETE',
        featureCount: 999,
      });
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseSignalLine('  INITIALIZATION_COMPLETE:featureCount=3  ');
      expect(result).toEqual({
        type: 'INITIALIZATION_COMPLETE',
        featureCount: 3,
      });
    });

    it('should reject malformed initialization signal', () => {
      expect(parseSignalLine('INITIALIZATION_COMPLETE:featureCount=')).toBeNull();
      expect(parseSignalLine('INITIALIZATION_COMPLETE:featureCount=abc')).toBeNull();
      expect(parseSignalLine('INITIALIZATION_COMPLETE:count=5')).toBeNull();
      expect(parseSignalLine('INITIALIZATION_COMPLETE')).toBeNull();
    });
  });

  describe('FEATURE_READY signal', () => {
    it('should parse valid feature ready signal', () => {
      const result = parseSignalLine('FEATURE_READY:id=F001');
      expect(result).toEqual({
        type: 'FEATURE_READY',
        featureId: 'F001',
      });
    });

    it('should parse feature ID with dashes and underscores', () => {
      const result = parseSignalLine('FEATURE_READY:id=feature-123_test');
      expect(result).toEqual({
        type: 'FEATURE_READY',
        featureId: 'feature-123_test',
      });
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseSignalLine('  FEATURE_READY:id=F001  ');
      expect(result).toEqual({
        type: 'FEATURE_READY',
        featureId: 'F001',
      });
    });

    it('should reject feature ID with spaces', () => {
      expect(parseSignalLine('FEATURE_READY:id=F001 extra')).toBeNull();
    });

    it('should reject malformed feature ready signal', () => {
      expect(parseSignalLine('FEATURE_READY:id=')).toBeNull();
      expect(parseSignalLine('FEATURE_READY:')).toBeNull();
      expect(parseSignalLine('FEATURE_READY')).toBeNull();
    });
  });

  describe('FEATURE_BLOCKED signal', () => {
    it('should parse valid feature blocked signal', () => {
      const result = parseSignalLine('FEATURE_BLOCKED:id=F001:reason=verification failed');
      expect(result).toEqual({
        type: 'FEATURE_BLOCKED',
        featureId: 'F001',
        reason: 'verification failed',
      });
    });

    it('should parse reason with colons', () => {
      const result = parseSignalLine('FEATURE_BLOCKED:id=F001:reason=error: test failed: line 42');
      expect(result).toEqual({
        type: 'FEATURE_BLOCKED',
        featureId: 'F001',
        reason: 'error: test failed: line 42',
      });
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseSignalLine('  FEATURE_BLOCKED:id=F001:reason=blocked  ');
      expect(result).toEqual({
        type: 'FEATURE_BLOCKED',
        featureId: 'F001',
        reason: 'blocked',
      });
    });

    it('should reject malformed blocked signal', () => {
      expect(parseSignalLine('FEATURE_BLOCKED:id=F001')).toBeNull();
      expect(parseSignalLine('FEATURE_BLOCKED:id=F001:reason=')).toBeNull();
      expect(parseSignalLine('FEATURE_BLOCKED:id=:reason=test')).toBeNull();
    });
  });

  describe('APPROVED signal', () => {
    it('should parse valid approved signal', () => {
      const result = parseSignalLine('APPROVED:id=F001');
      expect(result).toEqual({
        type: 'APPROVED',
        featureId: 'F001',
      });
    });

    it('should parse feature ID with complex characters', () => {
      const result = parseSignalLine('APPROVED:id=feature-2024-12-15');
      expect(result).toEqual({
        type: 'APPROVED',
        featureId: 'feature-2024-12-15',
      });
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseSignalLine('  APPROVED:id=F001  ');
      expect(result).toEqual({
        type: 'APPROVED',
        featureId: 'F001',
      });
    });

    it('should reject malformed approved signal', () => {
      expect(parseSignalLine('APPROVED:id=')).toBeNull();
      expect(parseSignalLine('APPROVED:')).toBeNull();
      expect(parseSignalLine('APPROVED')).toBeNull();
    });
  });

  describe('REJECTED signal', () => {
    it('should parse valid rejected signal', () => {
      const result = parseSignalLine('REJECTED:id=F001:feedback=missing test coverage');
      expect(result).toEqual({
        type: 'REJECTED',
        featureId: 'F001',
        feedback: 'missing test coverage',
      });
    });

    it('should parse feedback with colons', () => {
      const result = parseSignalLine('REJECTED:id=F001:feedback=issues: lint errors, type errors');
      expect(result).toEqual({
        type: 'REJECTED',
        featureId: 'F001',
        feedback: 'issues: lint errors, type errors',
      });
    });

    it('should handle leading/trailing whitespace', () => {
      const result = parseSignalLine('  REJECTED:id=F001:feedback=rejected  ');
      expect(result).toEqual({
        type: 'REJECTED',
        featureId: 'F001',
        feedback: 'rejected',
      });
    });

    it('should reject malformed rejected signal', () => {
      expect(parseSignalLine('REJECTED:id=F001')).toBeNull();
      expect(parseSignalLine('REJECTED:id=F001:feedback=')).toBeNull();
      expect(parseSignalLine('REJECTED:id=:feedback=test')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should return null for empty string', () => {
      expect(parseSignalLine('')).toBeNull();
    });

    it('should return null for whitespace only', () => {
      expect(parseSignalLine('   ')).toBeNull();
    });

    it('should return null for non-signal text', () => {
      expect(parseSignalLine('This is just regular text')).toBeNull();
      expect(parseSignalLine('FEATURE_READY without the colon')).toBeNull();
      expect(parseSignalLine('random:id=F001')).toBeNull();
    });

    it('should return null for partial signal prefixes', () => {
      expect(parseSignalLine('FEATURE_')).toBeNull();
      expect(parseSignalLine('INITIALIZATION_')).toBeNull();
      expect(parseSignalLine('APPROVED:')).toBeNull();
    });

    it('should be case sensitive', () => {
      expect(parseSignalLine('feature_ready:id=F001')).toBeNull();
      expect(parseSignalLine('Feature_Ready:id=F001')).toBeNull();
      expect(parseSignalLine('approved:id=F001')).toBeNull();
    });
  });
});

// =============================================================================
// parseSignals Tests
// =============================================================================

describe('parseSignals', () => {
  it('should parse multiple signals from multi-line input', () => {
    const input = `
Starting agent...
INITIALIZATION_COMPLETE:featureCount=3
Working on features...
FEATURE_READY:id=F001
Review complete.
APPROVED:id=F001
Done.
    `;
    const signals = parseSignals(input);
    expect(signals).toHaveLength(3);
    expect(signals[0]).toEqual({ type: 'INITIALIZATION_COMPLETE', featureCount: 3 });
    expect(signals[1]).toEqual({ type: 'FEATURE_READY', featureId: 'F001' });
    expect(signals[2]).toEqual({ type: 'APPROVED', featureId: 'F001' });
  });

  it('should return empty array for input with no signals', () => {
    const input = `
This is just regular output
with no signals at all.
    `;
    const signals = parseSignals(input);
    expect(signals).toEqual([]);
  });

  it('should return empty array for empty input', () => {
    expect(parseSignals('')).toEqual([]);
  });

  it('should handle single line input', () => {
    const signals = parseSignals('FEATURE_READY:id=F001');
    expect(signals).toEqual([{ type: 'FEATURE_READY', featureId: 'F001' }]);
  });

  it('should handle mixed valid and invalid signals', () => {
    const input = `
FEATURE_READY:id=F001
FEATURE_READY:id=
APPROVED:id=F001
malformed signal here
REJECTED:id=F002:feedback=needs work
    `;
    const signals = parseSignals(input);
    expect(signals).toHaveLength(3);
    expect(signals[0]).toEqual({ type: 'FEATURE_READY', featureId: 'F001' });
    expect(signals[1]).toEqual({ type: 'APPROVED', featureId: 'F001' });
    expect(signals[2]).toEqual({ type: 'REJECTED', featureId: 'F002', feedback: 'needs work' });
  });

  it('should handle Windows line endings', () => {
    const input = 'FEATURE_READY:id=F001\r\nAPPROVED:id=F001\r\n';
    const signals = parseSignals(input);
    expect(signals).toHaveLength(2);
  });

  it('should preserve order of signals', () => {
    const input = `
FEATURE_BLOCKED:id=F001:reason=first
FEATURE_BLOCKED:id=F002:reason=second
FEATURE_BLOCKED:id=F003:reason=third
    `;
    const signals = parseSignals(input);
    expect(signals[0]?.type === 'FEATURE_BLOCKED' && signals[0].featureId).toBe('F001');
    expect(signals[1]?.type === 'FEATURE_BLOCKED' && signals[1].featureId).toBe('F002');
    expect(signals[2]?.type === 'FEATURE_BLOCKED' && signals[2].featureId).toBe('F003');
  });
});

// =============================================================================
// extractSignal Tests
// =============================================================================

describe('extractSignal', () => {
  it('should extract INITIALIZATION_COMPLETE signal', () => {
    const input = `
Starting...
INITIALIZATION_COMPLETE:featureCount=5
Done.
    `;
    const signal = extractSignal(input, 'INITIALIZATION_COMPLETE');
    expect(signal).toEqual({ type: 'INITIALIZATION_COMPLETE', featureCount: 5 });
  });

  it('should extract FEATURE_READY signal', () => {
    const input = 'FEATURE_READY:id=test-feature';
    const signal = extractSignal(input, 'FEATURE_READY');
    expect(signal).toEqual({ type: 'FEATURE_READY', featureId: 'test-feature' });
  });

  it('should extract FEATURE_BLOCKED signal', () => {
    const input = 'FEATURE_BLOCKED:id=F001:reason=test failure';
    const signal = extractSignal(input, 'FEATURE_BLOCKED');
    expect(signal).toEqual({
      type: 'FEATURE_BLOCKED',
      featureId: 'F001',
      reason: 'test failure',
    });
  });

  it('should extract APPROVED signal', () => {
    const input = 'APPROVED:id=my-feature';
    const signal = extractSignal(input, 'APPROVED');
    expect(signal).toEqual({ type: 'APPROVED', featureId: 'my-feature' });
  });

  it('should extract REJECTED signal', () => {
    const input = 'REJECTED:id=F001:feedback=needs more tests';
    const signal = extractSignal(input, 'REJECTED');
    expect(signal).toEqual({
      type: 'REJECTED',
      featureId: 'F001',
      feedback: 'needs more tests',
    });
  });

  it('should return null when signal type not found', () => {
    const input = 'FEATURE_READY:id=F001';
    const signal = extractSignal(input, 'APPROVED');
    expect(signal).toBeNull();
  });

  it('should return null for empty input', () => {
    expect(extractSignal('', 'FEATURE_READY')).toBeNull();
  });

  it('should return first matching signal when multiple exist', () => {
    const input = `
FEATURE_READY:id=first
FEATURE_READY:id=second
    `;
    const signal = extractSignal(input, 'FEATURE_READY');
    expect(signal).toEqual({ type: 'FEATURE_READY', featureId: 'first' });
  });

  it('should correctly narrow types for each signal type', () => {
    // Test type narrowing - these would fail at compile time if types were wrong
    const initSignal = extractSignal(
      'INITIALIZATION_COMPLETE:featureCount=5',
      'INITIALIZATION_COMPLETE'
    );
    if (initSignal) {
      // TypeScript should know this has featureCount
      expect(initSignal.featureCount).toBe(5);
    }

    const readySignal = extractSignal('FEATURE_READY:id=F001', 'FEATURE_READY');
    if (readySignal) {
      // TypeScript should know this has featureId
      expect(readySignal.featureId).toBe('F001');
    }

    const blockedSignal = extractSignal('FEATURE_BLOCKED:id=F001:reason=test', 'FEATURE_BLOCKED');
    if (blockedSignal) {
      // TypeScript should know this has featureId and reason
      expect(blockedSignal.featureId).toBe('F001');
      expect(blockedSignal.reason).toBe('test');
    }

    const rejectedSignal = extractSignal('REJECTED:id=F001:feedback=test', 'REJECTED');
    if (rejectedSignal) {
      // TypeScript should know this has featureId and feedback
      expect(rejectedSignal.featureId).toBe('F001');
      expect(rejectedSignal.feedback).toBe('test');
    }
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('integration', () => {
  it('should handle realistic agent output', () => {
    const agentOutput = `
[2024-12-15 10:00:00] Agent starting initialization...
Scanning codebase for improvement opportunities...
Found 5 potential features:
- F001: Add missing tests
- F002: Fix type errors
- F003: Improve error handling
- F004: Add documentation
- F005: Refactor utils

INITIALIZATION_COMPLETE:featureCount=5

[2024-12-15 10:00:05] Starting work on F001...
Reading test coverage report...
Writing tests for utils.ts...
Running verification...
All tests pass!

FEATURE_READY:id=F001

[2024-12-15 10:00:10] Reviewing F001...
Checking code quality...
Verifying test coverage...

APPROVED:id=F001

[2024-12-15 10:00:15] Starting work on F002...
Encountered dependency issue...

FEATURE_BLOCKED:id=F002:reason=missing @types/node package

[2024-12-15 10:00:20] Moving to F003...
`;

    const signals = parseSignals(agentOutput);
    expect(signals).toHaveLength(4);

    expect(signals[0]).toEqual({ type: 'INITIALIZATION_COMPLETE', featureCount: 5 });
    expect(signals[1]).toEqual({ type: 'FEATURE_READY', featureId: 'F001' });
    expect(signals[2]).toEqual({ type: 'APPROVED', featureId: 'F001' });
    expect(signals[3]).toEqual({
      type: 'FEATURE_BLOCKED',
      featureId: 'F002',
      reason: 'missing @types/node package',
    });

    // Extract specific signals
    const initSignal = extractSignal(agentOutput, 'INITIALIZATION_COMPLETE');
    expect(initSignal?.featureCount).toBe(5);

    const blockedSignal = extractSignal(agentOutput, 'FEATURE_BLOCKED');
    expect(blockedSignal?.reason).toBe('missing @types/node package');
  });
});
