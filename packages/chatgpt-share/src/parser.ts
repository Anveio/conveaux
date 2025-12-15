/**
 * HTML parsing for ChatGPT share pages.
 */

import { ParseError } from '@conveaux/contract-error';
import * as cheerio from 'cheerio';

import type {
  ChatGPTConversation,
  ConversationNode,
  ParsedConversation,
  ParsedMessage,
} from './types.js';

interface NextDataProps {
  pageProps?: {
    serverResponse?: {
      data?: ChatGPTConversation;
    };
    data?: ChatGPTConversation;
  };
}

interface NextData {
  props?: NextDataProps;
}

function extractConversationData(nextData: NextData): ChatGPTConversation {
  // Try different paths where conversation data might be
  const conversation =
    nextData.props?.pageProps?.serverResponse?.data ?? nextData.props?.pageProps?.data;

  if (!conversation) {
    throw new ParseError('Could not find conversation data (page format may have changed)');
  }

  if (!conversation.mapping || typeof conversation.mapping !== 'object') {
    throw new ParseError('Could not parse conversation data');
  }

  return conversation;
}

function findRootNode(mapping: Record<string, ConversationNode>): ConversationNode | null {
  for (const node of Object.values(mapping)) {
    if (!node.parent || node.parent === null) {
      return node;
    }
  }
  return null;
}

function walkConversationTree(
  mapping: Record<string, ConversationNode>,
  startNode: ConversationNode
): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  let currentNode: ConversationNode | undefined = startNode;

  while (currentNode) {
    if (currentNode.message) {
      const { author, content, create_time } = currentNode.message;

      // Skip system and tool messages
      if (author.role === 'user' || author.role === 'assistant') {
        // Extract text content from parts array
        let textContent = '';

        if (content.parts && Array.isArray(content.parts)) {
          textContent = content.parts
            .filter((part): part is string => typeof part === 'string')
            .join('\n');
        } else if (content.text) {
          textContent = content.text;
        }

        if (textContent.trim()) {
          const message: ParsedMessage = {
            role: author.role,
            content: textContent,
          };

          if (create_time) {
            message.timestamp = new Date(create_time * 1000);
          }

          messages.push(message);
        }
      }
    }

    // Move to first child (following the main conversation path)
    const firstChild: string | undefined = currentNode.children?.[0];
    if (firstChild !== undefined) {
      currentNode = mapping[firstChild];
    } else {
      currentNode = undefined;
    }
  }

  return messages;
}

/**
 * Parses HTML from a ChatGPT share page into a structured conversation.
 *
 * @param html - The HTML content of the share page
 * @returns The parsed conversation
 */
export function parseHTML(html: string): ParsedConversation {
  const $ = cheerio.load(html);
  const scriptTag = $('script#__NEXT_DATA__');

  if (!scriptTag.length) {
    throw new ParseError('Could not find conversation data (page format may have changed)');
  }

  const jsonContent = scriptTag.html();
  if (!jsonContent) {
    throw new ParseError('Could not parse conversation data');
  }

  let nextData: NextData;
  try {
    nextData = JSON.parse(jsonContent) as NextData;
  } catch {
    throw new ParseError('Could not parse conversation data');
  }

  const conversation = extractConversationData(nextData);

  const rootNode = findRootNode(conversation.mapping);
  if (!rootNode) {
    throw new ParseError('Could not parse conversation data');
  }

  const messages = walkConversationTree(conversation.mapping, rootNode);

  if (messages.length === 0) {
    throw new ParseError('Conversation appears to be empty');
  }

  return {
    id: conversation.id,
    title: conversation.title || 'Untitled Conversation',
    createdAt: new Date(conversation.create_time * 1000),
    updatedAt: new Date(conversation.update_time * 1000),
    messages,
  };
}
