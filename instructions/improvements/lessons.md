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
| core-abstractions | 3 | 2024-12-15 |
| documentation | 1 | 2024-12-15 |
| type-safety | 3 | 2024-12-15 |
| meta-improvement | 3 | 2024-12-15 |
| git-workflow | 1 | 2024-12-15 |

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

#### L-013: Primitive Ports Must Accept Environment Overrides

**Date**: 2024-12-15
**Context**: Review of @conveaux/port-clock implementation vs @firedrill/clock
**Lesson**: Primitive ports require a layered approach: (1) duck-typed platform interfaces (`PerformanceLike`, not `Performance`), (2) separate resolved vs override types with null/undefined semantics, (3) resolution helper with `Object.hasOwn` to distinguish missing from undefined, (4) multiple factory option layers (direct overrides take precedence over environment).
**Evidence**: `@conveaux/port-clock` directly uses `new Date()` and `Date.now()`. `@firedrill/clock` demonstrates production quality: `ClockEnvironmentOverrides` with null=disable semantics, `resolveEnvironment()` helper, `readMs`/`readHrtime` direct overrides, and proper fallback chain (`performance.now` → `Date.now`).
**Key Insight**: `undefined` = use host default, `null` = explicitly disable source. Use `Object.hasOwn(overrides, key)` to distinguish these cases.
**Reference**: See `@firedrill/clock/src/index.ts` for full implementation
**Instruction Impact**: Added "Hermetic Primitive Ports" section to `instructions/reference/patterns/contract-port.md`

---

### Type Safety

#### L-007: Always Use Type Guards for catch Blocks

**Date**: 2024-12-15
**Context**: feat/claude-code-works self-improvement
**Lesson**: Never use `error as Error` in catch blocks. The caught value is `unknown` and could be anything. Create a `getErrorMessage(error: unknown): string` type guard that handles Error instances, error-like objects with message property, strings, and falls back to 'Unknown error'.
**Evidence**: 5 instances in `tools.ts`, 1 in `agent.ts`, 1 in `loop.ts` used `error as Error` without runtime validation, risking runtime failures if a non-Error was thrown.
**Instruction Impact**: Formalized in IP-003; type-guards.ts created as reusable utility

#### L-008: Validate Unknown Tool Inputs with Type Guards

**Date**: 2024-12-15
**Context**: feat/claude-code-works self-improvement
**Lesson**: Tool inputs from LLMs are typed `unknown` at runtime regardless of TypeScript declarations. Create helper functions like `getStringProperty(record, key)` that safely extract and validate expected types rather than using `as string` assertions that can fail silently.
**Evidence**: 9 instances in `tools.ts` used `input.property as string` without validation. If the LLM returned malformed input, these would fail at runtime.
**Instruction Impact**: Formalized in IP-003; type-guards.ts provides safe extraction utilities

---

### Meta-Improvement

#### L-010: Instruction Leverage Over Code

**Date**: 2024-12-15
**Context**: RSID loop iteration 2
**Lesson**: When instructions have friction, fixing them once benefits all future sessions. Occasionally invert the ratio: 70% instruction work, 30% code work. Each loop should have less friction than the last.
**Evidence**: Session 1 had friction around contract vs port decisions, IP timing, and skill discovery. Fixing these reduces future cognitive load.
**Instruction Impact**: Added decision tree to contract-port.md, clarified IP timing, enhanced session prompt with skill links

#### L-011: PR Creation Is Not Task Completion

**Date**: 2024-12-15
**Context**: RSID loop iteration 2 - task declared "complete" with unmerged PR
**Lesson**: Creating a PR is an intermediate step, not completion. A task is only complete when the PR is merged to main and main is verified healthy. Never mark todos as complete after PR creation - the merge is the finish line.
**Evidence**: PR #10 was created and task marked complete, but PR remained unmerged. User had to intervene to enforce completion.
**Instruction Impact**: Added CRITICAL warnings to session-improve-package.md and self-improvement.md Session Close Checklist emphasizing PR merge requirement

#### L-012: Never Merge Without Reviewing PR Diff

**Date**: 2024-12-15
**Context**: RSID loop iteration 2 - PR #11 merged without review
**Lesson**: Every PR must be reviewed before merge, even when you authored it. Use `gh pr diff <number>` to review all changes before running `gh pr merge`. This catches unintended file changes, debug code, and instruction contradictions.
**Evidence**: PR #11 was merged immediately after creation without running `gh pr diff`. User had to intervene to enforce review requirement.
**Instruction Impact**: Added PR Review Requirements section to self-improvement.md Session Close Checklist; updated Phase 5 in session-improve-package.md with mandatory review step

#### L-009: Distinguish Expected vs Unexpected Errors

**Date**: 2024-12-15
**Context**: feat/claude-code-works self-improvement
**Lesson**: When a command like `grep` returns exit code 1 for "no matches", distinguish this expected outcome from actual errors. Check error properties (code, stderr) to determine error type. Catching all errors as success cases hides real failures.
**Evidence**: `grepTool` in `tools.ts` caught all errors as "(no matches found)", hiding permission denied, invalid path, and other real errors from the agent.
**Instruction Impact**: Formalized in IP-003; `isGrepNoMatchError()` type guard added

---

### Git Workflow

#### L-014: Never Undo Parallel Work on Shared Branches

**Date**: 2024-12-15
**Context**: Converting contract-port.md to skill while parallel work on same branch
**Lesson**: When working on a shared branch where parallel work may occur, NEVER use `git stash`, `git checkout`, `git reset`, or any command that could discard uncommitted changes. Always commit your changes first, or create a new branch. Parallel work from humans or other agents may have modified files that would be lost.
**Evidence**: Attempted `git stash && git checkout main` while parallel work was happening on `feat/verification-silent-success`, risking loss of uncommitted changes from parallel work.
**Anti-patterns**:
- `git stash` on a shared branch (discards parallel uncommitted work)
- `git checkout <other-branch>` without committing (same issue)
- `git reset --hard` (destroys all uncommitted changes)
- `git clean -fd` (removes untracked files from parallel work)
**Safe patterns**:
- Always `git status` first to see what's changed
- Commit your changes before switching branches
- If you need to work on something else, create a new branch from current state
- Ask the user before any operation that could discard uncommitted changes
**Instruction Impact**: Formalized in `effective-git` skill
