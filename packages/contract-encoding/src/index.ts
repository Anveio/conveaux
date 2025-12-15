/**
 * @conveaux/contract-encoding
 *
 * Encoding contract for string-binary conversion.
 * Provides injectable TextEncoder/TextDecoder interfaces.
 *
 * Usage:
 * - Inject the global TextEncoder/TextDecoder constructors at composition time
 * - Use for converting between strings and Uint8Array
 */

/**
 * A TextEncoder instance for encoding strings to bytes.
 *
 * Matches the WHATWG Encoding Standard TextEncoder interface.
 */
export interface TextEncoderInstance {
  /**
   * Encodes a string into a Uint8Array using UTF-8.
   *
   * @param input - The string to encode
   * @returns UTF-8 encoded bytes
   *
   * @example
   * encoder.encode('hello') // Uint8Array([104, 101, 108, 108, 111])
   */
  encode(input: string): Uint8Array;
}

/**
 * A TextEncoder constructor interface.
 *
 * This abstraction enables:
 * - Deterministic testing with mock encoders
 * - Runtime-agnostic code that works in Node.js and browsers
 *
 * @example
 * ```typescript
 * // Inject the global TextEncoder at composition time
 * const deps = { TextEncoder };
 *
 * // Use in functions
 * function stringToBytes(str: string, TextEncoder: TextEncoderConstructor): Uint8Array {
 *   return new TextEncoder().encode(str);
 * }
 * ```
 */
export interface TextEncoderConstructor {
  /**
   * Creates a new TextEncoder instance.
   * TextEncoder always uses UTF-8 encoding.
   */
  new (): TextEncoderInstance;
}

/**
 * A TextDecoder instance for decoding bytes to strings.
 *
 * Matches the WHATWG Encoding Standard TextDecoder interface.
 */
export interface TextDecoderInstance {
  /**
   * Decodes bytes into a string.
   *
   * @param input - The bytes to decode (optional, returns empty string if omitted)
   * @returns The decoded string
   *
   * @example
   * decoder.decode(new Uint8Array([104, 101, 108, 108, 111])) // 'hello'
   */
  decode(input?: Uint8Array): string;
}

/**
 * A TextDecoder constructor interface.
 *
 * @example
 * ```typescript
 * // Inject the global TextDecoder at composition time
 * const deps = { TextDecoder };
 *
 * // Use in functions
 * function bytesToString(bytes: Uint8Array, TextDecoder: TextDecoderConstructor): string {
 *   return new TextDecoder().decode(bytes);
 * }
 * ```
 */
export interface TextDecoderConstructor {
  /**
   * Creates a new TextDecoder instance.
   *
   * @param label - The encoding label (default: 'utf-8')
   */
  new (label?: string): TextDecoderInstance;
}
