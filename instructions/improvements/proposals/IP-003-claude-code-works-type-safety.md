# IP-003: claude-code-works Type Safety and Error Handling

Status: implemented

## Trigger

- **Session**: feat/claude-code-works self-improvement
- **Context**: Recursive self-improvement of the claude-code-works coding agent
- **Observation**: Multiple unsafe type assertions (`as Error`, `as string`, `as Record`) and inconsistent error handling patterns throughout the codebase

## Problem

The claude-code-works package contains:
1. **13 unsafe type assertions** - Using `as Type` without runtime validation, which fails silently if the actual type doesn't match
2. **Inconsistent error handling** - grep tool swallows all errors as "no matches", hiding real failures
3. **Edge case bugs** - `parseIntFlag` returns default for value `0` due to `|| defaultValue` pattern
4. **Regex injection risk** - Signal parsing doesn't escape special characters in tag names

These issues reduce reliability of the self-improvement agent and could cause silent failures during autonomous operation.

## Proposed Change

**Files affected:**

- `apps/claude-code-works/src/type-guards.ts` - NEW: Centralized type guards
- `apps/claude-code-works/src/tools.ts` - Replace 9 type assertions with guards
- `apps/claude-code-works/src/agent.ts` - Replace 3 type assertions with guards
- `apps/claude-code-works/src/loop.ts` - Replace 1 type assertion, fix regex
- `apps/claude-code-works/src/cli.ts` - Fix parseIntFlag edge case

**Key changes:**

1. Create `type-guards.ts` with:
   - `isRecord(value)` - Type guard for Record<string, unknown>
   - `getErrorMessage(error)` - Safe error message extraction
   - `getStringProperty(record, key)` - Safe string property extraction
   - `isGrepNoMatchError(error)` - Distinguish grep "no matches" from errors

2. Replace all `error as Error` with `getErrorMessage(error)`
3. Replace all `input.property as string` with `getStringProperty(input, 'property')`
4. Fix grep to return actual error messages for non-exit-code-1 failures
5. Fix parseIntFlag to use `Number.isNaN()` instead of `|| defaultValue`
6. Escape special regex characters in signal tag extraction

## Expected Benefit

1. **Reliability**: Type guards provide runtime validation, preventing silent type mismatches
2. **Debuggability**: Real errors surface instead of being hidden as "no matches"
3. **Correctness**: `--iterations=0` now works correctly
4. **Security**: Regex escaping prevents potential injection in signal parsing
5. **Maintainability**: Centralized type guards are reusable and testable

## Risks

- **Minimal overhead**: Type guards add trivial runtime cost
- **API compatibility**: All external interfaces unchanged
- **Behavior change**: grep now returns error messages for real errors (improvement, not regression)

## Verification Checklist

- [x] **Grounded**: Cites specific session (feat/claude-code-works) and 13 concrete observations
- [x] **Non-contradictory**: Aligns with project's TypeScript best practices
- [x] **Actionable**: Specific file changes with concrete implementation
- [x] **Minimal**: Fixes identified issues without scope creep
- [x] **Testable**: Type safety verifiable via TypeScript compiler; behavior via tests
- [x] **Bounded**: Affects depth 1 only (product code)

## Decision

**Decided**: 2024-12-15
**Reviewer**: Self-review (RSID loop)
**Outcome**: accepted
**Rationale**: All issues are concrete, observed problems with clear fixes. Changes improve reliability without breaking existing behavior.
