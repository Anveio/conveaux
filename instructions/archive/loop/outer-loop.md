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
- **Technical Steering Committee (TSC)**: human oversight that provides goals, requirements, and evaluates outcomes
- **Verification command**: the one command that must pass (`./verify.sh --ui=false`)
- **Session**: a single Claude Code conversation
- **Improvement Proposal (IP)**: a structured proposal for instruction changes

## Coordination Model

Requirements and goals flow from the Technical Steering Committee:

```
┌─────────────────────────────────────────────────────────────┐
│              TECHNICAL STEERING COMMITTEE                   │
│     (Provides goals, evaluates outcomes, guides direction)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Requirements & Goals
┌─────────────────────────────────────────────────────────────┐
│                      CODING AGENT                           │
│        (Executes via PLAN → IMPLEMENT → VERIFY → DECIDE)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Results & Lessons
┌─────────────────────────────────────────────────────────────┐
│                   INSTRUCTION SYSTEM                        │
│     (lessons.md, patterns, IPs - evolves over time)         │
└─────────────────────────────────────────────────────────────┘
```

The TSC provides:
- **Goals**: What to achieve in the current session
- **Constraints**: Boundaries and non-goals
- **Evaluation**: Whether outcomes meet the bar

The agent:
- **Plans**: Breaks down goals into implementation steps
- **Implements**: Writes code, tests, documentation
- **Verifies**: Runs the verification pipeline
- **Reports**: Communicates results back to TSC

## Session Flow

### 1. Bootstrap (Start of Session)

```
1. Locate repo root (package.json, turbo.json, verify.sh)
2. Receive goals from the Technical Steering Committee
3. Run ./verify.sh --ui=false (establish baseline)
4. Check lessons.md for relevant accumulated wisdom
```

### 2. Plan (Before Any Code Changes)

```
1. Break down TSC goals into implementation steps
2. Consult patterns (if architectural decisions involved):
   - Creating a package? → Read instructions/reference/patterns/package-setup.md
   - Using time/logging/random/env? → Read instructions/reference/patterns/core-ports.md
3. Identify verification checkpoints
4. Use TodoWrite to track progress
```

**Pattern Consultation**: Before making architectural decisions, check `instructions/reference/architecture.md` for required reading. This ensures institutional knowledge is applied.

### 3. Implement (Iterative)

```
For each step in plan:
  1. Make changes (code, tests, docs)
  2. Run targeted verification if appropriate
  3. Commit when a logical unit is complete
  4. Update todo list progress
  5. OBSERVE: Note any instruction gaps or friction (meta-loop)
```

**Meta-loop observation**: While implementing, notice if instructions don't address your situation, feel overly heavy, or conflict. Note observations for later IP creation.

### 4. Verify (After Implementation)

```
1. Run ./verify.sh --ui=false
2. If fails:
   - Analyze error output
   - Fix the issue
   - Retry (max 3 times)
3. If still fails after 3 retries:
   - Escalate to TSC for guidance
```

### 5. Decide (After Verify Green)

```
Are the TSC goals complete? Check against the stated objectives.

If YES:
  1. Report success to TSC
  2. Commit with completion message

If NO:
  1. Continue to next increment
  2. Return to Plan step
```

### 6. Exit (End of Session)

```
If context running low OR blocked:
  1. Commit all changes
  2. Report status to TSC

If goals complete:
  1. Final commit with summary
  2. Report completion to TSC

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
    +---> PLAN (goals not complete)
    |
    v
  EXIT (goals complete)
```

## What Claude Code Provides Natively

- **Session persistence**: Conversation history (within context window)
- **Planning**: TodoWrite tool for structured task tracking
- **Progress tracking**: Todo list with status updates
- **Artifact persistence**: Git commits
- **Recovery**: Can analyze errors and retry

## What These Instructions Add

1. **Explicit checkpoints**: When to verify, when to commit
2. **Completion contract**: Machine-checkable "done" condition (verify green)
3. **TSC coordination**: Clear authority and communication model
4. **Discipline**: Following the loop even when it feels unnecessary

## Recovery Flow

When verification fails:

```
Attempt 1: Fix and retry
Attempt 2: Fix and retry
Attempt 3: Fix and retry
Attempt 4+: STOP. Escalate to TSC for guidance
```

Do NOT loop indefinitely. Three retries is the maximum before escalation.

## Invariants

These must always hold:

- **Determinism**: Bounded retries, explicit timeouts
- **Auditability**: Git history shows what happened
- **No silent success**: Exit only when goals complete AND verify green
- **Persistence**: Git commits are the real persistence layer
