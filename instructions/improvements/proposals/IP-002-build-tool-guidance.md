# IP-002: Add Build Tool Selection Guidance

**Status**: implemented
**Created**: 2024-12-15
**Session**: feat/contract-port-architecture branch implementation

## Problem Statement

`instructions/reference/patterns/package-setup.md` mandates tsup for all packages, but the newly created contract/port packages use plain `tsc`. There is no guidance on when each tool is appropriate.

## Evidence

### Session Observations

1. **package-setup.md requires tsup**: Shows `"build": "tsup"` and tsup.config.ts as required
2. **All 6 new packages use tsc**: Both contract and port packages use `"build": "tsc"`
3. **Rational simplification**: Contract packages have no runtime code; tsc is sufficient. Port packages are simple enough that tsc handles them well.

### Files Affected

- `instructions/reference/patterns/package-setup.md` - Requires tsup
- `instructions/reference/patterns/contract-port.md` - Shows `"build": "tsc"`
- `packages/contract-*/package.json` - All use tsc
- `packages/port-*/package.json` - All use tsc

## Proposed Change

**Update package-setup.md to include build tool selection criteria:**

```markdown
## Build Tool Selection

| Package Type | Recommended Tool | Rationale |
|--------------|------------------|-----------|
| Contract | tsc | No runtime code, declarations only |
| Simple Port | tsc | Single entry point, no bundling needed |
| Complex Application | tsup | Multiple entry points, bundling, tree-shaking |

### When to Use tsc

- Contract packages (interfaces only)
- Simple ports with single entry point
- Packages with no external dependencies to bundle

### When to Use tsup

- Applications with multiple entry points
- Packages needing both ESM and CJS with different transpilation
- Packages requiring tree-shaking or minification
- Packages with complex dependency handling
```

## Verification Criteria

- [x] **Grounded**: Cites specific session and actual package configurations
- [x] **Non-contradictory**: Clarifies rather than contradicts existing guidance
- [x] **Actionable**: Adds specific decision criteria
- [x] **Minimal**: Single section addition to existing document
- [x] **Testable**: Future packages can check criteria to select tool
- [x] **Bounded**: Affects only instruction files (depth 1)

## Impact Assessment

- **Risk**: Low - clarification, not breaking change
- **Affected Parties**: Future package creators
- **Benefit**: Clear decision criteria, simpler builds for simple packages
