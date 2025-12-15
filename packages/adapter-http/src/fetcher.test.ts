import { describe, it, expect } from 'vitest';
import { validateURL, extractShareId } from './fetcher.js';
import { InvalidURLError } from '@conveaux/contracts';

describe('validateURL', () => {
  it('accepts valid chatgpt.com URLs', () => {
    expect(validateURL('https://chatgpt.com/share/abc123')).toBe(true);
    expect(validateURL('https://chatgpt.com/share/abc-123-def')).toBe(true);
  });

  it('accepts valid chat.openai.com URLs', () => {
    expect(validateURL('https://chat.openai.com/share/abc123')).toBe(true);
    expect(validateURL('https://chat.openai.com/share/abc-123-def')).toBe(true);
  });

  it('rejects invalid URLs', () => {
    expect(validateURL('https://example.com/share/abc123')).toBe(false);
    expect(validateURL('https://chatgpt.com/c/abc123')).toBe(false);
    expect(validateURL('http://chatgpt.com/share/abc123')).toBe(false);
    expect(validateURL('not-a-url')).toBe(false);
  });
});

describe('extractShareId', () => {
  it('extracts share ID from valid URLs', () => {
    expect(extractShareId('https://chatgpt.com/share/abc123')).toBe('abc123');
    expect(extractShareId('https://chat.openai.com/share/abc-123-def')).toBe(
      'abc-123-def'
    );
  });

  it('throws InvalidURLError for invalid URLs', () => {
    expect(() => extractShareId('https://example.com/path')).toThrow(
      InvalidURLError
    );
  });
});
