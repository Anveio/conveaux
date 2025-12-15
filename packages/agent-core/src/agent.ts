/**
 * Agent class that wraps the Anthropic SDK and runs the agentic loop.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  AgentConfig,
  AgentResult,
  ToolCall,
  MaxIterationsError,
  ToolExecutionError,
} from '@conveaux/agent-contracts';

/**
 * Agent that runs an agentic loop with tool use.
 *
 * The agent sends messages to Claude, processes tool calls,
 * and continues until Claude indicates it's done (stop_reason === 'end_turn')
 * or max iterations is reached.
 */
export class Agent {
  private client: Anthropic;
  private config: AgentConfig;

  constructor(client: Anthropic, config: AgentConfig) {
    this.client = client;
    this.config = config;
  }

  /**
   * Run the agent with the given prompt.
   * Returns the final result after all tool calls are processed.
   */
  async run(prompt: string): Promise<AgentResult> {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: prompt },
    ];

    const toolCalls: ToolCall[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let iterations = 0;
    const maxIterations = this.config.maxIterations ?? 20;

    // Build tool definitions for the API
    const tools: Anthropic.Tool[] = this.config.tools.map((tool) => ({
      name: tool.definition.name,
      description: tool.definition.description,
      input_schema: tool.definition.input_schema as Anthropic.Tool.InputSchema,
    }));

    // Build tool executor map
    const executors = new Map(
      this.config.tools.map((tool) => [tool.definition.name, tool.execute])
    );

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens ?? 4096,
        system: this.config.systemPrompt,
        tools,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Add assistant response to conversation
      messages.push({ role: 'assistant', content: response.content });

      // Check if the agent is done
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        return {
          success: true,
          output: textBlock?.type === 'text' ? textBlock.text : '',
          toolCalls,
          tokenUsage: {
            input: totalInputTokens,
            output: totalOutputTokens,
          },
        };
      }

      // Process tool calls
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const executor = executors.get(block.name);
          if (!executor) {
            throw new Error(`Unknown tool: ${block.name}`) as ToolExecutionError;
          }

          try {
            const result = await executor(block.input);
            toolCalls.push({
              tool: block.name,
              input: block.input,
              result,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          } catch (error) {
            // Return error to the model so it can try again
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            toolCalls.push({
              tool: block.name,
              input: block.input,
              result: `Error: ${errorMessage}`,
            });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${errorMessage}`,
              is_error: true,
            });
          }
        }
      }

      // Add tool results to conversation
      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults });
      }
    }

    // Max iterations reached
    return {
      success: false,
      output: `Max iterations (${maxIterations}) reached without completion`,
      toolCalls,
      tokenUsage: {
        input: totalInputTokens,
        output: totalOutputTokens,
      },
    };
  }
}

/**
 * Factory function to create an agent.
 */
export function createAgent(client: Anthropic, config: AgentConfig): Agent {
  return new Agent(client, config);
}
