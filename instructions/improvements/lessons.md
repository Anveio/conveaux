# Lessons Learned

This document accumulates wisdom from development sessions. Each lesson is indexed by domain for retrieval.

## How to Use This Document

1. **During Bootstrap**: Scan recent lessons in domains relevant to current work
2. **After Learning**: Add new lessons with full context
3. **Pattern Recognition**: When 3+ similar lessons exist, consider creating an IP to formalize

## Index

| Domain | Count | Last Updated |
|--------|-------|--------------|
| package-setup | 2 | 2024-12-14 |
| core-abstractions | 1 | 2024-12-14 |

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
