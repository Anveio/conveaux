import type { ConvertOptions, ParsedConversation } from '@conveaux/contracts';

function formatRole(role: 'user' | 'assistant'): string {
  return role === 'user' ? 'User' : 'Assistant';
}

export function convertToMarkdown(
  conversation: ParsedConversation,
  options?: ConvertOptions
): string {
  const includeMetadata = options?.includeMetadata ?? true;

  const lines: string[] = [];

  // Title
  lines.push(`# ${conversation.title}`);
  lines.push('');

  // Metadata
  if (includeMetadata) {
    lines.push('> Exported from ChatGPT via [Conveaux](https://github.com/user/conveaux)');
    lines.push(`> Created: ${conversation.createdAt.toISOString()}`);
    lines.push(`> ID: ${conversation.id}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // Messages
  for (const message of conversation.messages) {
    lines.push(`## ${formatRole(message.role)}`);
    lines.push('');
    lines.push(message.content);
    lines.push('');
  }

  return lines.join('\n');
}
