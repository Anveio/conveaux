# Conveaux - AI Conversation Export CLI

## Vision
**Conveaux** is a CLI tool that converts AI conversation share links to markdown files. Starting with ChatGPT, it will expand to support Claude, Gemini, and other AI conversation platforms.

## MVP Scope (v0.1.0)
Convert public ChatGPT share links to clean markdown files.

```bash
conveaux https://chatgpt.com/share/abc123
# Output: conversation-abc123.md

conveaux https://chatgpt.com/share/abc123 -o my-chat.md
# Output: my-chat.md
```

---

## Technical Architecture

### Core Insight
ChatGPT share pages embed the full conversation as JSON in a `<script id="__NEXT_DATA__">` tag. No authentication or headless browser needed—just fetch, parse, convert.

### Data Flow
```
URL Input → Fetch HTML → Extract __NEXT_DATA__ → Parse JSON → Convert to Markdown → Write File
```

### Project Structure
```
conveaux/
├── src/
│   ├── cli.ts           # Commander.js entry point
│   ├── fetcher.ts       # HTTP client to fetch share page
│   ├── parser.ts        # Extract JSON from HTML, validate structure
│   ├── converter.ts     # Transform conversation to markdown
│   ├── types.ts         # TypeScript interfaces (NO 'any' types)
│   └── index.ts         # Library exports
├── package.json
├── tsconfig.json
└── README.md
```

---

## Module Specifications

### 1. Types (`src/types.ts`)

Define strict TypeScript interfaces. **No `any` types allowed.**

```typescript
// ChatGPT conversation structure from __NEXT_DATA__
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
  parent?: string;
  children: string[];
}

export interface MessageContent {
  id: string;
  author: AuthorInfo;
  content: ContentBlock;
  create_time?: number;
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

// Parsed output for converter
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

// Error types
export class ConveauxError extends Error {
  constructor(message: string, public code: string) {
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
```

### 2. Fetcher (`src/fetcher.ts`)

Fetch the share page HTML with proper headers.

```typescript
export interface FetchOptions {
  timeout?: number;  // Default: 10000ms
}

export async function fetchSharePage(url: string, options?: FetchOptions): Promise<string>
```

**Requirements:**
- Validate URL format: must match `https://chatgpt.com/share/*` or `https://chat.openai.com/share/*`
- Set realistic `User-Agent` header
- Handle redirects (follow them)
- Timeout after 10 seconds by default
- Throw `InvalidURLError` for bad URLs
- Throw `FetchError` for network issues, 404s, etc.

### 3. Parser (`src/parser.ts`)

Extract and validate conversation data from HTML.

```typescript
export function parseHTML(html: string): ParsedConversation
```

**Requirements:**
- Use Cheerio to find `<script id="__NEXT_DATA__">`
- Parse JSON content
- Navigate to conversation data (path may vary, handle both structures):
  - `props.pageProps.serverResponse.data`
  - `props.pageProps.data`
- Walk the conversation tree from root to leaf:
  - Find root node (node with no parent or parent is null)
  - Follow `children` array to build message sequence
  - Skip nodes without `message` property
  - Skip `system` role messages
- Convert timestamps from Unix epoch to Date objects
- Extract text content from `content.parts[]` array
- Throw `ParseError` if structure is invalid or missing

### 4. Converter (`src/converter.ts`)

Transform parsed conversation to markdown.

```typescript
export interface ConvertOptions {
  includeMetadata?: boolean;  // Default: true
}

export function convertToMarkdown(conversation: ParsedConversation, options?: ConvertOptions): string
```

**Output format:**
```markdown
# [Conversation Title]

> Exported from ChatGPT via [Conveaux](https://github.com/user/conveaux)
> Created: 2024-01-15T10:30:00Z
> ID: abc123-def456

---

## User

[First user message]

## Assistant

[First assistant response with `code blocks` preserved]

## User

[Second user message]

...
```

**Requirements:**
- Preserve code blocks (triple backticks) from original
- Preserve inline code (single backticks)
- Don't double-escape markdown (if content has `#`, keep it)
- Handle multiline messages properly
- Blank line between sections

### 5. CLI (`src/cli.ts`)

Command-line interface using Commander.js.

```typescript
#!/usr/bin/env node
```

**Commands:**
```bash
conveaux <url>                    # Convert and output to default filename
conveaux <url> -o <path>          # Convert and output to specified file
conveaux <url> --no-metadata      # Skip metadata header
conveaux --version                # Show version
conveaux --help                   # Show help
```

**Default filename:** `conversation-{shareId}.md` (extract shareId from URL)

**Requirements:**
- Parse URL from positional argument
- Validate URL before fetching
- Show spinner/progress for fetch operation (use ora or simple dots)
- Write output file
- Print success message with output path
- Print clear error messages on failure (no stack traces for user errors)
- Exit code 0 on success, 1 on error

### 6. Index (`src/index.ts`)

Export library functions for programmatic use.

```typescript
export { fetchSharePage } from './fetcher.js';
export { parseHTML } from './parser.js';
export { convertToMarkdown } from './converter.js';
export * from './types.js';

// Convenience function
export async function convert(url: string): Promise<string> {
  const html = await fetchSharePage(url);
  const conversation = parseHTML(html);
  return convertToMarkdown(conversation);
}
```

---

## Dependencies

```json
{
  "dependencies": {
    "chalk": "^5.3.0",
    "cheerio": "^1.0.0",
    "commander": "^12.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

---

## Error Handling

| Scenario | Error Type | User Message |
|----------|------------|--------------|
| Invalid URL format | `InvalidURLError` | "Invalid ChatGPT share URL: {url}" |
| Network timeout | `FetchError` | "Request timed out after 10 seconds" |
| 404 Not Found | `FetchError` | "Conversation not found (may be private or deleted)" |
| Network error | `FetchError` | "Network error: {message}" |
| Missing __NEXT_DATA__ | `ParseError` | "Could not find conversation data (page format may have changed)" |
| Invalid JSON | `ParseError` | "Could not parse conversation data" |
| Empty conversation | `ParseError` | "Conversation appears to be empty" |

---

## Success Criteria

1. **Works with real ChatGPT share links** - Test with actual public conversations
2. **Clean markdown output** - Readable, properly formatted, code blocks preserved
3. **Good error messages** - User knows what went wrong and how to fix it
4. **Fast** - Under 2 seconds for typical conversations
5. **No runtime errors** - Handle edge cases gracefully

---

## Testing Checklist

- [ ] Valid ChatGPT share URL converts successfully
- [ ] Invalid URL shows clear error
- [ ] 404 URL shows "not found" error
- [ ] Code blocks in conversation are preserved
- [ ] Long conversations work (100+ messages)
- [ ] Conversations with only user messages work
- [ ] Output file is created at correct path
- [ ] `--output` flag works
- [ ] `--no-metadata` flag works
- [ ] `--help` shows usage
- [ ] `--version` shows version

---

## Future Enhancements (Not MVP)

- Claude share link support
- Batch conversion (multiple URLs)
- JSON output format
- Watch mode for clipboard
- Browser extension
