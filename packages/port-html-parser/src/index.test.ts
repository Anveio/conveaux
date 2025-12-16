/**
 * Tests for port-html-parser.
 *
 * These are contract tests that verify the parser implementation
 * conforms to the HtmlParser interface.
 */

import { describe, expect, it } from 'vitest';
import { createHtmlParser } from './index.js';

// Factory to create parser for tests
function createTestParser() {
  return createHtmlParser();
}

describe('HtmlParser', () => {
  describe('parse()', () => {
    it('parses basic HTML document', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<html><body>Hello</body></html>');

      expect(document.body).not.toBeNull();
      expect(document.body?.textContent).toBe('Hello');
    });

    it('throws on null input', () => {
      const parser = createTestParser();

      expect(() => parser.parse(null as unknown as string)).toThrow('null');
      expect(() => parser.parse(undefined as unknown as string)).toThrow('null');
    });

    it('handles malformed HTML without throwing', () => {
      const parser = createTestParser();
      // Missing closing tags
      const { document } = parser.parse('<div><span>Test');

      expect(document.querySelector('span')?.textContent).toBe('Test');
    });

    it('returns empty warnings array', () => {
      const parser = createTestParser();
      const { warnings } = parser.parse('<html><body>Hello</body></html>');

      expect(warnings).toEqual([]);
    });
  });
});

describe('HtmlDocument', () => {
  describe('getElementById()', () => {
    it('finds element by ID', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <html>
          <body>
            <div id="main">Content</div>
          </body>
        </html>
      `);

      const element = document.getElementById('main');
      expect(element).not.toBeNull();
      expect(element?.tagName).toBe('div');
      expect(element?.textContent).toBe('Content');
    });

    it('returns null for non-existent ID', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<html><body></body></html>');

      expect(document.getElementById('nonexistent')).toBeNull();
    });
  });

  describe('querySelector()', () => {
    it('finds first matching element', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <html>
          <body>
            <p class="text">One</p>
            <p class="text">Two</p>
          </body>
        </html>
      `);

      const element = document.querySelector('.text');
      expect(element?.textContent).toBe('One');
    });

    it('supports tag + class selectors', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <html>
          <body>
            <div id="container">
              <span class="item">Found</span>
            </div>
          </body>
        </html>
      `);

      const element = document.querySelector('span.item');
      expect(element?.textContent).toBe('Found');
    });
  });

  describe('querySelectorAll()', () => {
    it('finds all matching elements', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <html>
          <body>
            <p class="text">One</p>
            <p class="text">Two</p>
            <p class="text">Three</p>
          </body>
        </html>
      `);

      const elements = document.querySelectorAll('.text');
      expect(elements.length).toBe(3);
      expect(elements.toArray().map((e) => e.textContent)).toEqual(['One', 'Two', 'Three']);
    });

    it('returns empty list for no matches', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<html><body></body></html>');

      const elements = document.querySelectorAll('.nonexistent');
      expect(elements.length).toBe(0);
    });
  });

  describe('title', () => {
    it('returns document title', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <html>
          <head><title>My Page</title></head>
          <body></body>
        </html>
      `);

      expect(document.title).toBe('My Page');
    });

    it('returns empty string if no title', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<html><body></body></html>');

      expect(document.title).toBe('');
    });
  });

  describe('documentElement, head, body', () => {
    it('returns structural elements', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <html>
          <head><title>Test</title></head>
          <body><p>Content</p></body>
        </html>
      `);

      expect(document.documentElement?.tagName).toBe('html');
      expect(document.head?.tagName).toBe('head');
      expect(document.body?.tagName).toBe('body');
    });
  });
});

describe('HtmlElement', () => {
  describe('innerHTML', () => {
    it('returns inner HTML content', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <script id="data" type="application/json">
          {"key": "value"}
        </script>
      `);

      const script = document.getElementById('data');
      expect(script?.innerHTML).toContain('"key": "value"');
    });
  });

  describe('textContent', () => {
    it('returns concatenated text of all descendants', () => {
      const parser = createTestParser();
      const { document } = parser.parse(`
        <div id="container">
          <span>Hello</span>
          <span>World</span>
        </div>
      `);

      const container = document.getElementById('container');
      expect(container?.textContent).toContain('Hello');
      expect(container?.textContent).toContain('World');
    });
  });

  describe('getAttribute()', () => {
    it('returns attribute value', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<a href="https://example.com" target="_blank">Link</a>');

      const link = document.querySelector('a');
      expect(link?.getAttribute('href')).toBe('https://example.com');
      expect(link?.getAttribute('target')).toBe('_blank');
    });

    it('returns null for non-existent attribute', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<div>Test</div>');

      const div = document.querySelector('div');
      expect(div?.getAttribute('nonexistent')).toBeNull();
    });
  });

  describe('hasAttribute()', () => {
    it('returns true if attribute exists', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<input type="text" disabled>');

      const input = document.querySelector('input');
      expect(input?.hasAttribute('type')).toBe(true);
      expect(input?.hasAttribute('disabled')).toBe(true);
      expect(input?.hasAttribute('readonly')).toBe(false);
    });
  });

  describe('id and classList', () => {
    it('returns id attribute', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<div id="main">Test</div>');

      expect(document.querySelector('div')?.id).toBe('main');
    });

    it('returns class list', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<div class="foo bar baz">Test</div>');

      const classList = document.querySelector('div')?.classList;
      expect(classList).toContain('foo');
      expect(classList).toContain('bar');
      expect(classList).toContain('baz');
    });
  });

  describe('getData()', () => {
    it('returns data attribute value', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<div data-user-id="123" data-active="true">Test</div>');

      const div = document.querySelector('div');
      expect(div?.getData('user-id')).toBe('123');
      expect(div?.getData('active')).toBe('true');
      expect(div?.getData('nonexistent')).toBeNull();
    });
  });
});

describe('HtmlElementList', () => {
  it('is iterable', () => {
    const parser = createTestParser();
    const { document } = parser.parse(`
      <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
      </ul>
    `);

    const items = document.querySelectorAll('li');
    const texts: string[] = [];
    for (const item of items) {
      texts.push(item.textContent);
    }

    expect(texts).toEqual(['One', 'Two', 'Three']);
  });

  describe('item()', () => {
    it('returns element at index', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<p>One</p><p>Two</p>');

      const paragraphs = document.querySelectorAll('p');
      expect(paragraphs.item(0)?.textContent).toBe('One');
      expect(paragraphs.item(1)?.textContent).toBe('Two');
      expect(paragraphs.item(2)).toBeUndefined();
    });
  });

  describe('first() and last()', () => {
    it('returns first and last elements', () => {
      const parser = createTestParser();
      const { document } = parser.parse('<p>First</p><p>Middle</p><p>Last</p>');

      const paragraphs = document.querySelectorAll('p');
      expect(paragraphs.first()?.textContent).toBe('First');
      expect(paragraphs.last()?.textContent).toBe('Last');
    });
  });
});

describe('chatgpt-share use case', () => {
  it('extracts __NEXT_DATA__ script content', () => {
    const parser = createTestParser();
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>ChatGPT</title>
          <script id="__NEXT_DATA__" type="application/json">
            {"props":{"pageProps":{"conversation":{"title":"Test"}}}}
          </script>
        </head>
        <body></body>
      </html>
    `;

    const { document } = parser.parse(html);
    const scriptTag = document.getElementById('__NEXT_DATA__');

    expect(scriptTag).not.toBeNull();
    expect(scriptTag?.tagName).toBe('script');

    const jsonContent = scriptTag?.innerHTML.trim();
    expect(jsonContent).toBeTruthy();

    const parsed = JSON.parse(jsonContent!);
    expect(parsed.props.pageProps.conversation.title).toBe('Test');
  });
});

describe('HTML entity decoding', () => {
  it('decodes common HTML entities', () => {
    const parser = createTestParser();
    const { document } = parser.parse('<div>&lt;script&gt; &amp; &quot;test&quot;</div>');

    expect(document.querySelector('div')?.textContent).toBe('<script> & "test"');
  });

  it('decodes numeric entities', () => {
    const parser = createTestParser();
    const { document } = parser.parse('<div>&#60;&#62;&#38;</div>');

    expect(document.querySelector('div')?.textContent).toBe('<>&');
  });

  it('decodes hex entities', () => {
    const parser = createTestParser();
    const { document } = parser.parse('<div>&#x3C;&#x3E;</div>');

    expect(document.querySelector('div')?.textContent).toBe('<>');
  });
});
