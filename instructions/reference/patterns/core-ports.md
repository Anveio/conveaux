# Core Ports Pattern

This document explains the conceptual pattern of ports for platform-agnostic code. **For implementation details and package creation, see [contract-port.md](./contract-port.md).**

## The Problem with Globals

Direct use of globals creates hidden dependencies that:

1. **Break testability**: Can't mock `console.log` or `Date.now()` easily
2. **Couple to platform**: Code assumes Node.js, browser, or specific runtime
3. **Hide dependencies**: Function signatures don't reveal what they need
4. **Prevent composition**: Can't swap implementations at runtime

## The Port Pattern

A **port** is an interface that abstracts a capability. Implementations are injected at the composition root.

```
┌─────────────────┐      ┌─────────────────┐
│  Business Logic │ ──── │     Port        │ (interface)
└─────────────────┘      └─────────────────┘
                               │
                   ┌───────────┴───────────┐
                   │                       │
            ┌──────┴──────┐         ┌──────┴──────┐
            │ Production  │         │ Test Mock   │
            └─────────────┘         └─────────────┘
```

## Available Contract Packages

Instead of defining interfaces inline, use these contract packages:

| Contract Package | Replaces | Interface |
|-----------------|----------|-----------|
| `@conveaux/contract-logger` | `console.*` | `Logger` |
| `@conveaux/contract-clock` | `Date`, `Date.now()` | `Clock` |
| `@conveaux/contract-outchannel` | `process.stdout`, `process.stderr` | `OutChannel` |

**Import contracts, not inline definitions:**

```typescript
// Good: Import from contract package
import type { Logger } from '@conveaux/contract-logger';
import type { Clock } from '@conveaux/contract-clock';

// Bad: Define interface inline
interface Logger { ... }
```

## Available Port Packages

Production implementations for each contract:

| Port Package | Implements | Factory Function |
|-------------|------------|------------------|
| `@conveaux/port-logger` | `Logger` | `createLogger(deps)` |
| `@conveaux/port-clock` | `Clock` | `createSystemClock()` |
| `@conveaux/port-outchannel` | `OutChannel` | `createStderrChannel()`, `createStdoutChannel()` |

## Composition Root Pattern

Inject ports at the application entry point:

```typescript
// src/main.ts (composition root)
import { createLogger } from '@conveaux/port-logger';
import { createSystemClock } from '@conveaux/port-clock';
import { createStderrChannel } from '@conveaux/port-outchannel';
import { createApp } from './app';

const logger = createLogger({
  channel: createStderrChannel(),
  clock: createSystemClock(),
});

const app = createApp({ logger });
app.start();
```

```typescript
// src/app.ts (business logic)
import type { Logger } from '@conveaux/contract-logger';

interface AppDeps {
  logger: Logger;
}

export function createApp(deps: AppDeps) {
  return {
    start: () => {
      deps.logger.info('Starting app');
    },
  };
}
```

## Testing with Inline Mocks

Tests create their own mock implementations inline. **Do not ship test implementations in port packages.**

```typescript
import { describe, it, expect } from 'vitest';
import { createApp } from './app';
import type { Logger } from '@conveaux/contract-logger';

// Create inline mock for tests
function createMockLogger(): Logger & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    debug: (msg) => messages.push(`debug: ${msg}`),
    info: (msg) => messages.push(`info: ${msg}`),
    warn: (msg) => messages.push(`warn: ${msg}`),
    error: (msg) => messages.push(`error: ${msg}`),
  };
}

describe('App', () => {
  it('logs startup', () => {
    const logger = createMockLogger();
    const app = createApp({ logger });

    app.start();

    expect(logger.messages).toContain('info: Starting app');
  });
});
```

## Checklist Before Using Globals

- [ ] Is this production code (not a test file)?
- [ ] Am I about to use console.*, Date, Math.random, process.env, or process.cwd?
- [ ] Does a contract package exist for this capability?
- [ ] Is the port being injected at the composition root?
- [ ] Are tests using inline mocks, not shipped test implementations?

If any answer is "no" for production code, refactor to use ports.

## Exceptions

These patterns are **not required** in:

1. **Test files**: Direct globals are acceptable in test code
2. **Build scripts**: One-off scripts can use globals directly
3. **Entry points**: The composition root itself must reference real implementations

## Creating New Ports

When you need to abstract a new capability:

1. Check if a contract package exists
2. If not, see [contract-port.md](./contract-port.md) for creating new contract/port packages
3. Follow the recursive dependency extraction pattern

## Related Documentation

- [contract-port.md](./contract-port.md) - Package naming and creation pattern
- [package-setup.md](./package-setup.md) - Build configuration

## Related Lessons

- L-003: Platform-Agnostic Core Building Blocks
