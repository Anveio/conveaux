# Session Continuity

This document defines how to handle session boundaries, resume work, and hand off context.

## Git is the Persistence Layer

Claude Code conversations are ephemeral. Git commits are permanent.

- Conversation history = temporary working memory
- Git commits = durable storage
- HANDOFF.md = context bridge between sessions

## Detecting Session State

At the start of any session:

```
1. Check for HANDOFF.md
   - If exists: This is a RESUME session
   - If missing: This is a FRESH session

2. Check MILESTONE.md Status
   - draft: Work not started
   - in-progress: Work was interrupted
   - blocked: Previous session hit a wall
   - done: Previous milestone complete, need new one
```

## Fresh Session Start

When starting fresh (no HANDOFF.md):

1. Read REQUIREMENTS.md (understand the product)
2. Read MILESTONE.md (understand current goal)
3. Read ARCHITECTURE.md if exists (understand structure)
4. Run `./verify.sh --ui=false` (establish baseline)
5. Write PLAN.md (plan your approach)
6. Begin work

## Resume Session

When resuming (HANDOFF.md exists):

1. Read HANDOFF.md first (get context)
2. Read the files listed in "Required docs to read next"
3. Check verification status from handoff
4. Review "Remaining Work" section
5. Update PLAN.md with your approach
6. Continue from where previous session stopped
7. Delete HANDOFF.md after successfully resuming

## When to Write HANDOFF.md

Write HANDOFF.md when:

- Context is running low (conversation getting long)
- You hit a blocker you cannot resolve
- The milestone is too large for one session
- You need human input to proceed
- Session is ending for any reason

## HANDOFF.md Content

Use template: `instructions/living-docs/templates/HANDOFF.md.tmpl`

Required sections:

```markdown
# Handoff

## What Changed
- List of files modified with brief description
- Links to specific commits if relevant

## Verification Status
- Last command: ./verify.sh --ui=false
- Exit code: 0 (or error details)
- Failing stage: (if applicable)

## Remaining Work
- Specific tasks still needed
- Estimated complexity

## Blockers
- What's preventing progress
- What input is needed

## Next Steps
- Exact commands to run
- Files to read first
- Decisions needed
```

## Context Management

### Signals That Context is Running Low

- Conversation is very long
- You're starting to forget earlier details
- Repeated questions about things discussed before

### What to Capture Before Stopping

1. Current git status (`git status -sb`)
2. Recent commits (`git log -n 5 --oneline`)
3. Verification status (last run result)
4. What you were working on
5. What's left to do

### Commit Discipline

Commit frequently so progress is not lost:

- After completing a logical unit
- Before attempting risky changes
- Before ending a session
- After fixing a verification failure

## Deleting HANDOFF.md

After successfully resuming:

1. Verify you understand the context
2. Confirm verification baseline
3. Delete HANDOFF.md
4. Commit the deletion: `git commit -m "Resume: delete HANDOFF.md"`

Do NOT leave stale HANDOFF.md files in the repo.

## Multi-Session Milestones

For milestones that span multiple sessions:

1. Each session writes HANDOFF.md on exit
2. Each session reads HANDOFF.md on start
3. Track progress in MILESTONE.md Progress section
4. Update PLAN.md each session with refined approach

## Session Checklist

### Start of Session

```
[ ] Read HANDOFF.md if exists
[ ] Read MILESTONE.md
[ ] Run ./verify.sh --ui=false
[ ] Write/update PLAN.md
[ ] Set up TodoWrite
```

### End of Session

```
[ ] Commit all changes
[ ] Write HANDOFF.md if work remains
[ ] Update MILESTONE.md Progress section
[ ] Final git status check
[ ] Report status to human
```
