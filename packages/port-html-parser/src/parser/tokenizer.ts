/**
 * HTML Tokenizer - converts HTML string into tokens.
 *
 * This is a simplified tokenizer that handles common HTML patterns.
 * It's designed to be correct for well-formed HTML and gracefully
 * handle common malformations.
 *
 * Future: Align more closely with WHATWG HTML parsing specification.
 */

/**
 * Token types produced by the tokenizer.
 */
export type TokenType =
  | 'doctype'
  | 'start-tag'
  | 'end-tag'
  | 'self-closing-tag'
  | 'text'
  | 'comment';

/**
 * A token produced by the tokenizer.
 */
export interface Token {
  readonly type: TokenType;
  readonly raw: string;
  readonly position: number;
}

/**
 * Start tag token with tag name and attributes.
 */
export interface StartTagToken extends Token {
  readonly type: 'start-tag';
  readonly tagName: string;
  readonly attributes: ReadonlyMap<string, string>;
  readonly selfClosing: boolean;
}

/**
 * End tag token.
 */
export interface EndTagToken extends Token {
  readonly type: 'end-tag';
  readonly tagName: string;
}

/**
 * Text token.
 */
export interface TextToken extends Token {
  readonly type: 'text';
  readonly content: string;
}

/**
 * Comment token.
 */
export interface CommentToken extends Token {
  readonly type: 'comment';
  readonly content: string;
}

/**
 * DOCTYPE token.
 */
export interface DoctypeToken extends Token {
  readonly type: 'doctype';
  readonly content: string;
}

export type AnyToken = StartTagToken | EndTagToken | TextToken | CommentToken | DoctypeToken;

/**
 * Tokenize an HTML string into a sequence of tokens.
 */
export function tokenize(html: string): AnyToken[] {
  const tokens: AnyToken[] = [];
  let position = 0;

  while (position < html.length) {
    // Try to match different token types
    const remaining = html.slice(position);

    // Comment: <!-- ... -->
    if (remaining.startsWith('<!--')) {
      const endIndex = remaining.indexOf('-->');
      if (endIndex !== -1) {
        const raw = remaining.slice(0, endIndex + 3);
        tokens.push({
          type: 'comment',
          raw,
          position,
          content: remaining.slice(4, endIndex),
        });
        position += raw.length;
        continue;
      }
    }

    // DOCTYPE: <!DOCTYPE ...>
    if (remaining.toUpperCase().startsWith('<!DOCTYPE')) {
      const endIndex = remaining.indexOf('>');
      if (endIndex !== -1) {
        const raw = remaining.slice(0, endIndex + 1);
        tokens.push({
          type: 'doctype',
          raw,
          position,
          content: raw,
        });
        position += raw.length;
        continue;
      }
    }

    // End tag: </tagname>
    if (remaining.startsWith('</')) {
      const match = remaining.match(/^<\/([a-zA-Z][a-zA-Z0-9-]*)\s*>/);
      if (match?.[1]) {
        tokens.push({
          type: 'end-tag',
          raw: match[0],
          position,
          tagName: match[1].toLowerCase(),
        });
        position += match[0].length;
        continue;
      }
    }

    // Start tag or self-closing tag: <tagname ...> or <tagname ... />
    if (remaining.startsWith('<') && !remaining.startsWith('<!')) {
      const tagMatch = remaining.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
      if (tagMatch?.[1]) {
        const tagName = tagMatch[1].toLowerCase();

        // Find the end of the tag
        let i = tagMatch[0].length;
        const attributes = new Map<string, string>();

        // Parse attributes
        while (i < remaining.length) {
          // Skip whitespace
          while (i < remaining.length && /\s/.test(remaining.charAt(i))) {
            i++;
          }

          // Check for end of tag
          if (remaining.charAt(i) === '>') {
            i++;
            break;
          }

          // Check for self-closing
          if (remaining.slice(i, i + 2) === '/>') {
            i += 2;
            const raw = remaining.slice(0, i);
            tokens.push({
              type: 'start-tag',
              raw,
              position,
              tagName,
              attributes,
              selfClosing: true,
            });
            position += raw.length;
            break;
          }

          // Parse attribute name
          const attrNameMatch = remaining.slice(i).match(/^([a-zA-Z_:][a-zA-Z0-9_:.-]*)/);
          if (!attrNameMatch?.[1]) {
            i++;
            continue;
          }

          const attrName = attrNameMatch[1].toLowerCase();
          i += attrNameMatch[0].length;

          // Skip whitespace
          while (i < remaining.length && /\s/.test(remaining.charAt(i))) {
            i++;
          }

          // Check for = sign
          if (remaining.charAt(i) === '=') {
            i++;

            // Skip whitespace
            while (i < remaining.length && /\s/.test(remaining.charAt(i))) {
              i++;
            }

            // Parse attribute value
            let value: string;
            const quoteChar = remaining.charAt(i);
            if (quoteChar === '"' || quoteChar === "'") {
              i++;
              const valueStart = i;
              while (i < remaining.length && remaining.charAt(i) !== quoteChar) {
                i++;
              }
              value = remaining.slice(valueStart, i);
              i++; // Skip closing quote
            } else {
              // Unquoted value
              const valueStart = i;
              while (i < remaining.length && !/[\s>]/.test(remaining.charAt(i))) {
                i++;
              }
              value = remaining.slice(valueStart, i);
            }
            attributes.set(attrName, decodeHtmlEntities(value));
          } else {
            // Boolean attribute (no value)
            attributes.set(attrName, '');
          }
        }

        // Check if we ended the tag properly
        if (remaining.charAt(i - 1) === '>' || remaining.slice(i - 2, i) === '/>') {
          const raw = remaining.slice(0, i);
          const selfClosing = remaining.slice(i - 2, i) === '/>' || isVoidElement(tagName);

          tokens.push({
            type: 'start-tag',
            raw,
            position,
            tagName,
            attributes,
            selfClosing,
          });
          position += raw.length;
          continue;
        }
      }
    }

    // Text content (everything until next <)
    const nextTagIndex = remaining.indexOf('<', 1);
    if (remaining.charAt(0) !== '<') {
      const textEnd = nextTagIndex === -1 ? remaining.length : nextTagIndex;
      const raw = remaining.slice(0, textEnd);
      const content = decodeHtmlEntities(raw);

      if (content.trim()) {
        tokens.push({
          type: 'text',
          raw,
          position,
          content,
        });
      }
      position += raw.length;
      continue;
    }

    // Fallback: treat as text if nothing matches
    position++;
  }

  return tokens;
}

/**
 * HTML void elements (self-closing by definition).
 */
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function isVoidElement(tagName: string): boolean {
  return VOID_ELEMENTS.has(tagName.toLowerCase());
}

/**
 * Decode common HTML entities.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}
