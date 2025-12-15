/**
 * @conveaux/chatgpt-share
 *
 * Domain logic for ChatGPT share pages.
 * Provides fetching, parsing, and markdown conversion.
 */

// Re-export types
export type {
  ChatGPTConversation,
  ConversationNode,
  ConvertOptions,
  FetchShareOptions,
  ParsedConversation,
  ParsedMessage,
} from './types.js';

// Re-export functions
export { extractShareId, fetchSharePage, validateURL } from './fetch.js';
export { parseHTML } from './parser.js';
export { convertToMarkdown } from './converter.js';
