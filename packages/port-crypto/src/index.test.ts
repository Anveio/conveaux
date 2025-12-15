import { describe, expect, it } from 'vitest';
import type { HashAlgorithm, HashEncoding } from './index.js';
import { createCrypto } from './index.js';

// =============================================================================
// Test Vectors (from standard cryptographic test suites)
// =============================================================================

const TEST_VECTORS = {
  sha256: {
    'hello world': 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9',
    '': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    test: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  },
  sha512: {
    'hello world':
      '309ecc489c12d6eb4cc40f50c902f2b4d0ed77ee511a7c7a9bcd3ca86d4cd86f989dd35bc5ff499670da34255b45b0cfd830e81f605dcf7dc5542e93ae9cd76f',
    '': 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  },
};

// =============================================================================
// Inline Mock Helpers
// =============================================================================

/**
 * Creates a mock hash function that returns predictable values.
 * Useful for testing that the factory correctly delegates to hashFn.
 */
function createMockHashFn(returnValue: string) {
  return (_algorithm: HashAlgorithm, _data: Uint8Array, _encoding: HashEncoding) => returnValue;
}

/**
 * Creates a mock hash function that captures its arguments.
 * Useful for testing argument passing.
 */
function createCapturingHashFn() {
  const calls: Array<{
    algorithm: HashAlgorithm;
    data: Uint8Array;
    encoding: HashEncoding;
  }> = [];

  const fn = (algorithm: HashAlgorithm, data: Uint8Array, encoding: HashEncoding) => {
    calls.push({ algorithm, data, encoding });
    return 'captured';
  };

  return { fn, calls };
}

/**
 * Creates a mock CryptoLike implementation.
 * Useful for testing environment override injection.
 */
function createMockCryptoLike(digestResult: string) {
  type MockHashLike = {
    update(data: string | Uint8Array): MockHashLike;
    digest(encoding: 'hex' | 'base64'): string;
  };

  const createMockHash = (): MockHashLike => {
    const mock: MockHashLike = {
      update: () => mock,
      digest: () => digestResult,
    };
    return mock;
  };

  return {
    createHash: (_algorithm: string) => createMockHash(),
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('createCrypto', () => {
  describe('hash() with SHA-256', () => {
    it('should hash "hello world" correctly', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha256', 'hello world');
      expect(result).toBe(TEST_VECTORS.sha256['hello world']);
    });

    it('should hash empty string correctly', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha256', '');
      expect(result).toBe(TEST_VECTORS.sha256['']);
    });

    it('should hash "test" correctly', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha256', 'test');
      expect(result).toBe(TEST_VECTORS.sha256.test);
    });

    it('should accept Uint8Array input', () => {
      const crypto = createCrypto();
      const data = new TextEncoder().encode('hello world');
      const result = crypto.hash('sha256', data);
      expect(result).toBe(TEST_VECTORS.sha256['hello world']);
    });
  });

  describe('hash() with SHA-512', () => {
    it('should hash "hello world" correctly', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha512', 'hello world');
      expect(result).toBe(TEST_VECTORS.sha512['hello world']);
    });

    it('should hash empty string correctly', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha512', '');
      expect(result).toBe(TEST_VECTORS.sha512['']);
    });
  });

  describe('encoding options', () => {
    it('should default to hex encoding', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha256', 'test');
      // Hex encoding uses only 0-9 and a-f
      expect(result).toMatch(/^[0-9a-f]+$/);
      // SHA-256 hex = 64 characters
      expect(result).toHaveLength(64);
    });

    it('should support explicit hex encoding', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha256', 'test', { encoding: 'hex' });
      expect(result).toBe(TEST_VECTORS.sha256.test);
    });

    it('should support base64 encoding', () => {
      const crypto = createCrypto();
      const result = crypto.hash('sha256', 'test', { encoding: 'base64' });
      // Base64 uses A-Z, a-z, 0-9, +, /, =
      expect(result).toMatch(/^[A-Za-z0-9+/=]+$/);
      // SHA-256 base64 = 44 characters (256 bits / 6 bits per char, padded)
      expect(result).toHaveLength(44);
    });
  });

  describe('hashFn override', () => {
    it('should use provided hashFn instead of platform crypto', () => {
      const crypto = createCrypto({
        hashFn: createMockHashFn('mock-hash-result'),
      });

      const result = crypto.hash('sha256', 'any input');
      expect(result).toBe('mock-hash-result');
    });

    it('should pass algorithm to hashFn', () => {
      const { fn, calls } = createCapturingHashFn();
      const crypto = createCrypto({ hashFn: fn });

      crypto.hash('sha512', 'test');
      expect(calls[0]?.algorithm).toBe('sha512');
    });

    it('should pass encoding to hashFn', () => {
      const { fn, calls } = createCapturingHashFn();
      const crypto = createCrypto({ hashFn: fn });

      crypto.hash('sha256', 'test', { encoding: 'base64' });
      expect(calls[0]?.encoding).toBe('base64');
    });

    it('should pass data as Uint8Array to hashFn', () => {
      const { fn, calls } = createCapturingHashFn();
      const crypto = createCrypto({ hashFn: fn });

      crypto.hash('sha256', 'hello');
      expect(calls[0]?.data).toBeInstanceOf(Uint8Array);
      expect(new TextDecoder().decode(calls[0]?.data)).toBe('hello');
    });

    it('should default encoding to hex when not specified', () => {
      const { fn, calls } = createCapturingHashFn();
      const crypto = createCrypto({ hashFn: fn });

      crypto.hash('sha256', 'test');
      expect(calls[0]?.encoding).toBe('hex');
    });
  });

  describe('environment override', () => {
    it('should throw when crypto is explicitly null and no hashFn provided', () => {
      const crypto = createCrypto({
        environment: { crypto: null },
      });

      expect(() => crypto.hash('sha256', 'test')).toThrow('No crypto implementation available');
    });

    it('should use override crypto when provided', () => {
      const mockCrypto = createMockCryptoLike('custom-crypto-result');

      const crypto = createCrypto({
        environment: { crypto: mockCrypto },
      });

      const result = crypto.hash('sha256', 'test');
      expect(result).toBe('custom-crypto-result');
    });

    it('should prefer hashFn over environment crypto', () => {
      const mockCrypto = createMockCryptoLike('from-environment');
      const crypto = createCrypto({
        hashFn: createMockHashFn('from-hashFn'),
        environment: { crypto: mockCrypto },
      });

      const result = crypto.hash('sha256', 'test');
      expect(result).toBe('from-hashFn');
    });
  });

  describe('error handling', () => {
    it('should throw for unsupported algorithm', () => {
      const crypto = createCrypto();

      // Cast to bypass TypeScript's type checking for runtime validation test
      const invalidAlgorithm = 'md5' as unknown as HashAlgorithm;
      expect(() => crypto.hash(invalidAlgorithm, 'test')).toThrow(
        'Unsupported hash algorithm: md5'
      );
    });

    it('should include supported algorithms in error message', () => {
      const crypto = createCrypto();

      // Cast to bypass TypeScript's type checking for runtime validation test
      const invalidAlgorithm = 'invalid' as unknown as HashAlgorithm;
      expect(() => crypto.hash(invalidAlgorithm, 'test')).toThrow('sha256, sha512');
    });
  });

  describe('input handling', () => {
    it('should handle UTF-8 strings correctly', () => {
      const crypto = createCrypto();
      // Unicode emoji test
      const result = crypto.hash('sha256', 'hello 👋 world');
      expect(result).toBeDefined();
      expect(result).toHaveLength(64); // SHA-256 hex = 64 chars
    });

    it('should produce same hash for string and equivalent Uint8Array', () => {
      const crypto = createCrypto();
      const text = 'hello';
      const bytes = new TextEncoder().encode(text);

      const stringHash = crypto.hash('sha256', text);
      const bytesHash = crypto.hash('sha256', bytes);

      expect(stringHash).toBe(bytesHash);
    });

    it('should handle binary data correctly', () => {
      const crypto = createCrypto();
      // Binary data that isn't valid UTF-8
      const binaryData = new Uint8Array([0x00, 0xff, 0x80, 0x7f]);
      const result = crypto.hash('sha256', binaryData);
      expect(result).toHaveLength(64);
    });
  });

  describe('deterministic behavior', () => {
    it('should produce same hash for same input', () => {
      const crypto = createCrypto();
      const hash1 = crypto.hash('sha256', 'deterministic test');
      const hash2 = crypto.hash('sha256', 'deterministic test');
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', () => {
      const crypto = createCrypto();
      const hash1 = crypto.hash('sha256', 'input 1');
      const hash2 = crypto.hash('sha256', 'input 2');
      expect(hash1).not.toBe(hash2);
    });

    it('should produce different hashes for same input with different algorithms', () => {
      const crypto = createCrypto();
      const sha256 = crypto.hash('sha256', 'same input');
      const sha512 = crypto.hash('sha512', 'same input');
      expect(sha256).not.toBe(sha512);
      expect(sha256).toHaveLength(64); // SHA-256
      expect(sha512).toHaveLength(128); // SHA-512
    });
  });
});
