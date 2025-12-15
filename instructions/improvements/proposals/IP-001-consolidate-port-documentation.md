# IP-001: Consolidate Port Documentation

**Status**: implemented
**Created**: 2024-12-15
**Session**: feat/contract-port-architecture branch implementation

## Problem Statement

After implementing the contract-port architecture pattern, there is now redundant and potentially contradictory documentation:

1. **core-ports.md** defines inline Logger, Clock, Random, Environment interfaces
2. **contract-port.md** establishes the actual package pattern with `@conveaux/contract-{name}`

These two documents overlap and can cause confusion about which is authoritative.

## Evidence

### Session Observations

1. **Implemented actual contract packages**: Created `@conveaux/contract-logger`, `@conveaux/contract-clock`, `@conveaux/contract-outchannel` with exported interfaces
2. **core-ports.md shows inline interfaces**: The document shows `interface Logger { ... }` directly in markdown, but we now have actual TypeScript packages
3. **Test implementation patterns differ**: core-ports.md shows `createTestLogger()` functions, while contract-port.md says "Tests use inline mocks, not shipped test implementations"

### Files Affected

- `instructions/reference/patterns/core-ports.md` - Contains inline interface definitions
- `instructions/reference/patterns/contract-port.md` - Defines the package pattern
- `packages/contract-logger/src/index.ts` - Actual Logger interface
- `packages/contract-clock/src/index.ts` - Actual Clock interface

## Proposed Change

**Refactor core-ports.md to:**

1. Remove inline interface definitions
2. Reference the actual contract packages (`@conveaux/contract-logger`, etc.)
3. Keep the conceptual explanation of "why ports"
4. Keep the composition root pattern example
5. Keep the "test with inline mocks" guidance (aligned with contract-port.md)
6. Add cross-reference to contract-port.md for package creation

**Rationale**: Single source of truth. Interfaces live in code, documentation explains why and how to use them.

## Verification Criteria

- [ ] **Grounded**: Cites specific session (feat/contract-port-architecture) and actual files
- [ ] **Non-contradictory**: Aligns core-ports.md with contract-port.md pattern
- [ ] **Actionable**: Specific changes outlined
- [ ] **Minimal**: Only updates necessary references, preserves conceptual content
- [ ] **Testable**: After change, no interface is defined in both .md files and .ts packages
- [ ] **Bounded**: Affects only instruction files (depth 1)

## Impact Assessment

- **Risk**: Low - documentation-only change
- **Affected Parties**: Future agent sessions creating ports
- **Benefit**: Clearer guidance, single source of truth for interfaces
