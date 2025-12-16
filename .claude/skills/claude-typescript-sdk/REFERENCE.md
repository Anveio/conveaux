# Claude TypeScript SDK Reference

## Installation Options

```bash
# npm
npm install @anthropic-ai/sdk

# yarn
yarn add @anthropic-ai/sdk

# pnpm
pnpm add @anthropic-ai/sdk
```

## Client Configuration

```typescript
import Anthropic from '@anthropic-ai/sdk';

// Default (uses ANTHROPIC_API_KEY env var)
const client = new Anthropic();

// Explicit configuration
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60000, // Request timeout in ms
  maxRetries: 2,  // Auto-retry failed requests
});
```

## Message Parameters

```typescript
interface MessageCreateParams {
  model: string;                    // Required: model ID
  max_tokens: number;               // Required: max output tokens
  messages: MessageParam[];         // Required: conversation history
  system?: string;                  // Optional: system prompt
  tools?: Tool[];                   // Optional: available tools
  temperature?: number;             // 0-1, default varies by model
  top_p?: number;                   // Nucleus sampling
  top_k?: number;                   // Top-k sampling
  stream?: boolean;                 // Enable streaming
  stop_sequences?: string[];        // Stop generation triggers
  metadata?: { user_id?: string };  // Request metadata
}
```

## Streaming Methods

### Event-based
```typescript
const stream = client.messages.stream({...});

stream.on('text', (text) => console.log(text));
stream.on('message', (message) => console.log('Complete:', message));
stream.on('error', (error) => console.error(error));

const message = await stream.finalMessage();
```

### Async Iterator
```typescript
const stream = await client.messages.create({ stream: true, ... });

for await (const event of stream) {
  if (event.type === 'content_block_delta') {
    if (event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
    }
  }
}
```

## Tool Use (Agentic Loop)

```typescript
async function agenticLoop(userMessage: string) {
  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: userMessage }
  ];

  while (true) {
    const response = await client.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 1024,
      tools,
      messages,
    });

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'end_turn') {
      return response.content.find(b => b.type === 'text')?.text;
    }

    // Process tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await executeToolCall(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: result,
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }
}
```

## Batch Processing

```typescript
// Create batch
const batch = await client.messages.batches.create({
  requests: [
    {
      custom_id: 'req-1',
      params: {
        model: 'claude-opus-4-5-20251101',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }],
      },
    },
  ],
});

// Check status
const status = await client.messages.batches.retrieve(batch.id);

// Get results when complete
const results = await client.messages.batches.results(batch.id);
for await (const result of results) {
  if (result.result.type === 'succeeded') {
    console.log(result.result.message);
  }
}
```

## File Uploads (Beta)

```typescript
import { toFile } from '@anthropic-ai/sdk';
import fs from 'fs';

const file = await client.beta.files.upload({
  file: await toFile(fs.createReadStream('doc.pdf'), 'doc.pdf', {
    type: 'application/pdf'
  }),
  betas: ['files-api-2025-04-14'],
});
```

## Type Safety

```typescript
// Typed parameters
const params: Anthropic.MessageCreateParams = {
  model: 'claude-opus-4-5-20251101',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }],
};

// Typed response
const message: Anthropic.Message = await client.messages.create(params);

// Type-safe content handling
for (const block of message.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'tool_use') {
    console.log(block.name, block.input);
  }
}
```

## Error Types

```typescript
import Anthropic from '@anthropic-ai/sdk';

// Error hierarchy
Anthropic.APIError           // Base class
Anthropic.AuthenticationError // 401 - Invalid API key
Anthropic.PermissionDeniedError // 403 - Insufficient permissions
Anthropic.NotFoundError      // 404 - Resource not found
Anthropic.RateLimitError     // 429 - Rate limited
Anthropic.InternalServerError // 500 - Server error

// Handling
try {
  await client.messages.create({...});
} catch (error) {
  if (error instanceof Anthropic.RateLimitError) {
    // Implement backoff
    await sleep(error.headers?.['retry-after'] || 60);
  } else if (error instanceof Anthropic.APIError) {
    console.error(`${error.status}: ${error.message}`);
  }
}
```

## Token Usage

```typescript
const message = await client.messages.create({...});

console.log({
  input: message.usage.input_tokens,
  output: message.usage.output_tokens,
  total: message.usage.input_tokens + message.usage.output_tokens,
});
```

## Best Practices

1. **Environment variables** for API keys
2. **Streaming** for long responses
3. **Explicit types** for type safety
4. **Error handling** with specific error types
5. **Token monitoring** to manage costs
6. **Timeouts** for production reliability
