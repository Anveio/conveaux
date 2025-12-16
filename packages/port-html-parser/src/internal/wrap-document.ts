/**
 * Wraps DOM documents in the HtmlDocument interface.
 */

import type { DomDocument, HtmlDocument, HtmlElementList } from '@conveaux/contract-html-parser';
import { createElementList, wrapElement } from './wrap-element.js';

/**
 * Wraps a DOM document in the HtmlDocument interface.
 */
export function wrapDocument(domDoc: DomDocument): HtmlDocument {
  const document: HtmlDocument = {
    get documentElement() {
      return domDoc.documentElement ? wrapElement(domDoc.documentElement) : null;
    },

    get head() {
      return domDoc.head ? wrapElement(domDoc.head) : null;
    },

    get body() {
      return domDoc.body ? wrapElement(domDoc.body) : null;
    },

    querySelectorAll(selector: string): HtmlElementList {
      const results = domDoc.querySelectorAll(selector);
      return createElementList(results, wrapElement);
    },

    querySelector(selector: string) {
      const result = domDoc.querySelector(selector);
      return result ? wrapElement(result) : null;
    },

    getElementById(id: string) {
      const result = domDoc.getElementById(id);
      return result ? wrapElement(result) : null;
    },

    getElementsByTagName(tagName: string): HtmlElementList {
      const results = domDoc.getElementsByTagName(tagName);
      return createElementList(results, wrapElement);
    },

    getElementsByClassName(className: string): HtmlElementList {
      const results = domDoc.getElementsByClassName(className);
      return createElementList(results, wrapElement);
    },

    get title(): string {
      return domDoc.title;
    },

    getElementsByName(name: string): HtmlElementList {
      // Use querySelectorAll as fallback since not all DOM implementations have getElementsByName
      const results = domDoc.querySelectorAll(`[name="${name}"]`);
      return createElementList(results, wrapElement);
    },
  };

  return document;
}
