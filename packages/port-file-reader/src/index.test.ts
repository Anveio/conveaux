import { describe, expect, it, vi } from 'vitest';
import { createFetchFileReader, createNodeFileReader } from './index';

describe('createNodeFileReader', () => {
  it('should read file content successfully', async () => {
    const reader = createNodeFileReader();
    // Read this test file itself
    const result = await reader.readText(import.meta.filename);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain('createNodeFileReader');
    }
  });

  it('should return error for non-existent file', async () => {
    const reader = createNodeFileReader();
    const result = await reader.readText('/non/existent/path.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe('/non/existent/path.txt');
      expect(result.error.message).toContain('ENOENT');
    }
  });
});

describe('createFetchFileReader', () => {
  it('should read URL content successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: () => Promise.resolve('Hello, World!'),
    }) as unknown as typeof fetch;

    const reader = createFetchFileReader({ fetch: mockFetch });
    const result = await reader.readText('https://example.com/test.txt');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe('Hello, World!');
    }
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/test.txt');
  });

  it('should return error for HTTP error response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }) as unknown as typeof fetch;

    const reader = createFetchFileReader({ fetch: mockFetch });
    const result = await reader.readText('https://example.com/missing.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe('https://example.com/missing.txt');
      expect(result.error.message).toContain('404');
      expect(result.error.message).toContain('Not Found');
    }
  });

  it('should return error for network failure', async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch;

    const reader = createFetchFileReader({ fetch: mockFetch });
    const result = await reader.readText('https://example.com/test.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.path).toBe('https://example.com/test.txt');
      expect(result.error.message).toBe('Network error');
    }
  });

  it('should handle non-Error rejection', async () => {
    const mockFetch = vi.fn().mockRejectedValue('String error') as unknown as typeof fetch;

    const reader = createFetchFileReader({ fetch: mockFetch });
    const result = await reader.readText('https://example.com/test.txt');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('String error');
    }
  });
});
