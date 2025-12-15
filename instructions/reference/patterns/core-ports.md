# Core Ports Pattern

This document defines platform-agnostic port interfaces for core building blocks. **Read this document before using any globals in production code.**

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
             │ Node Impl   │         │ Test Impl   │
             └─────────────┘         └─────────────┘
```

## Required Ports

### Logger Port

Replaces: `console.log`, `console.error`, `console.warn`, `console.info`

```typescript
interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
```

**Node Implementation:**
```typescript
const consoleLogger: Logger = {
  debug: (msg, ctx) => console.debug(msg, ctx ?? ""),
  info: (msg, ctx) => console.info(msg, ctx ?? ""),
  warn: (msg, ctx) => console.warn(msg, ctx ?? ""),
  error: (msg, ctx) => console.error(msg, ctx ?? ""),
};
```

**Test Implementation:**
```typescript
function createTestLogger(): Logger & { messages: Array<{level: string; message: string}> } {
  const messages: Array<{level: string; message: string}> = [];
  return {
    messages,
    debug: (msg) => messages.push({ level: "debug", message: msg }),
    info: (msg) => messages.push({ level: "info", message: msg }),
    warn: (msg) => messages.push({ level: "warn", message: msg }),
    error: (msg) => messages.push({ level: "error", message: msg }),
  };
}
```

### Clock Port

Replaces: `Date.now()`, `new Date()`, `Date.toISOString()`

```typescript
interface Clock {
  now(): Date;
  timestamp(): string;  // ISO 8601 format
  epochMs(): number;
}
```

**Real Implementation:**
```typescript
const systemClock: Clock = {
  now: () => new Date(),
  timestamp: () => new Date().toISOString(),
  epochMs: () => Date.now(),
};
```

**Test Implementation:**
```typescript
function createTestClock(initialTime: Date = new Date("2024-01-01T00:00:00Z")): Clock & { advance(ms: number): void } {
  let currentTime = initialTime.getTime();
  return {
    now: () => new Date(currentTime),
    timestamp: () => new Date(currentTime).toISOString(),
    epochMs: () => currentTime,
    advance: (ms: number) => { currentTime += ms; },
  };
}
```

### Random Port

Replaces: `Math.random()`, `crypto.randomUUID()`

```typescript
interface Random {
  number(): number;           // 0-1 range
  uuid(): string;             // v4 UUID
  choice<T>(items: T[]): T;   // Random array element
  shuffle<T>(items: T[]): T[]; // Shuffled copy
}
```

**Real Implementation:**
```typescript
import { randomUUID } from "crypto";

const systemRandom: Random = {
  number: () => Math.random(),
  uuid: () => randomUUID(),
  choice: (items) => items[Math.floor(Math.random() * items.length)],
  shuffle: (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  },
};
```

**Test Implementation:**
```typescript
function createSeededRandom(seed: number): Random {
  // Simple seeded PRNG for deterministic tests
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  let uuidCounter = 0;

  return {
    number: next,
    uuid: () => `test-uuid-${++uuidCounter}`,
    choice: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
```

### Environment Port

Replaces: `process.env`, `process.cwd()`, environment variable access

```typescript
interface Environment {
  get(key: string): string | undefined;
  require(key: string): string;  // Throws if missing
  cwd(): string;
  isDevelopment(): boolean;
  isProduction(): boolean;
  isTest(): boolean;
}
```

**Node Implementation:**
```typescript
const nodeEnvironment: Environment = {
  get: (key) => process.env[key],
  require: (key) => {
    const value = process.env[key];
    if (!value) throw new Error(`Missing required environment variable: ${key}`);
    return value;
  },
  cwd: () => process.cwd(),
  isDevelopment: () => process.env.NODE_ENV === "development",
  isProduction: () => process.env.NODE_ENV === "production",
  isTest: () => process.env.NODE_ENV === "test",
};
```

**Test Implementation:**
```typescript
function createTestEnvironment(
  vars: Record<string, string> = {},
  cwd: string = "/test/workspace"
): Environment {
  return {
    get: (key) => vars[key],
    require: (key) => {
      const value = vars[key];
      if (!value) throw new Error(`Missing required environment variable: ${key}`);
      return value;
    },
    cwd: () => cwd,
    isDevelopment: () => vars.NODE_ENV === "development",
    isProduction: () => vars.NODE_ENV === "production",
    isTest: () => true,  // Always true in tests
  };
}
```

## Composition Root Pattern

Inject ports at the application entry point:

```typescript
// src/main.ts (composition root)
import { createApp } from "./app";
import { systemClock, systemRandom, nodeEnvironment, consoleLogger } from "./ports";

const app = createApp({
  clock: systemClock,
  random: systemRandom,
  env: nodeEnvironment,
  logger: consoleLogger,
});

app.start();
```

```typescript
// src/app.ts (business logic)
interface Ports {
  clock: Clock;
  random: Random;
  env: Environment;
  logger: Logger;
}

export function createApp(ports: Ports) {
  return {
    start: () => {
      ports.logger.info("Starting app", { timestamp: ports.clock.timestamp() });
      // ... app logic using ports
    },
  };
}
```

## Testing with Ports

```typescript
import { describe, it, expect } from "vitest";
import { createApp } from "./app";
import { createTestClock, createTestLogger, createSeededRandom, createTestEnvironment } from "./test-ports";

describe("App", () => {
  it("logs startup with timestamp", () => {
    const logger = createTestLogger();
    const clock = createTestClock(new Date("2024-06-15T10:00:00Z"));

    const app = createApp({
      clock,
      logger,
      random: createSeededRandom(42),
      env: createTestEnvironment({ NODE_ENV: "test" }),
    });

    app.start();

    expect(logger.messages[0]).toEqual({
      level: "info",
      message: "Starting app",
    });
  });
});
```

## Checklist Before Using Globals

- [ ] Is this production code (not a test file)?
- [ ] Am I about to use console.*, Date, Math.random, process.env, or process.cwd?
- [ ] Does a port interface exist for this capability?
- [ ] Is the port being injected at the composition root?
- [ ] Can tests inject a mock implementation?

If any answer is "no" for production code, refactor to use ports.

## Exceptions

These patterns are **not required** in:

1. **Test files**: Direct globals are acceptable in test code
2. **Build scripts**: One-off scripts can use globals directly
3. **Entry points**: The composition root itself must reference real implementations

## Common Violations

### Direct console.log

```typescript
// WRONG
function processItem(item: Item) {
  console.log("Processing:", item.id);  // Hidden dependency
  // ...
}

// RIGHT
function processItem(item: Item, logger: Logger) {
  logger.info("Processing item", { id: item.id });
  // ...
}
```

### Direct Date.now()

```typescript
// WRONG
function createRecord(data: Data) {
  return { ...data, createdAt: new Date().toISOString() };  // Untestable
}

// RIGHT
function createRecord(data: Data, clock: Clock) {
  return { ...data, createdAt: clock.timestamp() };  // Deterministic in tests
}
```

### Direct process.env

```typescript
// WRONG
function getApiUrl() {
  return process.env.API_URL ?? "http://localhost:3000";  // Hidden dependency
}

// RIGHT
function getApiUrl(env: Environment) {
  return env.get("API_URL") ?? "http://localhost:3000";  // Explicit dependency
}
```

## Related Lessons

- L-003: Platform-Agnostic Core Building Blocks
