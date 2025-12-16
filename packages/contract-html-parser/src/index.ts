/**
 * @conveaux/contract-html-parser
 *
 * HTML parsing contract - interfaces for platform-agnostic HTML parsing.
 * Implementations may use Cheerio, linkedom, happy-dom, browser DOMParser,
 * or eventually a custom tokenizer/tree builder.
 *
 * Design: Query-first approach with minimal API surface.
 * Standards: Aligns with WHATWG DOM Standard where practical.
 *
 * @see https://html.spec.whatwg.org/multipage/parsing.html
 * @see https://dom.spec.whatwg.org/
 */

// =============================================================================
// Core Element Types
// =============================================================================

/**
 * An HTML element node in the parsed document.
 * Represents a single element with queryable content and attributes.
 *
 * This is NOT a full DOM Element - it's a minimal read-only interface
 * focused on extraction use cases. Methods that aren't implemented
 * in the current port version throw NotImplementedError.
 *
 * @see https://dom.spec.whatwg.org/#interface-element
 */
export interface HtmlElement {
  /**
   * The element's tag name (lowercase, e.g., 'div', 'script', 'a').
   * Follows WHATWG: "The tagName getter steps are to return this's qualified name."
   *
   * @see https://dom.spec.whatwg.org/#dom-element-tagname
   */
  readonly tagName: string;

  /**
   * The element's id attribute value, or null if not present.
   *
   * @see https://dom.spec.whatwg.org/#dom-element-id
   */
  readonly id: string | null;

  /**
   * The element's class list as a readonly array.
   * Returns empty array if no class attribute.
   *
   * @see https://dom.spec.whatwg.org/#dom-element-classlist
   */
  readonly classList: readonly string[];

  /**
   * Get an attribute value by name.
   * Returns null if the attribute doesn't exist.
   *
   * @param name - The attribute name (case-insensitive for HTML elements)
   * @see https://dom.spec.whatwg.org/#dom-element-getattribute
   */
  getAttribute(name: string): string | null;

  /**
   * Check if an attribute exists.
   *
   * @param name - The attribute name
   * @see https://dom.spec.whatwg.org/#dom-element-hasattribute
   */
  hasAttribute(name: string): boolean;

  /**
   * Get all attribute names on this element.
   *
   * @see https://dom.spec.whatwg.org/#dom-element-getattributenames
   */
  getAttributeNames(): readonly string[];

  /**
   * The element's text content (all descendant text nodes concatenated).
   * Follows WHATWG DOM: "descendant text content"
   *
   * @see https://dom.spec.whatwg.org/#dom-node-textcontent
   */
  readonly textContent: string;

  /**
   * The element's inner HTML as a string.
   * Useful for extracting embedded content (e.g., JSON in script tags).
   *
   * @see https://w3c.github.io/DOM-Parsing/#dom-innerhtml-innerhtml
   */
  readonly innerHTML: string;

  /**
   * The element's outer HTML (including the element itself).
   *
   * @see https://w3c.github.io/DOM-Parsing/#dom-element-outerhtml
   */
  readonly outerHTML: string;

  /**
   * Query for descendant elements matching a CSS selector.
   * Returns all matching elements in document order.
   *
   * @param selector - CSS selector string
   * @see https://dom.spec.whatwg.org/#dom-parentnode-queryselectorall
   */
  querySelectorAll(selector: string): HtmlElementList;

  /**
   * Query for the first descendant element matching a CSS selector.
   * Returns null if no match found.
   *
   * @param selector - CSS selector string
   * @see https://dom.spec.whatwg.org/#dom-parentnode-queryselector
   */
  querySelector(selector: string): HtmlElement | null;

  /**
   * Direct children elements (not all descendants).
   *
   * @see https://dom.spec.whatwg.org/#dom-parentnode-children
   */
  readonly children: HtmlElementList;

  /**
   * Parent element, or null if this is the root.
   *
   * @see https://dom.spec.whatwg.org/#dom-node-parentelement
   */
  readonly parentElement: HtmlElement | null;

  /**
   * First child element, or null if none.
   *
   * @see https://dom.spec.whatwg.org/#dom-parentnode-firstelementchild
   */
  readonly firstElementChild: HtmlElement | null;

  /**
   * Last child element, or null if none.
   *
   * @see https://dom.spec.whatwg.org/#dom-parentnode-lastelementchild
   */
  readonly lastElementChild: HtmlElement | null;

  /**
   * Next sibling element, or null if none.
   *
   * @see https://dom.spec.whatwg.org/#dom-nondocumenttypechildnode-nextelementsibling
   */
  readonly nextElementSibling: HtmlElement | null;

  /**
   * Previous sibling element, or null if none.
   *
   * @see https://dom.spec.whatwg.org/#dom-nondocumenttypechildnode-previouselementsibling
   */
  readonly previousElementSibling: HtmlElement | null;

  /**
   * Find the closest ancestor (or self) matching a selector.
   *
   * @param selector - CSS selector string
   * @see https://dom.spec.whatwg.org/#dom-element-closest
   */
  closest(selector: string): HtmlElement | null;

  /**
   * Check if this element matches a CSS selector.
   *
   * @param selector - CSS selector string
   * @see https://dom.spec.whatwg.org/#dom-element-matches
   */
  matches(selector: string): boolean;

  /**
   * Get data-* attribute value by key (without 'data-' prefix).
   * Convenience method equivalent to getAttribute('data-' + key).
   *
   * @param key - The data attribute key (e.g., 'user-id' for data-user-id)
   */
  getData(key: string): string | null;
}

/**
 * A list of HTML elements, similar to NodeList but read-only.
 * Iterable for convenient traversal.
 *
 * @see https://dom.spec.whatwg.org/#interface-nodelist
 */
export interface HtmlElementList extends Iterable<HtmlElement> {
  /**
   * Number of elements in the list.
   */
  readonly length: number;

  /**
   * Get element at index. Returns undefined if out of bounds.
   * Note: Unlike DOM's item() which returns null, we use undefined
   * for consistency with TypeScript array semantics.
   */
  item(index: number): HtmlElement | undefined;

  /**
   * Convert to array for standard array operations.
   * Returns a new array each time (not a live reference).
   */
  toArray(): readonly HtmlElement[];

  /**
   * Get the first element, or undefined if empty.
   * Convenience method equivalent to item(0).
   */
  first(): HtmlElement | undefined;

  /**
   * Get the last element, or undefined if empty.
   * Convenience method equivalent to item(length - 1).
   */
  last(): HtmlElement | undefined;
}

// =============================================================================
// Document Interface
// =============================================================================

/**
 * A parsed HTML document with query capabilities.
 * Entry point for all document queries.
 *
 * @see https://dom.spec.whatwg.org/#interface-document
 */
export interface HtmlDocument {
  /**
   * The document's root element (<html>).
   * May be null for fragment parsing or malformed documents.
   *
   * @see https://dom.spec.whatwg.org/#dom-document-documentelement
   */
  readonly documentElement: HtmlElement | null;

  /**
   * The document's <head> element, or null if not present.
   *
   * @see https://dom.spec.whatwg.org/#dom-document-head
   */
  readonly head: HtmlElement | null;

  /**
   * The document's <body> element, or null if not present.
   *
   * @see https://dom.spec.whatwg.org/#dom-document-body
   */
  readonly body: HtmlElement | null;

  /**
   * Query for elements matching a CSS selector.
   * Searches the entire document.
   *
   * @param selector - CSS selector string
   * @see https://dom.spec.whatwg.org/#dom-parentnode-queryselectorall
   */
  querySelectorAll(selector: string): HtmlElementList;

  /**
   * Query for the first element matching a CSS selector.
   *
   * @param selector - CSS selector string
   * @see https://dom.spec.whatwg.org/#dom-parentnode-queryselector
   */
  querySelector(selector: string): HtmlElement | null;

  /**
   * Get element by ID (faster than querySelector for ID lookup).
   *
   * @param id - The element ID (without # prefix)
   * @see https://dom.spec.whatwg.org/#dom-nonelementparentnode-getelementbyid
   */
  getElementById(id: string): HtmlElement | null;

  /**
   * Get elements by tag name.
   *
   * @param tagName - The tag name (case-insensitive for HTML)
   * @see https://dom.spec.whatwg.org/#dom-document-getelementsbytagname
   */
  getElementsByTagName(tagName: string): HtmlElementList;

  /**
   * Get elements by class name.
   *
   * @param className - Single class name (not space-separated)
   * @see https://dom.spec.whatwg.org/#dom-document-getelementsbyclassname
   */
  getElementsByClassName(className: string): HtmlElementList;

  /**
   * The document's title (from <title> element).
   * Empty string if no title element.
   *
   * @see https://dom.spec.whatwg.org/#dom-document-title
   */
  readonly title: string;

  /**
   * All elements with a name attribute matching the given value.
   *
   * @param name - The name attribute value
   * @see https://dom.spec.whatwg.org/#dom-document-getelementsbyname
   */
  getElementsByName(name: string): HtmlElementList;
}

// =============================================================================
// Parser Options and Results
// =============================================================================

/**
 * Options for HTML parsing.
 */
export interface HtmlParserOptions {
  /**
   * Whether to decode HTML entities in text content.
   * @default true
   */
  readonly decodeEntities?: boolean;

  /**
   * Whether this is a full document or a fragment.
   * Fragments don't require <html>/<body> structure.
   * @default false (assumes full document)
   */
  readonly fragment?: boolean;

  /**
   * Base URL for resolving relative URLs in the document.
   * Used by implementations that support URL resolution.
   */
  readonly baseUrl?: string;

  /**
   * Whether to collect parse warnings.
   * Some backends may not support warning collection.
   * @default false
   */
  readonly collectWarnings?: boolean;
}

/**
 * Result of parsing HTML.
 * Includes the document and any warnings encountered.
 */
export interface HtmlParseResult {
  /**
   * The parsed document.
   */
  readonly document: HtmlDocument;

  /**
   * Non-fatal warnings encountered during parsing.
   * Empty array if parsing was clean or collectWarnings is false.
   */
  readonly warnings: readonly HtmlParseWarning[];
}

/**
 * A warning encountered during HTML parsing.
 * Warnings are non-fatal - parsing continues but the markup was malformed.
 */
export interface HtmlParseWarning {
  /**
   * Warning type/code.
   */
  readonly code: HtmlParseWarningCode;

  /**
   * Human-readable warning message.
   */
  readonly message: string;

  /**
   * Approximate line number where the issue occurred (1-indexed).
   * May be undefined if position tracking is not available.
   */
  readonly line?: number;

  /**
   * Approximate column number (1-indexed).
   */
  readonly column?: number;
}

/**
 * Warning codes for common HTML parsing issues.
 * Extensible - implementations may define additional codes.
 */
export type HtmlParseWarningCode =
  | 'unclosed-tag'
  | 'unexpected-end-tag'
  | 'duplicate-attribute'
  | 'invalid-character'
  | 'malformed-comment'
  | 'missing-doctype'
  | 'unknown';

// =============================================================================
// Parser Interface
// =============================================================================

/**
 * HTML parser interface.
 * Takes HTML string, returns parsed document.
 *
 * @example
 * ```typescript
 * const { document } = parser.parse('<html><body>Hello</body></html>');
 * const body = document.body;
 * console.log(body?.textContent); // 'Hello'
 * ```
 */
export interface HtmlParser {
  /**
   * Parse an HTML string into a document.
   *
   * @param html - The HTML string to parse
   * @param options - Parser options
   * @returns Parse result with document and warnings
   *
   * @throws {HtmlParseError} Only for catastrophic failures (e.g., null input)
   *         Normal malformed HTML produces warnings, not errors.
   */
  parse(html: string, options?: HtmlParserOptions): HtmlParseResult;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error codes for parse failures.
 * These are catastrophic failures, not normal parse warnings.
 */
export type HtmlParseErrorCode =
  | 'null-input'
  | 'encoding-error'
  | 'resource-exhausted'
  | 'not-implemented';

/**
 * Error thrown for catastrophic parse failures or unimplemented features.
 * Normal malformed HTML produces warnings, not this error.
 */
export interface HtmlParseError extends Error {
  readonly name: 'HtmlParseError';
  readonly code: HtmlParseErrorCode;
}

/**
 * Error thrown when a method is not yet implemented.
 * Used during incremental port development.
 */
export interface NotImplementedError extends Error {
  readonly name: 'NotImplementedError';
  readonly method: string;
}

// =============================================================================
// DOM Provider Abstraction (for port implementations)
// =============================================================================

/**
 * DOM provider interface - adapts any DOM implementation to our contract.
 *
 * This is what library adapters (Cheerio, linkedom, happy-dom, browser DOM)
 * implement. The port wraps provider results in our standard interfaces.
 *
 * Design: Uses standard DOM method names (querySelector, getElementById, etc.)
 * to make implementations straightforward for any DOM-compatible library.
 */
export interface DomProvider {
  /**
   * Parse HTML string into a DOM document.
   *
   * @param html - HTML string to parse
   * @param options - Parse options
   */
  parseHtml(html: string, options?: DomParseOptions): DomDocument;
}

/**
 * Parse options for DOM provider.
 */
export interface DomParseOptions {
  readonly decodeEntities?: boolean;
}

/**
 * DOM document representation.
 * Uses standard DOM API method names.
 */
export interface DomDocument {
  querySelector(selector: string): DomElement | null;
  querySelectorAll(selector: string): DomElement[];
  getElementById(id: string): DomElement | null;
  getElementsByTagName(tagName: string): DomElement[];
  getElementsByClassName(className: string): DomElement[];
  readonly title: string;
  readonly documentElement: DomElement | null;
  readonly head: DomElement | null;
  readonly body: DomElement | null;
}

/**
 * DOM element representation.
 * Uses standard DOM API method names.
 * Optional methods allow incremental implementation.
 */
export interface DomElement {
  readonly tagName: string;
  getAttribute(name: string): string | null;
  hasAttribute?(name: string): boolean;
  getAttributeNames?(): string[];
  readonly textContent: string;
  readonly innerHTML: string;
  readonly outerHTML?: string;
  querySelector?(selector: string): DomElement | null;
  querySelectorAll?(selector: string): DomElement[];
  readonly children?: DomElement[] | ArrayLike<DomElement>;
  readonly parentElement?: DomElement | null;
  readonly firstElementChild?: DomElement | null;
  readonly lastElementChild?: DomElement | null;
  readonly nextElementSibling?: DomElement | null;
  readonly previousElementSibling?: DomElement | null;
  closest?(selector: string): DomElement | null;
  matches?(selector: string): boolean;
}
