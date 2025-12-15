import { ParseError } from '@conveaux/contracts';
import { describe, expect, it } from 'vitest';
import { parseHTML } from './parser.js';

const createMockHTML = (conversationData: object) => `
<!DOCTYPE html>
<html>
<head>
  <script id="__NEXT_DATA__" type="application/json">
    ${JSON.stringify({
      props: {
        pageProps: {
          serverResponse: {
            data: conversationData,
          },
        },
      },
    })}
  </script>
</head>
<body></body>
</html>
`;

describe('parseHTML', () => {
  it('parses a valid conversation', () => {
    const html = createMockHTML({
      id: 'test-123',
      title: 'Test Conversation',
      create_time: 1700000000,
      update_time: 1700001000,
      mapping: {
        root: {
          id: 'root',
          parent: null,
          children: ['msg1'],
        },
        msg1: {
          id: 'msg1',
          parent: 'root',
          children: ['msg2'],
          message: {
            id: 'msg1',
            author: { role: 'user' },
            content: { content_type: 'text', parts: ['Hello!'] },
            create_time: 1700000100,
          },
        },
        msg2: {
          id: 'msg2',
          parent: 'msg1',
          children: [],
          message: {
            id: 'msg2',
            author: { role: 'assistant' },
            content: { content_type: 'text', parts: ['Hi there!'] },
            create_time: 1700000200,
          },
        },
      },
    });

    const result = parseHTML(html);

    expect(result.id).toBe('test-123');
    expect(result.title).toBe('Test Conversation');
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe('user');
    expect(result.messages[0].content).toBe('Hello!');
    expect(result.messages[1].role).toBe('assistant');
    expect(result.messages[1].content).toBe('Hi there!');
  });

  it('skips system messages', () => {
    const html = createMockHTML({
      id: 'test-123',
      title: 'Test',
      create_time: 1700000000,
      update_time: 1700001000,
      mapping: {
        root: {
          id: 'root',
          parent: null,
          children: ['sys'],
        },
        sys: {
          id: 'sys',
          parent: 'root',
          children: ['msg1'],
          message: {
            id: 'sys',
            author: { role: 'system' },
            content: { content_type: 'text', parts: ['System prompt'] },
          },
        },
        msg1: {
          id: 'msg1',
          parent: 'sys',
          children: [],
          message: {
            id: 'msg1',
            author: { role: 'user' },
            content: { content_type: 'text', parts: ['Hello!'] },
          },
        },
      },
    });

    const result = parseHTML(html);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe('user');
  });

  it('throws ParseError when __NEXT_DATA__ is missing', () => {
    const html = '<html><body></body></html>';

    expect(() => parseHTML(html)).toThrow(ParseError);
  });

  it('throws ParseError when conversation data is missing', () => {
    const html = `
      <script id="__NEXT_DATA__">{"props":{}}</script>
    `;

    expect(() => parseHTML(html)).toThrow(ParseError);
  });

  it('handles multiline content in parts', () => {
    const html = createMockHTML({
      id: 'test-123',
      title: 'Test',
      create_time: 1700000000,
      update_time: 1700001000,
      mapping: {
        root: {
          id: 'root',
          parent: null,
          children: ['msg1'],
        },
        msg1: {
          id: 'msg1',
          parent: 'root',
          children: [],
          message: {
            id: 'msg1',
            author: { role: 'user' },
            content: {
              content_type: 'text',
              parts: ['Line 1', 'Line 2'],
            },
          },
        },
      },
    });

    const result = parseHTML(html);

    expect(result.messages[0].content).toBe('Line 1\nLine 2');
  });
});
