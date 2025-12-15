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
