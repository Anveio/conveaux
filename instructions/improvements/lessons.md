# Lessons Learned

This document accumulates wisdom from development sessions. Each lesson is indexed by domain for retrieval.

## How to Use This Document

1. **During Bootstrap**: Scan recent lessons in domains relevant to current work
2. **After Learning**: Add new lessons with full context
3. **Pattern Recognition**: When 3+ similar lessons exist, consider creating an IP to formalize

## Index

| Domain | Count | Last Updated |
|--------|-------|--------------|
| package-setup | 3 | 2024-12-15 |
| core-abstractions | 2 | 2024-12-15 |
| documentation | 1 | 2024-12-15 |

---

## Template for New Lessons

```markdown
### L-{number}: {brief title}

**Date**: YYYY-MM-DD
**Context**: Milestone or session identifier
**Lesson**: What was learned (1-2 sentences)
**Evidence**: Specific files, errors, or outcomes that demonstrated this
**Instruction Impact**: What instruction was updated, or "pending formalization"
```

---

## Lessons by Domain

### Package Setup

#### L-001: Source + Compiled Export Patterns

**Date**: 2024-12-14
**Context**: Comparison of firedrill vs conveaux workspace patterns
**Lesson**: Use `development` and `source` export conditions in package.json to enable zero-transpilation development. Production builds use compiled output while development uses TypeScript source directly.
**Evidence**: Firedrill workspace at `~/Documents/workspaces/firedrill` uses this pattern. Conveaux packages only export compiled `.js`, requiring transpilation even in development.
**Reference Pattern**:
```json
"exports": {
  ".": {
    "types": "./src/index.ts",
    "development": "./src/index.ts",
    "source": "./src/index.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```
**Instruction Impact**: Formalized in `instructions/reference/patterns/package-setup.md`

#### L-002: TypeScript Composite Builds for Turbo Caching

**Date**: 2024-12-14
**Context**: Comparison of firedrill vs conveaux workspace patterns
**Lesson**: Enable `composite: true` and `incremental: true` in tsconfig for proper Turbo build caching. Create a shared `packages/tsconfig` package with base configurations. Include `tsbuildinfo` in Turbo outputs.
**Evidence**: Firedrill has a `@firedrill/tsconfig` package with `workspace-package-config.json`. Conveaux uses a single root `tsconfig.base.json` without composite builds, missing incremental build benefits.
**Reference Pattern**:
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true
  }
}
```
**Instruction Impact**: Formalized in `instructions/reference/patterns/package-setup.md`

---

### Core Abstractions

#### L-003: Platform-Agnostic Core Building Blocks

**Date**: 2024-12-14
**Context**: Architecture review of agent-orchestrator package
**Lesson**: Never use globals directly (console.*, Date.now(), Math.random(), process.env). Create port interfaces for Logger, Clock, Random, and Environment. Inject implementations at composition root.
**Evidence**: `packages/agent-orchestrator/src/lesson-recorder.ts` directly uses `new Date().toISOString()`, `Math.random()`, and `process.cwd()`. `packages/agent-orchestrator/src/improvement-loop.ts` has 24 direct `console.log()` calls. These violate `instructions/reference/architecture.md` "No Globals" rule.
**Reference Pattern**:
```typescript
// Port interface
interface Clock {
  now(): Date;
  timestamp(): string;
}

// Implementation injected at composition root
const clock: Clock = {
  now: () => new Date(),
  timestamp: () => new Date().toISOString()
};
```
**Instruction Impact**: Formalized in `instructions/reference/patterns/core-ports.md`

---

### Package Setup

#### L-004: Build Tool Selection - tsc vs tsup

**Date**: 2024-12-15
**Context**: feat/contract-port-architecture implementation
**Lesson**: Use tsc for simple packages (contracts, simple ports). Use tsup only for complex applications needing multiple entry points, bundling, or tree-shaking. package-setup.md previously mandated tsup universally, but simpler packages work fine with tsc.
**Evidence**: All 6 new contract/port packages (`@conveaux/contract-*`, `@conveaux/port-*`) use plain `tsc` and work correctly. tsup would add unnecessary complexity.
**Instruction Impact**: Formalized in `instructions/reference/patterns/package-setup.md` (IP-002)

---

### Documentation

#### L-005: Instruction Consolidation After Implementation

**Date**: 2024-12-15
**Context**: feat/contract-port-architecture implementation
**Lesson**: When implementing actual code packages based on documented patterns, update documentation to reference real code rather than showing inline interface definitions. Single source of truth: interfaces in TypeScript files, documentation explains usage patterns.
**Evidence**: `core-ports.md` showed inline `interface Logger { ... }` but we now have `@conveaux/contract-logger` package. Documentation updated to reference package imports.
**Instruction Impact**: Refactored `instructions/reference/patterns/core-ports.md` (IP-001)

---

### Core Abstractions

#### L-006: Contracts Must Never Contain Runtime Values

**Date**: 2024-12-15
**Context**: feat/improve-port-logger implementation
**Lesson**: Contracts must contain only interfaces and types - never constants, functions, or any runtime values. If it emits JavaScript, it doesn't belong in a contract. Constants like `LOG_LEVEL_PRIORITY` belong in the port implementation, not the contract.
**Evidence**: Attempted to add `export const LOG_LEVEL_PRIORITY = {...}` to `@conveaux/contract-logger`. This violated the "contracts are pure types" principle since constants emit JavaScript.
**Instruction Impact**: Updated `instructions/reference/patterns/contract-port.md` to explicitly prohibit constants and add the rule "if it emits JS, it doesn't belong here"
