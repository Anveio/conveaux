# Contract-Port Package Architecture

This document defines the naming convention and architecture pattern for reusable packages in the conveaux workspace.

## Package Types

| Type | Naming Pattern | Purpose |
|------|----------------|---------|
| **Contract** | `@conveaux/contract-{name}` | Pure TypeScript interfaces and types. No runtime code, no dependencies except other contracts. |
| **Port** | `@conveaux/port-{name}` | Production implementation of a contract. All dependencies injected as contracts. |

## Design Principles

### 1. Contracts Are Pure

Contract packages contain **only**:
- TypeScript interfaces
- Type aliases
- Enums (if necessary)

Contract packages **never contain**:
- Classes with implementations
- Functions with runtime behavior
- Constants or runtime values (e.g., `const LOG_LEVEL_PRIORITY = {...}`)
- External dependencies (except other `@conveaux/contract-*` packages)

**Rule**: If it emits JavaScript, it doesn't belong in a contract. Contracts compile to `.d.ts` only.

```typescript
// Good: @conveaux/contract-logger
export interface Logger {
  info(message: string): void;
}

// Bad: Contract with implementation
export class ConsoleLogger implements Logger {
  info(message: string) { console.log(message); }  // NO!
}
```

### 2. Ports Take All Dependencies as Contracts

Port implementations **never use globals directly**. All external behavior is injected:

```typescript
// Bad: Direct global usage
export function createLogger(): Logger {
  return {
    info(msg) {
      console.log(new Date().toISOString(), msg);  // NO! Uses console and Date directly
    }
  };
}

// Good: Dependencies injected
import type { OutChannel } from '@conveaux/contract-outchannel';
import type { Clock } from '@conveaux/contract-clock';

export interface LoggerDeps {
  channel: OutChannel;
  clock: Clock;
}

export function createLogger(deps: LoggerDeps): Logger {
  return {
    info(msg) {
      deps.channel.write(`${deps.clock.timestamp()} ${msg}`);
    }
  };
}
```

### 3. No Test/Noop Variants in Ports

Port packages contain **only production implementations**. Test doubles (mocks, stubs, fakes) are created in test files, not shipped as part of the package.

```
packages/
├── port-logger/
│   └── src/
│       ├── index.ts      # Production createLogger()
│       └── index.test.ts # Tests create their own mocks
```

### 4. Recursive Dependency Extraction

When building a port, if you need to abstract something (time, I/O, randomness), **first create the contract for it**:

1. Identify the dependency (e.g., "I need to get the current time")
2. Create `@conveaux/contract-clock` with the interface
3. Create `@conveaux/port-clock` with the system implementation
4. Import the contract in your original port

This naturally grows a library of reusable contracts and ports.

### 5. Hermetic Primitive Ports

Some ports wrap platform primitives (Date, performance, console, process). Even these **must accept optional environment overrides** to enable deterministic testing.

#### The Problem

```typescript
// WRONG: Direct global usage - untestable with deterministic time
export function createSystemClock(): Clock {
  return {
    now: () => Date.now(),
    hrtime: () => process.hrtime.bigint(),
  };
}
```

This looks correct (it implements the Clock contract), but:
- Tests cannot inject a fake time source
- The port itself cannot be tested deterministically
- Platform coupling is hidden inside the "platform abstraction"

#### The Solution: Layered Environment Overrides

Production-quality primitive ports use a layered approach (see `@firedrill/clock` for reference):

**Step 1: Duck-typed platform interfaces**

```typescript
// Don't depend on the actual Platform types - use duck typing
type PerformanceLike = {
  readonly now?: () => number
}

type HrtimeFn = (() => [number, number]) & {
  readonly bigint?: () => bigint
}

type ProcessLike = {
  readonly hrtime?: HrtimeFn
}
```

**Step 2: Separate resolved environment from user overrides**

```typescript
// Internal: Fully resolved environment (no optionals)
type ClockEnvironment = {
  readonly performance: PerformanceLike | null
  readonly process: ProcessLike | null
  readonly dateNow: () => number
}

// Public: User-provided overrides
// - undefined = use host default
// - null = explicitly disable this source
// - value = use this override
export type ClockEnvironmentOverrides = {
  readonly performance?: PerformanceLike | null
  readonly process?: ProcessLike | null
  readonly dateNow?: () => number
}
```

**Step 3: Resolution helper with proper null/undefined semantics**

```typescript
const readOverride = <Key extends keyof ClockEnvironmentOverrides>(
  overrides: ClockEnvironmentOverrides | undefined,
  key: Key,
): ClockEnvironmentOverrides[Key] | undefined => {
  if (!overrides) return undefined
  // Use hasOwn to distinguish "key is undefined" from "key is missing"
  return Object.hasOwn(overrides, key) ? overrides[key] : undefined
}

const resolveEnvironment = (
  overrides?: ClockEnvironmentOverrides,
): ClockEnvironment => {
  const globals = globalThis as {
    performance?: PerformanceLike
    process?: ProcessLike
  }

  const overridePerformance = readOverride(overrides, 'performance')
  const overrideProcess = readOverride(overrides, 'process')
  const overrideDateNow = readOverride(overrides, 'dateNow')

  return {
    performance:
      overridePerformance !== undefined
        ? (overridePerformance ?? null)
        : (globals.performance ?? null),
    process:
      overrideProcess !== undefined
        ? (overrideProcess ?? null)
        : (globals.process ?? null),
    dateNow:
      typeof overrideDateNow === 'function' ? overrideDateNow : Date.now,
  }
}
```

**Step 4: Factory with multiple option layers**

```typescript
export type ClockOptions = {
  /** Seed starting point (ms) for deterministic offsets */
  readonly originMs?: number
  /** Direct override of millisecond reader */
  readonly readMs?: () => number
  /** Direct override of hrtime reader */
  readonly readHrtime?: () => bigint | undefined
  /** Platform environment overrides */
  readonly environment?: ClockEnvironmentOverrides
}

export const createSystemClock = (options: ClockOptions = {}): Clock => {
  const environment = resolveEnvironment(options.environment)

  const readHighResMs = (): number => {
    const now = environment.performance?.now
    if (typeof now === 'function') {
      return now.call(environment.performance)
    }
    return environment.dateNow()
  }

  const readMs = options.readMs ?? readHighResMs
  const originMs = options.originMs ?? readMs()

  return {
    now: () => readMs() - originMs,
    hrtime: options.readHrtime ?? (() => environment.process?.hrtime?.bigint?.()),
  }
}
```

#### Testing Primitive Ports

Tests can inject at multiple levels:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('createSystemClock', () => {
  it('prefers direct readMs override for full control', () => {
    const msTimeline = [50, 52, 55]
    const clock = createSystemClock({
      readMs: () => msTimeline.shift() ?? 55,
      readHrtime: () => 123n,
    })

    expect(clock.now()).toBe(2)   // 52 - 50
    expect(clock.now()).toBe(5)   // 55 - 50
    expect(clock.hrtime()).toBe(123n)
  })

  it('uses environment.performance when provided', () => {
    const performanceNow = vi.fn<() => number>()
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(10)
      .mockReturnValueOnce(12)

    const clock = createSystemClock({
      environment: {
        performance: { now: performanceNow },
      },
    })

    expect(clock.now()).toBe(0)   // 10 - 10
    expect(clock.now()).toBe(2)   // 12 - 10
    expect(performanceNow).toHaveBeenCalledTimes(3)
  })

  it('falls back to dateNow when performance is explicitly disabled', () => {
    const dateSequence = [5_000, 5_003]
    const dateSpy = vi.fn(() => dateSequence.shift() ?? 5_003)

    const clock = createSystemClock({
      originMs: 5_000,
      environment: {
        performance: null,  // Explicitly disable
        dateNow: dateSpy,
      },
    })

    expect(clock.now()).toBe(0)
    expect(clock.now()).toBe(3)
    expect(dateSpy).toHaveBeenCalledTimes(2)
  })

  it('uses host defaults when no overrides provided', () => {
    // No mocking - uses real globalThis.performance or Date.now
    const clock = createSystemClock()
    const t1 = clock.now()
    const t2 = clock.now()
    expect(t2).toBeGreaterThanOrEqual(t1)
  })
})
```

#### Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Null vs undefined** | `undefined` = use host default, `null` = explicitly disable source |
| **Duck typing** | `PerformanceLike` not `Performance` - works in any JS runtime |
| **Layered options** | Direct overrides (`readMs`) take precedence over environment |
| **Resolution helper** | Centralized `resolveEnvironment()` handles override logic |
| **Fallback chain** | `performance.now()` → `Date.now()` with explicit control |

#### Common Primitive Ports

| Port | Wraps | Key Override Types |
|------|-------|-------------------|
| Clock | performance.now, Date.now, process.hrtime | `ClockEnvironmentOverrides` |
| Random | Math.random, crypto.getRandomValues | `RandomEnvironmentOverrides` |
| OutChannel | console, process.stdout/stderr | `ChannelEnvironmentOverrides` |
| Environment | process.env, process.cwd | `EnvEnvironmentOverrides` |

### Contract Extraction Decision Tree

Use this flowchart when deciding what belongs in a contract vs implementation:

1. **Is this a platform capability?** (time, I/O, randomness, environment)
   - Yes → Likely needs a contract for testability
   - No → Continue to step 2

2. **Do I need to mock this in tests?**
   - Yes → Extract to contract interface
   - No → Keep as implementation detail

3. **Could different implementations exist?** (console vs file, real vs fake)
   - Yes → Extract to contract
   - No → Keep as implementation detail

4. **Does it emit JavaScript?** (constants, functions with bodies)
   - Yes → Belongs in PORT, not contract
   - No → Can be in contract (types only)

**Examples:**
| Need | Contract? | Why |
|------|-----------|-----|
| Current time | Yes → Clock | Platform capability, needs mocking |
| JSON.stringify | No | Standard library, no mock needed |
| Log level priority map | No | Implementation detail, constant emits JS |
| Output destination | Yes → OutChannel | Different impls (stdout, file, network) |

## Package Structure

### Contract Package

```
packages/contract-{name}/
├── src/
│   └── index.ts    # All exports (interfaces, types)
├── package.json
└── tsconfig.json
```

**package.json:**
```json
{
  "name": "@conveaux/contract-{name}",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "source": "./src/index.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc"
  }
}
```

Note: Contract packages typically have no `test` script since they contain no runtime behavior.

### Port Package

```
packages/port-{name}/
├── src/
│   ├── index.ts       # Production implementation
│   └── index.test.ts  # Tests with inline mocks
├── package.json
└── tsconfig.json
```

**package.json:**
```json
{
  "name": "@conveaux/port-{name}",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./src/index.ts",
      "source": "./src/index.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest run"
  },
  "dependencies": {
    "@conveaux/contract-{dep}": "*"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

## Example: Logger with Dependencies

```
@conveaux/contract-outchannel  →  @conveaux/port-outchannel
                                         ↓
@conveaux/contract-clock       →  @conveaux/port-clock
                                         ↓
@conveaux/contract-logger      →  @conveaux/port-logger (depends on outchannel + clock contracts)
```

## Checklist for New Packages

### Creating a Contract
- [ ] Name follows `@conveaux/contract-{name}` pattern
- [ ] Contains only interfaces and types (no constants, no functions)
- [ ] No runtime code (if it emits JS, it doesn't belong here)
- [ ] No runtime dependencies
- [ ] Exports are documented with JSDoc

### Creating a Port
- [ ] Name follows `@conveaux/port-{name}` pattern
- [ ] All dependencies are contracts
- [ ] No direct usage of globals (console, Date, process, Math.random, etc.)
- [ ] Factory function pattern: `create{Name}(deps): {Name}`
- [ ] Tests use inline mocks, not shipped test implementations
- [ ] If wrapping platform primitives, accepts optional environment overrides (see "Hermetic Primitive Ports")
- [ ] Factory function allows deterministic testing via injected primitives
