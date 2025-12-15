# Completion Gate

This document defines exactly when work is "done". No ambiguity.

## The Hard Gate

You are "done" ONLY when **ALL** conditions are true:

1. TSC goals are achieved (all stated objectives met)
2. `./verify.sh --ui=false` exits with code `0`
3. No draft IPs older than 2 sessions remain unresolved
4. Any lessons learned during this session are recorded

The first two are the primary gates. The last two are self-verified.

## Machine-Checkable Contract

```bash
# Check: Verification passes
./verify.sh --ui=false
VERIFY_PASSED=$?

# Must be 0
if [ $VERIFY_PASSED -eq 0 ]; then
  echo "VERIFICATION GATE: PASS"
else
  echo "VERIFICATION GATE: FAIL"
fi
```

Goal completion is evaluated by the TSC based on stated objectives.

## What Counts as Done

- TSC confirms goals are achieved
- `./verify.sh --ui=false` exits 0

## What Does NOT Count as Done

| Situation | Why Not Done |
|-----------|--------------|
| "I think it's working" | No machine verification |
| Code written but verify fails | Gate not satisfied |
| All code written but not verified | Verify command not run |
| Partial implementation | TSC goals not met |
| "Just needs review" | Gate checks, not opinions |

## Agent Accountability

You must:
- Complete all TSC goals before declaring success
- Run verification and confirm it passes
- Report clearly to TSC what was accomplished

Do NOT:
- Claim success verbally without verification
- Skip verification before declaring done
- Leave goals partially complete without communicating to TSC

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

Only run E2E when the goal touches integration code.

## When Blocked

If you cannot complete the goals:

1. Do NOT claim success
2. Document what's blocking progress
3. Communicate clearly to TSC
4. Wait for TSC guidance

## Instruction Quality Check

At goal completion, verify instructions haven't drifted:

1. **Did I follow the instructions as written?**
   - If no: Did the deviation work better? → Create IP
   - If yes: Instructions are accurate

2. **Did instructions cover the situations I encountered?**
   - If no: Document the gap → Create IP
   - If yes: Instructions are complete

3. **Did any instruction slow me down unnecessarily?**
   - If yes: Is the overhead justified? If not → Create IP
   - If no: Instructions are efficient

See `instructions/meta/self-improvement.md` for the full meta-loop protocol.
