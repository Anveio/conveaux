/**
 * Wraps DOM elements in the HtmlElement interface.
 */

import type { DomElement, HtmlElement, HtmlElementList } from '@conveaux/contract-html-parser';
import { notImplemented } from './errors.js';

/**
 * Creates an HtmlElementList from an array of DOM elements.
 */
export function createElementList(
  elements: DomElement[],
  wrapFn: (el: DomElement) => HtmlElement
): HtmlElementList {
  const wrapped = elements.map(wrapFn);

  return {
    length: wrapped.length,

    item(index: number): HtmlElement | undefined {
      return wrapped[index];
    },

    toArray(): readonly HtmlElement[] {
      return [...wrapped];
    },

    first(): HtmlElement | undefined {
      return wrapped[0];
    },

    last(): HtmlElement | undefined {
      return wrapped[wrapped.length - 1];
    },

    [Symbol.iterator](): Iterator<HtmlElement> {
      return wrapped[Symbol.iterator]();
    },
  };
}

/**
 * Creates an empty HtmlElementList.
 */
export function emptyElementList(): HtmlElementList {
  return {
    length: 0,
    item: () => undefined,
    toArray: () => [],
    first: () => undefined,
    last: () => undefined,
    [Symbol.iterator]: function* () {
      // Empty iterator
    },
  };
}

/**
 * Wraps a DOM element in the HtmlElement interface.
 *
 * MVP Implementation Status:
 * - IMPLEMENTED: tagName, id, innerHTML, getAttribute, hasAttribute, getElementById equivalent
 * - NOT IMPLEMENTED: traversal (children, siblings), querySelector, closest, matches
 */
export function wrapElement(domEl: DomElement): HtmlElement {
  // Create wrapper function that captures this context
  const wrap = (el: DomElement): HtmlElement => wrapElement(el);

  const element: HtmlElement = {
    get tagName(): string {
      return domEl.tagName.toLowerCase();
    },

    get id(): string | null {
      return domEl.getAttribute('id') ?? null;
    },

    get classList(): readonly string[] {
      const classAttr = domEl.getAttribute('class');
      if (!classAttr) return [];
      return classAttr.split(/\s+/).filter(Boolean);
    },

    getAttribute(name: string): string | null {
      return domEl.getAttribute(name);
    },

    hasAttribute(name: string): boolean {
      if (domEl.hasAttribute) {
        return domEl.hasAttribute(name);
      }
      // Fallback: check if getAttribute returns non-null
      return domEl.getAttribute(name) !== null;
    },

    getAttributeNames(): readonly string[] {
      if (domEl.getAttributeNames) {
        return domEl.getAttributeNames();
      }
      return notImplemented('HtmlElement.getAttributeNames');
    },

    get textContent(): string {
      return domEl.textContent;
    },

    get innerHTML(): string {
      return domEl.innerHTML;
    },

    get outerHTML(): string {
      if (domEl.outerHTML !== undefined) {
        return domEl.outerHTML;
      }
      return notImplemented('HtmlElement.outerHTML');
    },

    querySelectorAll(selector: string): HtmlElementList {
      if (domEl.querySelectorAll) {
        const results = domEl.querySelectorAll(selector);
        return createElementList(results, wrap);
      }
      return notImplemented('HtmlElement.querySelectorAll');
    },

    querySelector(selector: string): HtmlElement | null {
      if (domEl.querySelector) {
        const result = domEl.querySelector(selector);
        return result ? wrap(result) : null;
      }
      return notImplemented('HtmlElement.querySelector');
    },

    get children(): HtmlElementList {
      if (domEl.children) {
        const childArray = Array.isArray(domEl.children)
          ? domEl.children
          : Array.from(domEl.children);
        return createElementList(childArray, wrap);
      }
      return notImplemented('HtmlElement.children');
    },

    get parentElement(): HtmlElement | null {
      if (domEl.parentElement !== undefined) {
        return domEl.parentElement ? wrap(domEl.parentElement) : null;
      }
      return notImplemented('HtmlElement.parentElement');
    },

    get firstElementChild(): HtmlElement | null {
      if (domEl.firstElementChild !== undefined) {
        return domEl.firstElementChild ? wrap(domEl.firstElementChild) : null;
      }
      return notImplemented('HtmlElement.firstElementChild');
    },

    get lastElementChild(): HtmlElement | null {
      if (domEl.lastElementChild !== undefined) {
        return domEl.lastElementChild ? wrap(domEl.lastElementChild) : null;
      }
      return notImplemented('HtmlElement.lastElementChild');
    },

    get nextElementSibling(): HtmlElement | null {
      if (domEl.nextElementSibling !== undefined) {
        return domEl.nextElementSibling ? wrap(domEl.nextElementSibling) : null;
      }
      return notImplemented('HtmlElement.nextElementSibling');
    },

    get previousElementSibling(): HtmlElement | null {
      if (domEl.previousElementSibling !== undefined) {
        return domEl.previousElementSibling ? wrap(domEl.previousElementSibling) : null;
      }
      return notImplemented('HtmlElement.previousElementSibling');
    },

    closest(selector: string): HtmlElement | null {
      if (domEl.closest) {
        const result = domEl.closest(selector);
        return result ? wrap(result) : null;
      }
      return notImplemented('HtmlElement.closest');
    },

    matches(selector: string): boolean {
      if (domEl.matches) {
        return domEl.matches(selector);
      }
      return notImplemented('HtmlElement.matches');
    },

    getData(key: string): string | null {
      return domEl.getAttribute(`data-${key}`);
    },
  };

  return element;
}
