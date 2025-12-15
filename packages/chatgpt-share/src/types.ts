/**
 * Types for ChatGPT conversation data.
 */

// ============================================
// ChatGPT conversation structure from __NEXT_DATA__
// ============================================

export interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ConversationNode>;
  current_node?: string;
}

export interface ConversationNode {
  id: string;
  message?: MessageContent;
  parent?: string | null;
  children: string[];
}

export interface MessageContent {
  id: string;
  author: AuthorInfo;
  content: ContentBlock;
  create_time?: number | null;
}

export interface AuthorInfo {
  role: 'user' | 'assistant' | 'system' | 'tool';
  name?: string;
}

export interface ContentBlock {
  content_type: string;
  parts?: string[];
  text?: string;
}

// ============================================
// Parsed output for converter
// ============================================

export interface ParsedMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface ParsedConversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messages: ParsedMessage[];
}

// ============================================
// Options
// ============================================

export interface FetchShareOptions {
  /** Request timeout in milliseconds. Default: 10000 */
  timeout?: number;
}

export interface ConvertOptions {
  /** Include metadata header in output. Default: true */
  includeMetadata?: boolean;
}
