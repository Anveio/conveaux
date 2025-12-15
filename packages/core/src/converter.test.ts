import type { ParsedConversation } from '@conveaux/contracts';
import { describe, expect, it } from 'vitest';
import { convertToMarkdown } from './converter.js';

describe('convertToMarkdown', () => {
  const baseConversation: ParsedConversation = {
    id: 'test-123',
    title: 'Test Conversation',
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T11:00:00Z'),
    messages: [
      { role: 'user', content: 'Hello!' },
      { role: 'assistant', content: 'Hi there!' },
    ],
  };

  it('converts conversation to markdown with metadata', () => {
    const result = convertToMarkdown(baseConversation);

    expect(result).toContain('# Test Conversation');
    expect(result).toContain('> Exported from ChatGPT');
    expect(result).toContain('> Created: 2024-01-15T10:30:00.000Z');
    expect(result).toContain('> ID: test-123');
    expect(result).toContain('## User');
    expect(result).toContain('Hello!');
    expect(result).toContain('## Assistant');
    expect(result).toContain('Hi there!');
  });

  it('excludes metadata when includeMetadata is false', () => {
    const result = convertToMarkdown(baseConversation, {
      includeMetadata: false,
    });

    expect(result).toContain('# Test Conversation');
    expect(result).not.toContain('> Exported from ChatGPT');
    expect(result).not.toContain('---');
    expect(result).toContain('## User');
    expect(result).toContain('Hello!');
  });

  it('preserves code blocks in content', () => {
    const conversation: ParsedConversation = {
      ...baseConversation,
      messages: [
        {
          role: 'assistant',
          content: 'Here is some code:\n\n```javascript\nconst x = 1;\n```',
        },
      ],
    };

    const result = convertToMarkdown(conversation);

    expect(result).toContain('```javascript');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('```');
  });

  it('handles empty messages array', () => {
    const conversation: ParsedConversation = {
      ...baseConversation,
      messages: [],
    };

    const result = convertToMarkdown(conversation);

    expect(result).toContain('# Test Conversation');
    expect(result).not.toContain('## User');
    expect(result).not.toContain('## Assistant');
  });
});
