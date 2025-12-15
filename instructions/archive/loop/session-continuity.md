# Session Continuity

This document defines how to handle session boundaries and maintain context across sessions.

## Git is the Persistence Layer

Claude Code conversations are ephemeral. Git commits are permanent.

- Conversation history = temporary working memory
- Git commits = durable storage
- TSC communication = context bridge between sessions

## Session Start

At the start of any session:

```
1. Receive goals from the Technical Steering Committee
2. Check git status and recent commits
3. Run ./verify.sh --ui=false (establish baseline)
4. Check lessons.md for relevant accumulated wisdom
5. Begin work on TSC goals
```

## Session End

When ending a session:

```
1. Commit all changes with clear commit messages
2. Report status to TSC:
   - What was accomplished
   - What remains (if incomplete)
   - Any blockers or decisions needed
3. Push changes to remote
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
4. Summary of what you were working on
5. What's left to do

### Commit Discipline

Commit frequently so progress is not lost:

- After completing a logical unit
- Before attempting risky changes
- Before ending a session
- After fixing a verification failure

## Multi-Session Work

For work that spans multiple sessions:

1. Each session receives goals from TSC
2. TSC provides context from previous sessions as needed
3. Git history provides audit trail
4. Lessons.md accumulates wisdom across sessions

## Session Checklist

### Start of Session

```
[ ] Receive goals from TSC
[ ] Check git status and recent history
[ ] Run ./verify.sh --ui=false
[ ] Review lessons.md for relevant patterns
[ ] Set up todo list for session
```

### End of Session

```
[ ] Commit all changes
[ ] Run ./verify.sh --ui=false (verify clean exit)
[ ] Report status to TSC
[ ] Push changes to remote
[ ] Record any lessons learned
```

## When Blocked

If you cannot proceed:

1. Commit any safe changes
2. Clearly communicate the blocker to TSC
3. Document what you tried
4. Wait for TSC guidance before proceeding
