# Core Ports Pattern

**This pattern is now a Claude Code skill.** Invoke the `coding-patterns` skill for guidance on:

- Why ports? (problem with globals)
- Port pattern concept (interface abstracts capability)
- Composition root pattern
- Testing with inline mocks
- Contract extraction decision tree
- Hermetic primitive ports

## Available Contract Packages

| Contract Package | Replaces | Interface |
|-----------------|----------|-----------|
| `@conveaux/contract-logger` | `console.*` | `Logger` |
| `@conveaux/contract-high-resolution-clock` | `Date`, `Date.now()`, `performance.now()` | `HighResolutionClock` |
| `@conveaux/contract-outchannel` | `process.stdout`, `process.stderr` | `OutChannel` |

## Available Port Packages

| Port Package | Implements | Factory Function |
|-------------|------------|------------------|
| `@conveaux/port-logger` | `Logger` | `createLogger(deps)` |
| `@conveaux/port-high-resolution-clock` | `HighResolutionClock` | `createHighResolutionClock(options?)` |
| `@conveaux/port-outchannel` | `OutChannel` | `createStderrChannel(options?)`, `createStdoutChannel(options?)` |

For full guidance, invoke: `Skill(coding-patterns)`
