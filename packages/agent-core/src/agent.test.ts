/**
 * Tests for the Agent class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Agent } from './agent.js';
import type { Tool, AgentConfig } from '@conveaux/agent-contracts';

// Mock tool for testing
const mockTool: Tool = {
  definition: {
    name: 'echo',
    description: 'Echoes the input',
    input_schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' },
      },
      required: ['message'],
    },
  },
  execute: vi.fn().mockResolvedValue('echoed: test'),
};

// Mock Anthropic client
function createMockClient(responses: Array<{
  content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: unknown }>;
  stop_reason: 'end_turn' | 'tool_use';
  usage: { input_tokens: number; output_tokens: number };
}>) {
  let callIndex = 0;
  return {
    messages: {
      create: vi.fn().mockImplementation(() => {
        const response = responses[callIndex];
        callIndex++;
        return Promise.resolve(response);
      }),
    },
  };
}

describe('Agent', () => {
  const baseConfig: AgentConfig = {
    name: 'test-agent',
    model: 'claude-sonnet-4-5-20250929',
    systemPrompt: 'You are a test agent.',
    tools: [mockTool],
    maxTokens: 1000,
    maxIterations: 5,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete successfully when model returns end_turn', async () => {
    const mockClient = createMockClient([
      {
        content: [{ type: 'text', text: 'Hello, world!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 5 },
      },
    ]);

    // @ts-expect-error - Using mock client
    const agent = new Agent(mockClient, baseConfig);
    const result = await agent.run('Say hello');

    expect(result.success).toBe(true);
    expect(result.output).toBe('Hello, world!');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.tokenUsage).toEqual({ input: 10, output: 5 });
  });

  it('should process tool calls and continue conversation', async () => {
    const mockClient = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'echo', input: { message: 'test' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 20 },
      },
      {
        content: [{ type: 'text', text: 'Done!' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 30, output_tokens: 10 },
      },
    ]);

    // @ts-expect-error - Using mock client
    const agent = new Agent(mockClient, baseConfig);
    const result = await agent.run('Echo something');

    expect(result.success).toBe(true);
    expect(result.output).toBe('Done!');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].tool).toBe('echo');
    expect(result.tokenUsage).toEqual({ input: 40, output: 30 });
    expect(mockTool.execute).toHaveBeenCalledWith({ message: 'test' });
  });

  it('should handle tool execution errors gracefully', async () => {
    const failingTool: Tool = {
      ...mockTool,
      execute: vi.fn().mockRejectedValue(new Error('Tool failed')),
    };

    const mockClient = createMockClient([
      {
        content: [
          { type: 'tool_use', id: 'tool-1', name: 'echo', input: { message: 'test' } },
        ],
        stop_reason: 'tool_use',
        usage: { input_tokens: 10, output_tokens: 20 },
      },
      {
        content: [{ type: 'text', text: 'I see the tool failed.' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 30, output_tokens: 15 },
      },
    ]);

    const config = { ...baseConfig, tools: [failingTool] };
    // @ts-expect-error - Using mock client
    const agent = new Agent(mockClient, config);
    const result = await agent.run('Try the tool');

    expect(result.success).toBe(true);
    expect(result.toolCalls[0].result).toBe('Error: Tool failed');
  });

  it('should stop after max iterations and return failure', async () => {
    // Create a client that always returns tool_use, never ends
    const infiniteToolClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: 'tool_use', id: 'tool-1', name: 'echo', input: { message: 'loop' } },
          ],
          stop_reason: 'tool_use',
          usage: { input_tokens: 10, output_tokens: 10 },
        }),
      },
    };

    const config = { ...baseConfig, maxIterations: 3 };
    // @ts-expect-error - Using mock client
    const agent = new Agent(infiniteToolClient, config);
    const result = await agent.run('Loop forever');

    expect(result.success).toBe(false);
    expect(result.output).toContain('Max iterations');
    expect(infiniteToolClient.messages.create).toHaveBeenCalledTimes(3);
  });

  it('should use default maxIterations when not specified', async () => {
    const mockClient = createMockClient([
      {
        content: [{ type: 'text', text: 'Done' }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 5, output_tokens: 5 },
      },
    ]);

    const config = { ...baseConfig };
    delete config.maxIterations;

    // @ts-expect-error - Using mock client
    const agent = new Agent(mockClient, config);
    const result = await agent.run('Test');

    expect(result.success).toBe(true);
  });
});
