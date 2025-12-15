/**
 * Encoding utilities for ID generation.
 *
 * Supports:
 * - Hex encoding (lowercase)
 * - Crockford Base32 (lexicographically sortable, case-insensitive)
 * - Base64 and Base64url
 */

// =============================================================================
// Hex Encoding
// =============================================================================

/**
 * Convert bytes to lowercase hex string.
 */
export const bytesToHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

/**
 * Convert hex string to bytes.
 * @throws Error if hex string is invalid
 */
export const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) {
    throw new Error('Hex string must have even length');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = Number.parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`Invalid hex character at position ${i}`);
    }
    bytes[i / 2] = byte;
  }
  return bytes;
};

// =============================================================================
// Crockford Base32 Encoding
// =============================================================================

/**
 * Crockford Base32 alphabet (uppercase).
 * Excludes I, L, O, U to avoid ambiguity.
 * Lexicographically sortable: 0-9A-HJ-NP-TV-Z
 */
const CROCKFORD_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Lookup table for decoding Crockford Base32.
 * Maps characters to their 5-bit values.
 * Case-insensitive, with common substitutions (I→1, L→1, O→0).
 */
const CROCKFORD_DECODE: Record<string, number> = {};
for (let i = 0; i < CROCKFORD_ALPHABET.length; i++) {
  const char = CROCKFORD_ALPHABET.charAt(i);
  CROCKFORD_DECODE[char] = i;
  CROCKFORD_DECODE[char.toLowerCase()] = i;
}
// Common substitutions
CROCKFORD_DECODE.I = 1;
CROCKFORD_DECODE.i = 1;
CROCKFORD_DECODE.L = 1;
CROCKFORD_DECODE.l = 1;
CROCKFORD_DECODE.O = 0;
CROCKFORD_DECODE.o = 0;

/**
 * Encode bytes to Crockford Base32 (uppercase, no padding).
 *
 * Properties:
 * - Lexicographically sortable (binary order = string order)
 * - Case-insensitive decoding
 * - No ambiguous characters (I, L, O, U excluded)
 */
export const encodeCrockfordBase32 = (bytes: Uint8Array): string => {
  if (bytes.length === 0) return '';

  // Convert bytes to a big integer for easier bit manipulation
  let result = '';
  let buffer = 0;
  let bitsInBuffer = 0;

  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      const index = (buffer >> bitsInBuffer) & 0x1f;
      result += CROCKFORD_ALPHABET[index];
    }
  }

  // Handle remaining bits (pad with zeros on the right)
  if (bitsInBuffer > 0) {
    const index = (buffer << (5 - bitsInBuffer)) & 0x1f;
    result += CROCKFORD_ALPHABET[index];
  }

  return result;
};

/**
 * Decode Crockford Base32 to bytes.
 *
 * @throws Error if string contains invalid characters
 */
export const decodeCrockfordBase32 = (str: string): Uint8Array => {
  if (str.length === 0) return new Uint8Array(0);

  // Calculate output length
  const outputLength = Math.floor((str.length * 5) / 8);
  const result = new Uint8Array(outputLength);

  let buffer = 0;
  let bitsInBuffer = 0;
  let outputIndex = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charAt(i);
    const value = CROCKFORD_DECODE[char];

    if (value === undefined) {
      throw new Error(`Invalid Crockford Base32 character: ${char} at position ${i}`);
    }

    buffer = (buffer << 5) | value;
    bitsInBuffer += 5;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      result[outputIndex++] = (buffer >> bitsInBuffer) & 0xff;
    }
  }

  return result;
};

// =============================================================================
// Base64 Encoding
// =============================================================================

/**
 * Standard Base64 alphabet.
 */
const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode bytes to Base64 (pure JavaScript, no platform dependencies).
 */
export const encodeBase64 = (bytes: Uint8Array): string => {
  let result = '';
  const len = bytes.length;
  let i = 0;

  while (i < len) {
    const b0 = bytes[i++] as number;
    const b1 = i < len ? (bytes[i++] as number) : 0;
    const b2 = i < len ? (bytes[i++] as number) : 0;

    const triplet = (b0 << 16) | (b1 << 8) | b2;

    result += BASE64_ALPHABET.charAt((triplet >> 18) & 0x3f);
    result += BASE64_ALPHABET.charAt((triplet >> 12) & 0x3f);
    result += i - 2 < len ? BASE64_ALPHABET.charAt((triplet >> 6) & 0x3f) : '=';
    result += i - 1 < len ? BASE64_ALPHABET.charAt(triplet & 0x3f) : '=';
  }

  return result;
};

/**
 * Encode bytes to Base64url (URL-safe, no padding).
 */
export const encodeBase64url = (bytes: Uint8Array): string => {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

// =============================================================================
// Timestamp Encoding (48-bit milliseconds)
// =============================================================================

/**
 * Encode milliseconds timestamp to 6 bytes (48-bit, big-endian).
 * Supports timestamps up to year 10889.
 */
export const encodeTimestamp48 = (timestampMs: number): Uint8Array => {
  const bytes = new Uint8Array(6);
  // Big-endian encoding for lexicographic sortability
  bytes[0] = (timestampMs / 0x10000000000) & 0xff;
  bytes[1] = (timestampMs / 0x100000000) & 0xff;
  bytes[2] = (timestampMs / 0x1000000) & 0xff;
  bytes[3] = (timestampMs / 0x10000) & 0xff;
  bytes[4] = (timestampMs / 0x100) & 0xff;
  bytes[5] = timestampMs & 0xff;
  return bytes;
};

/**
 * Decode 6 bytes to milliseconds timestamp.
 */
export const decodeTimestamp48 = (bytes: Uint8Array): number => {
  if (bytes.length < 6) {
    throw new Error('Need at least 6 bytes to decode timestamp');
  }
  // TypeScript doesn't narrow Uint8Array after length check, so we extract explicitly
  const b0 = bytes[0] as number;
  const b1 = bytes[1] as number;
  const b2 = bytes[2] as number;
  const b3 = bytes[3] as number;
  const b4 = bytes[4] as number;
  const b5 = bytes[5] as number;
  return b0 * 0x10000000000 + b1 * 0x100000000 + b2 * 0x1000000 + b3 * 0x10000 + b4 * 0x100 + b5;
};
