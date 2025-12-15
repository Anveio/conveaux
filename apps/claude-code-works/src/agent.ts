/**
 * Agent that interacts with the Claude API.
 *
 * Handles the message loop, tool execution, and response parsing.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getToolDefinitions, executeTool } from './tools';
import { output } from './output';
import { isRecord, getErrorMessage } from './type-guards';

type MessageParam = Anthropic.MessageParam;
type ContentBlock = Anthropic.ContentBlock;
type ToolUseBlock = Anthropic.ToolUseBlock;
type TextBlock = Anthropic.TextBlock;

export interface AgentConfig {
  systemPrompt: string;
  maxIterations: number;
  model?: string;
}

export interface AgentResult {
  success: boolean;
  output: string;
  toolCalls: Array<{ tool: string; input: unknown; result: string }>;
  error?: string;
}

/**
 * Run the agent with a given task.
 */
export async function runAgent(
  task: string,
  config: AgentConfig
): Promise<AgentResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      output: '',
      toolCalls: [],
      error: 'ANTHROPIC_API_KEY environment variable is not set',
    };
  }

  const client = new Anthropic({ apiKey });
  const messages: MessageParam[] = [{ role: 'user', content: task }];
  const toolCalls: AgentResult['toolCalls'] = [];
  const model = config.model ?? 'claude-sonnet-4-20250514';

  let iterations = 0;

  while (iterations < config.maxIterations) {
    iterations++;
    output.dim(`  [iteration ${iterations}/${config.maxIterations}]`);

    try {
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: config.systemPrompt,
        tools: getToolDefinitions() as Anthropic.Tool[],
        messages,
      });

      // Check for text response
      const textBlocks = response.content.filter(
        (block): block is TextBlock => block.type === 'text'
      );

      // Check for tool use
      const toolUseBlocks = response.content.filter(
        (block): block is ToolUseBlock => block.type === 'tool_use'
      );

      // If no tool use, we're done
      if (toolUseBlocks.length === 0) {
        const finalOutput = textBlocks.map(b => b.text).join('\n');
        return {
          success: true,
          output: finalOutput,
          toolCalls,
        };
      }

      // Execute tools and build response
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        output.step(`${toolUse.name}(${summarizeInput(toolUse.input)})`);

        const result = isRecord(toolUse.input)
          ? await executeTool(toolUse.name, toolUse.input)
          : `Error: Invalid tool input for ${toolUse.name}`;

        toolCalls.push({
          tool: toolUse.name,
          input: toolUse.input,
          result: result.slice(0, 500), // Truncate for logging
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result,
        });
      }

      // Add assistant message with tool use
      messages.push({
        role: 'assistant',
        content: response.content,
      });

      // Add tool results
      messages.push({
        role: 'user',
        content: toolResults,
      });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        const finalOutput = textBlocks.map(b => b.text).join('\n');
        return {
          success: true,
          output: finalOutput,
          toolCalls,
        };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        toolCalls,
        error: getErrorMessage(error),
      };
    }
  }

  return {
    success: false,
    output: '',
    toolCalls,
    error: `Max iterations (${config.maxIterations}) reached`,
  };
}

/**
 * Summarize tool input for logging.
 */
function summarizeInput(input: unknown): string {
  if (!isRecord(input)) {
    return '';
  }

  const parts: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      // Truncate long strings
      const display = value.length > 50 ? value.slice(0, 47) + '...' : value;
      parts.push(`${key}="${display}"`);
    }
  }

  return parts.join(', ');
}
