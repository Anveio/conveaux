# Completion Gate

This document defines exactly when work is "done". No ambiguity.

## The Hard Gate

You are "done" ONLY when **BOTH** conditions are true:

1. `MILESTONE.md` contains the exact line: `Status: done`
2. `./verify.sh --ui=false` exits with code `0`

## Machine-Checkable Contract

```bash
# Check 1: Milestone status
grep -q "^Status: done$" MILESTONE.md
MILESTONE_DONE=$?

# Check 2: Verification passes
./verify.sh --ui=false
VERIFY_PASSED=$?

# Both must be 0
if [ $MILESTONE_DONE -eq 0 ] && [ $VERIFY_PASSED -eq 0 ]; then
  echo "DONE"
else
  echo "NOT DONE"
fi
```

## What Counts as Done

- `Status: done` is written in MILESTONE.md by YOU (the agent)
- `./verify.sh --ui=false` exits 0

## What Does NOT Count as Done

| Situation | Why Not Done |
|-----------|--------------|
| "I think it's working" | No machine verification |
| Tests pass but `Status: done` not set | Completion contract not met |
| `Status: done` set but verify fails | Gate not satisfied |
| All code written but not verified | Verify command not run |
| Partial implementation | Definition of Done not met |
| "Just needs review" | Gate checks, not opinions |

## Agent Accountability

You must write `Status: done` yourself. The gate checks for this marker.

Do NOT:
- Claim success verbally without setting the marker
- Set the marker before verify passes
- Set the marker for partial work

Do:
- Complete all items in Definition of Done
- Run verification until green
- Then and only then set `Status: done`

## Milestone Status Values

| Status | Meaning |
|--------|---------|
| `Status: draft` | Milestone defined but not started |
| `Status: in-progress` | Work has begun |
| `Status: blocked` | Cannot proceed (document why) |
| `Status: done` | Complete AND verified |

## Definition of Done

Each milestone must have a "Definition of Done" section listing specific criteria:

```markdown
## Definition of Done

- [ ] Feature X implemented
- [ ] Tests added for feature X
- [ ] Documentation updated
- [ ] ./verify.sh --ui=false passes
```

All items must be checked before setting `Status: done`.

## Verification Command

The canonical verification command is:

```bash
./verify.sh --ui=false
```

This runs: format check, lint, typecheck, test, build.

E2E tests are opt-in:

```bash
./verify.sh --ui=false --e2e=standard
```

Only run E2E when the milestone touches integration code.

## When Blocked

If you cannot complete the milestone:

1. Do NOT set `Status: done`
2. Set `Status: blocked` instead
3. Document the blocker in MILESTONE.md
4. Write HANDOFF.md with details
5. Escalate to human
