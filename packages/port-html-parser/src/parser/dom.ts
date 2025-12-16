/**
 * DOM Tree Builder - builds a DOM tree from tokens.
 *
 * This creates a minimal DOM implementation that satisfies the
 * DomDocument and DomElement interfaces.
 */

import type { DomDocument, DomElement } from '@conveaux/contract-html-parser';
import { type EndTagToken, type StartTagToken, type TextToken, tokenize } from './tokenizer.js';

/**
 * Internal element node.
 */
interface ElementNode {
  type: 'element';
  tagName: string;
  attributes: Map<string, string>;
  children: Array<ElementNode | TextNode>;
  parent: ElementNode | null;
}

/**
 * Internal text node.
 */
interface TextNode {
  type: 'text';
  content: string;
}

/**
 * Create a text node.
 */
function createTextNode(content: string): TextNode {
  return { type: 'text', content };
}

/**
 * Raw content tags - their content is not parsed as HTML.
 */
const RAW_CONTENT_TAGS = new Set(['script', 'style', 'textarea', 'title']);

/**
 * Build a DOM tree from HTML string.
 */
export function buildDom(html: string): DomDocument {
  const tokens = tokenize(html);
  const root = createRootElement();

  let current: ElementNode = root;
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i]!;

    if (token.type === 'start-tag') {
      const startTag = token as StartTagToken;
      const element = createElement(startTag.tagName, startTag.attributes);
      element.parent = current;
      current.children.push(element);

      // For raw content tags, grab everything until the closing tag
      if (RAW_CONTENT_TAGS.has(startTag.tagName) && !startTag.selfClosing) {
        const closeTagPattern = `</${startTag.tagName}>`;
        const startPos = startTag.position + startTag.raw.length;
        const closePos = html.toLowerCase().indexOf(closeTagPattern.toLowerCase(), startPos);

        if (closePos !== -1) {
          const rawContent = html.slice(startPos, closePos);
          if (rawContent) {
            element.children.push(createTextNode(rawContent));
          }
          // Skip tokens until after the close tag
          const closeEndPos = closePos + closeTagPattern.length;
          while (i < tokens.length) {
            const tok = tokens[i];
            if (!tok || tok.position >= closeEndPos) break;
            i++;
          }
          continue;
        }
      }

      if (!startTag.selfClosing) {
        current = element;
      }
    } else if (token.type === 'end-tag') {
      const endTag = token as EndTagToken;
      // Find matching open tag and close it
      let target: ElementNode | null = current;
      while (target && target.tagName !== endTag.tagName) {
        target = target.parent;
      }
      if (target?.parent) {
        current = target.parent;
      }
    } else if (token.type === 'text') {
      const textToken = token as TextToken;
      current.children.push(createTextNode(textToken.content));
    }

    i++;
  }

  return wrapAsDocument(root);
}

/**
 * Create a root element to hold the document.
 */
function createRootElement(): ElementNode {
  return {
    type: 'element',
    tagName: '#root',
    attributes: new Map(),
    children: [],
    parent: null,
  };
}

/**
 * Create an element node.
 */
function createElement(tagName: string, attributes: ReadonlyMap<string, string>): ElementNode {
  return {
    type: 'element',
    tagName: tagName.toLowerCase(),
    attributes: new Map(attributes),
    children: [],
    parent: null,
  };
}

/**
 * Wrap an element node as DomElement.
 */
function wrapElement(node: ElementNode): DomElement {
  const getTextContent = (): string => {
    let text = '';
    for (const child of node.children) {
      if (child.type === 'text') {
        text += (child as TextNode).content;
      } else if (child.type === 'element') {
        text += wrapElement(child as ElementNode).textContent;
      }
    }
    return text;
  };

  const getInnerHtml = (): string => {
    let html = '';
    for (const child of node.children) {
      if (child.type === 'text') {
        html += (child as TextNode).content;
      } else if (child.type === 'element') {
        html += wrapElement(child as ElementNode).outerHTML;
      }
    }
    return html;
  };

  const getOuterHtml = (): string => {
    const attrs = Array.from(node.attributes.entries())
      .map(([k, v]) => (v === '' ? k : `${k}="${escapeHtml(v)}"`))
      .join(' ');

    const attrStr = attrs ? ` ${attrs}` : '';
    const inner = getInnerHtml();

    return `<${node.tagName}${attrStr}>${inner}</${node.tagName}>`;
  };

  const querySelectorAll = (selector: string): DomElement[] => {
    const results: DomElement[] = [];
    collectMatches(node, parseSelector(selector), results);
    return results;
  };

  const element: DomElement = {
    get tagName() {
      return node.tagName;
    },

    getAttribute(name: string): string | null {
      return node.attributes.get(name.toLowerCase()) ?? null;
    },

    hasAttribute(name: string): boolean {
      return node.attributes.has(name.toLowerCase());
    },

    getAttributeNames(): string[] {
      return Array.from(node.attributes.keys());
    },

    get textContent() {
      return getTextContent();
    },

    get innerHTML() {
      return getInnerHtml();
    },

    get outerHTML() {
      return getOuterHtml();
    },

    querySelector(selector: string): DomElement | null {
      const results = querySelectorAll(selector);
      return results[0] ?? null;
    },

    querySelectorAll,

    get children(): DomElement[] {
      return node.children.filter((c): c is ElementNode => c.type === 'element').map(wrapElement);
    },

    get parentElement(): DomElement | null {
      return node.parent && node.parent.tagName !== '#root' ? wrapElement(node.parent) : null;
    },

    get firstElementChild(): DomElement | null {
      const first = node.children.find((c): c is ElementNode => c.type === 'element');
      return first ? wrapElement(first) : null;
    },

    get lastElementChild(): DomElement | null {
      for (let i = node.children.length - 1; i >= 0; i--) {
        const child = node.children[i]!;
        if (child.type === 'element') {
          return wrapElement(child);
        }
      }
      return null;
    },

    get nextElementSibling(): DomElement | null {
      if (!node.parent) return null;
      const siblings = node.parent.children;
      const index = siblings.indexOf(node);
      for (let i = index + 1; i < siblings.length; i++) {
        const sibling = siblings[i]!;
        if (sibling.type === 'element') {
          return wrapElement(sibling);
        }
      }
      return null;
    },

    get previousElementSibling(): DomElement | null {
      if (!node.parent) return null;
      const siblings = node.parent.children;
      const index = siblings.indexOf(node);
      for (let i = index - 1; i >= 0; i--) {
        const sibling = siblings[i]!;
        if (sibling.type === 'element') {
          return wrapElement(sibling);
        }
      }
      return null;
    },

    closest(selector: string): DomElement | null {
      const parsed = parseSelector(selector);
      let current: ElementNode | null = node;
      while (current) {
        if (matchesSelector(current, parsed)) {
          return wrapElement(current);
        }
        current = current.parent;
      }
      return null;
    },

    matches(selector: string): boolean {
      return matchesSelector(node, parseSelector(selector));
    },
  };

  return element;
}

/**
 * Wrap the root as a DomDocument.
 */
function wrapAsDocument(root: ElementNode): DomDocument {
  const findElement = (tagName: string): ElementNode | null => {
    const find = (node: ElementNode): ElementNode | null => {
      if (node.tagName === tagName) return node;
      for (const child of node.children) {
        if (child.type === 'element') {
          const found = find(child as ElementNode);
          if (found) return found;
        }
      }
      return null;
    };
    return find(root);
  };

  const querySelectorAll = (selector: string): DomElement[] => {
    const results: DomElement[] = [];
    collectMatches(root, parseSelector(selector), results);
    return results;
  };

  return {
    querySelector(selector: string): DomElement | null {
      const results = querySelectorAll(selector);
      return results[0] ?? null;
    },

    querySelectorAll,

    getElementById(id: string): DomElement | null {
      return this.querySelector(`#${id}`);
    },

    getElementsByTagName(tagName: string): DomElement[] {
      return querySelectorAll(tagName.toLowerCase());
    },

    getElementsByClassName(className: string): DomElement[] {
      return querySelectorAll(`.${className}`);
    },

    get title(): string {
      const titleEl = findElement('title');
      if (!titleEl) return '';
      return wrapElement(titleEl).textContent;
    },

    get documentElement(): DomElement | null {
      const html = findElement('html');
      return html ? wrapElement(html) : null;
    },

    get head(): DomElement | null {
      const head = findElement('head');
      return head ? wrapElement(head) : null;
    },

    get body(): DomElement | null {
      const body = findElement('body');
      return body ? wrapElement(body) : null;
    },
  };
}

// =============================================================================
// Simple CSS Selector Parser
// =============================================================================

interface ParsedSelector {
  tagName?: string;
  id?: string;
  classes: string[];
  attributes: Array<{ name: string; value?: string; operator?: string }>;
}

/**
 * Parse a simple CSS selector.
 * Supports: tagname, #id, .class, [attr], [attr=value]
 *
 * Note: IDs and classes can start with underscore or hyphen in HTML5.
 */
function parseSelector(selector: string): ParsedSelector {
  const parsed: ParsedSelector = { classes: [], attributes: [] };

  // Simple regex-based parsing
  let remaining = selector.trim();

  // Tag name (must come first if present, starts with letter)
  const tagMatch = remaining.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch?.[1]) {
    parsed.tagName = tagMatch[1].toLowerCase();
    remaining = remaining.slice(tagMatch[0].length);
  }

  // ID (can start with letter, underscore, or hyphen per HTML5)
  const idMatch = remaining.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/);
  if (idMatch?.[1]) {
    parsed.id = idMatch[1];
    remaining = remaining.replace(idMatch[0], '');
  }

  // Classes (can start with letter, underscore, or hyphen)
  const classMatches = remaining.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g);
  for (const match of classMatches) {
    if (match[1]) {
      parsed.classes.push(match[1]);
    }
  }

  // Attributes
  const attrMatches = remaining.matchAll(
    /\[([a-zA-Z_-][a-zA-Z0-9_-]*)(?:=["']?([^"'\]]+)["']?)?\]/g
  );
  for (const match of attrMatches) {
    if (match[1]) {
      parsed.attributes.push({
        name: match[1].toLowerCase(),
        value: match[2],
        operator: match[2] !== undefined ? '=' : undefined,
      });
    }
  }

  return parsed;
}

/**
 * Check if an element matches a parsed selector.
 */
function matchesSelector(node: ElementNode, selector: ParsedSelector): boolean {
  // Skip root
  if (node.tagName === '#root') return false;

  // Tag name
  if (selector.tagName && node.tagName !== selector.tagName) {
    return false;
  }

  // ID
  if (selector.id) {
    const nodeId = node.attributes.get('id');
    if (nodeId !== selector.id) return false;
  }

  // Classes
  if (selector.classes.length > 0) {
    const nodeClasses = (node.attributes.get('class') ?? '').split(/\s+/).filter(Boolean);
    for (const cls of selector.classes) {
      if (!nodeClasses.includes(cls)) return false;
    }
  }

  // Attributes
  for (const attr of selector.attributes) {
    if (!node.attributes.has(attr.name)) return false;
    if (attr.value !== undefined) {
      if (node.attributes.get(attr.name) !== attr.value) return false;
    }
  }

  return true;
}

/**
 * Collect all elements matching a selector.
 */
function collectMatches(node: ElementNode, selector: ParsedSelector, results: DomElement[]): void {
  if (matchesSelector(node, selector)) {
    results.push(wrapElement(node));
  }

  for (const child of node.children) {
    if (child.type === 'element') {
      collectMatches(child as ElementNode, selector, results);
    }
  }
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
