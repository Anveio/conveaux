/**
 * @conveaux/port-html-parser
 *
 * Platform-agnostic HTML parsing implementation.
 * Zero external dependencies - uses our own tokenizer and DOM builder.
 *
 * @example
 * ```typescript
 * import { createHtmlParser } from '@conveaux/port-html-parser';
 *
 * const parser = createHtmlParser();
 *
 * const { document } = parser.parse('<html><body>Hello</body></html>');
 * console.log(document.body?.textContent); // 'Hello'
 * ```
 */

import type {
  HtmlParseResult,
  HtmlParser,
  HtmlParserOptions,
} from '@conveaux/contract-html-parser';

import { createParseError } from './internal/errors.js';
import { wrapDocument } from './internal/wrap-document.js';
import { buildDom } from './parser/dom.js';

// Re-export all contract types for convenience
export type {
  // Core element types
  HtmlElement,
  HtmlElementList,
  HtmlDocument,
  // Parser types
  HtmlParser,
  HtmlParserOptions,
  HtmlParseResult,
  HtmlParseWarning,
  HtmlParseWarningCode,
  // Error types
  HtmlParseError,
  HtmlParseErrorCode,
  NotImplementedError,
  // DOM provider types (for custom implementations)
  DomProvider,
  DomDocument,
  DomElement,
  DomParseOptions,
} from '@conveaux/contract-html-parser';

// Re-export error utilities
export { createParseError, createNotImplementedError, notImplemented } from './internal/errors.js';

/**
 * Creates an HTML parser using our built-in tokenizer and DOM builder.
 *
 * @returns An HtmlParser instance
 *
 * @example
 * ```typescript
 * import { createHtmlParser } from '@conveaux/port-html-parser';
 *
 * const parser = createHtmlParser();
 *
 * const { document } = parser.parse('<html><body>Hello</body></html>');
 * const body = document.body;
 * console.log(body?.textContent); // 'Hello'
 * ```
 *
 * @example
 * ```typescript
 * // Extract script tag content (chatgpt-share use case)
 * const { document } = parser.parse(html);
 * const scriptTag = document.getElementById('__NEXT_DATA__');
 * const jsonContent = scriptTag?.innerHTML;
 * ```
 */
export function createHtmlParser(): HtmlParser {
  return {
    parse(html: string, _options?: HtmlParserOptions): HtmlParseResult {
      // Validate input
      if (html === null || html === undefined) {
        throw createParseError('null-input', 'HTML input cannot be null or undefined');
      }

      // Parse using our built-in parser
      const domDocument = buildDom(html);

      // Wrap in our interfaces
      const document = wrapDocument(domDocument);

      // TODO: Collect warnings during parsing
      const warnings: readonly [] = [];

      return {
        document,
        warnings,
      };
    },
  };
}
