# Development Loop (Claude Code)

This document defines the canonical development loop for building software autonomously.

## The Dual Loop System

Two loops operate together:

```
META-LOOP (Long-timescale):    OBSERVE → PROPOSE → EVALUATE → INTEGRATE
                                         ↓ Feeds improvements into
OUTER-LOOP (Per-session):      PLAN → IMPLEMENT → VERIFY → DECIDE
```

The **outer loop** builds product. The **meta-loop** improves the instructions that guide the outer loop.

See `instructions/meta/self-improvement.md` for the full meta-loop protocol.

## Terms

- **Target repo**: the repository being changed
- **Living documents**: files that steer work over time (REQUIREMENTS.md, MILESTONE.md, etc.)
- **Verification command**: the one command that must pass (`./verify.sh --ui=false`)
- **Session**: a single Claude Code conversation
- **Improvement Proposal (IP)**: a structured proposal for instruction changes

## Required Living Documents

These must exist in the target repo (create minimal versions if missing):

| Document | Purpose | Required |
|----------|---------|----------|
| `REQUIREMENTS.md` | What to build (source of truth) | Yes |
| `MILESTONE.md` | What "done" means now | Yes |
| `PLAN.md` | Current session's implementation plan | Per-session |
| `HANDOFF.md` | Context transfer when stopping | On exit |
| `ARCHITECTURE.md` | System structure and contracts | Recommended |

Templates: `instructions/living-docs/templates/`

## Session Flow

### 1. Bootstrap (Start of Session)

```
1. Locate repo root (package.json, turbo.json, verify.sh)
2. Read REQUIREMENTS.md (understand the product)
3. Read MILESTONE.md (understand current goal)
4. Read HANDOFF.md if exists (resume context)
5. Run ./verify.sh --ui=false (establish baseline)
```

### 2. Plan (Before Any Code Changes)

```
1. Write/update PLAN.md with:
   - Approach and constraints
   - Numbered steps with verification checkpoints
   - Rollback strategy
2. Consult patterns (if architectural decisions involved):
   - Creating a package? → Read instructions/reference/patterns/package-setup.md
   - Using time/logging/random/env? → Read instructions/reference/patterns/core-ports.md
3. Break down tasks in PLAN.md
4. Identify when to run verification
```

**Pattern Consultation**: Before making architectural decisions, check `instructions/reference/architecture.md` for required reading. This ensures institutional knowledge is applied.

### 3. Implement (Iterative)

```
For each step in plan:
  1. Make changes (code, tests, docs)
  2. Run targeted verification if appropriate
  3. Commit when a logical unit is complete
  4. Update PLAN.md progress notes
  5. OBSERVE: Note any instruction gaps or friction (meta-loop)
```

**Meta-loop observation**: While implementing, notice if instructions don't address your situation, feel overly heavy, or conflict. Note observations in PLAN.md "Notes" section.

### 4. Verify (After Implementation)

```
1. Run ./verify.sh --ui=false
2. If fails:
   - Analyze error output
   - Fix the issue
   - Retry (max 3 times)
3. If still fails after 3 retries:
   - Escalate to human OR
   - Write HANDOFF.md with failure details
```

### 5. Decide (After Verify Green)

```
Is milestone complete? Check against Definition of Done in MILESTONE.md

If YES:
  1. Set Status: done in MILESTONE.md
  2. Commit with milestone completion message
  3. Report success to human

If NO:
  1. Continue to next increment
  2. Return to Plan step
```

### 6. Exit (End of Session)

```
If context running low OR blocked:
  1. Write HANDOFF.md
  2. Commit all changes
  3. Report status to human

If milestone complete:
  1. Final commit with summary
  2. Report completion to human

Meta-loop steps (always):
  3. PROPOSE: Create IPs for accumulated observations (if any generalize)
  4. EVALUATE: Self-review IPs against verification checklist
  5. INTEGRATE: Implement accepted IPs, update CHANGELOG
  6. Record lessons in instructions/improvements/lessons.md
```

See `instructions/meta/self-improvement.md` for IP creation and evaluation criteria.

## State Transitions

```
BOOTSTRAP
    |
    v
  PLAN ------> EXIT (if blocked)
    |
    v
IMPLEMENT
    |
    v
  VERIFY
    |
    +---> RECOVER (if failed, max 3 times)
    |         |
    |         v
    |       VERIFY
    |
    v
  DECIDE
    |
    +---> PLAN (milestone not complete)
    |
    v
  EXIT (milestone complete)
```

## What Claude Code Provides Natively

- **Session persistence**: Conversation history (within context window)
- **Planning**: Document-driven via PLAN.md
- **Progress tracking**: PLAN.md checkboxes and notes
- **Artifact persistence**: Git commits
- **Recovery**: Can analyze errors and retry

## What These Instructions Add

1. **Explicit checkpoints**: When to verify, when to commit
2. **Completion contract**: Machine-checkable "done" condition
3. **Handoff protocol**: What to write when context runs out
4. **Discipline**: Following the loop even when it feels unnecessary

## Recovery Flow

When verification fails:

```
Attempt 1: Fix and retry
Attempt 2: Fix and retry
Attempt 3: Fix and retry
Attempt 4+: STOP. Either:
  - Escalate to human for guidance
  - Write HANDOFF.md and exit
```

Do NOT loop indefinitely. Three retries is the maximum before escalation.

## Deviations

If you deviate from the plan:

1. Update PLAN.md with the new approach
2. Record the reason and any risks
3. Continue with the updated plan

## Invariants

These must always hold:

- **Determinism**: Bounded retries, explicit timeouts
- **Auditability**: Git history shows what happened
- **No silent success**: Exit only when milestone done AND verify green
- **Persistence**: Git commits are the real persistence layer
