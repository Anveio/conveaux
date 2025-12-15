# Decision: Bootstrap-First Agent Development Infrastructure

## Context

The repository had comprehensive agent methodology documentation in `instructions/` but was missing the actual living documents and artifact structure needed to operate the development loop.

## Options Considered

1. **Bootstrap-First** - Create living documents, runs/ structure, enhance verify.sh. Use Claude Code manually.
   - Pros: Fast to implement, establishes foundations, no new dependencies
   - Cons: No automated orchestration yet

2. **Programmatic Orchestrator** - Build a packages/orchestrator with Claude Agent SDK integration
   - Pros: Full automation, CI/CD integration, budget tracking
   - Cons: More complex, requires SDK dependency, longer to implement

3. **Both (Sequential)** - Bootstrap first, then build orchestrator
   - Pros: Gets foundations right before adding complexity
   - Cons: Takes longer overall

## Decision

Chose **Bootstrap-First** approach based on user preference for:
- Manual CLI triggers only (no automated scheduling)
- No hard budget limits (rely on verification gates)

This establishes the workflow before adding programmatic complexity.

## Consequences

### Enables
- Claude Code can now operate with clear contracts (REQUIREMENTS.md, MILESTONE.md)
- Development loops are auditable via runs/ artifacts
- Verification is machine-checkable via `./verify.sh --ui=false`
- Future milestones can add programmatic orchestration when needed

### Constrains
- No automated triggering (manual sessions only)
- No budget enforcement (developer responsibility)
- Beads CLI integration is available but not formalized into orchestrator
