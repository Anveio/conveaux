# Living Documents

Living documents are files inside the target repo that steer work over time. They are updated as work progresses and serve as the contract between sessions.

## Document Hierarchy

| Document | Purpose | When Created | Who Updates |
|----------|---------|--------------|-------------|
| `REQUIREMENTS.md` | Source of truth for what to build | Project start | Human (product owner) |
| `MILESTONE.md` | Current work contract | Per milestone | Human defines, agent updates status |
| `PLAN.md` | Per-session execution plan | Each session | Agent |
| `HANDOFF.md` | Context transfer | When stopping | Agent |
| `ARCHITECTURE.md` | System structure | When complexity warrants | Agent or human |

## Authority Hierarchy

When documents conflict, resolve in this order:

1. `REQUIREMENTS.md` - highest authority (what to build)
2. `MILESTONE.md` - current scope (what to build now)
3. `ARCHITECTURE.md` - structure constraints
4. `PLAN.md` - tactical approach (can change freely)

## Required Documents

### REQUIREMENTS.md (Always Required)

The source of truth. Contains:

- Problem being solved
- Goals and non-goals
- Constraints
- Acceptance criteria

If missing: Create a minimal version immediately.

Template: `instructions/living-docs/templates/REQUIREMENTS.md.tmpl`

### MILESTONE.md (Always Required)

The current work contract. Contains:

- Goal for this milestone
- Non-goals (explicit scope boundaries)
- Definition of done
- Status marker
- Progress tracking

If missing: Create based on REQUIREMENTS.md.

Template: `instructions/living-docs/templates/MILESTONE.md.tmpl`

## Per-Session Documents

### PLAN.md (Created Each Session)

Your execution plan for the current session. Contains:

- Approach and strategy
- Numbered steps with checkpoints
- Rollback plan
- Notes and deviations

Write this BEFORE coding. Update as you deviate.

Template: `instructions/living-docs/templates/PLAN.md.tmpl`

### HANDOFF.md (Created When Stopping)

Context transfer for the next session. Contains:

- What changed
- Verification status
- Remaining work
- Blockers
- Next steps

Delete after successfully resuming.

Template: `instructions/living-docs/templates/HANDOFF.md.tmpl`

## Recommended Documents

### ARCHITECTURE.md (When Complexity Warrants)

System structure and contracts. Contains:

- High-level diagram
- Module boundaries
- Ports and adapters
- Data model

Create when:
- Multiple packages/modules exist
- Dependency direction matters
- New developers need orientation

## Update Discipline

### REQUIREMENTS.md

- Updated by human (product owner)
- Agent should NOT modify without explicit permission
- If requirements seem wrong, raise with human

### MILESTONE.md

- Human defines goal, non-goals, definition of done
- Agent updates: Status, Progress section
- Agent sets `Status: done` only when complete AND verified

### PLAN.md

- Agent creates at session start
- Agent updates when deviating
- Throw away at session end (write HANDOFF.md instead)

### HANDOFF.md

- Agent creates when stopping mid-milestone
- Next session reads it, then deletes it
- Never leave stale handoffs

## Status Values

For MILESTONE.md:

| Status | Meaning | Next Action |
|--------|---------|-------------|
| `draft` | Defined but not started | Begin work |
| `in-progress` | Work has begun | Continue work |
| `blocked` | Cannot proceed | Document blocker, escalate |
| `done` | Complete AND verified | Human defines next milestone |

## File Locations

All living documents live at project root:

```
project/
  REQUIREMENTS.md
  MILESTONE.md
  PLAN.md
  HANDOFF.md
  ARCHITECTURE.md
```

Do NOT put them in subdirectories.
