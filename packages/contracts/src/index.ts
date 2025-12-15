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

export interface FetchOptions {
  timeout?: number; // Default: 10000ms
}

export interface ConvertOptions {
  includeMetadata?: boolean; // Default: true
}

// ============================================
// Error types
// ============================================

export class ConveauxError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'ConveauxError';
  }
}

export class InvalidURLError extends ConveauxError {
  constructor(url: string) {
    super(`Invalid ChatGPT share URL: ${url}`, 'INVALID_URL');
  }
}

export class FetchError extends ConveauxError {
  constructor(message: string) {
    super(message, 'FETCH_ERROR');
  }
}

export class ParseError extends ConveauxError {
  constructor(message: string) {
    super(message, 'PARSE_ERROR');
  }
}

// ============================================
// Port interfaces (for dependency injection)
// ============================================

export interface HttpFetcher {
  fetch(url: string, options?: FetchOptions): Promise<string>;
}
