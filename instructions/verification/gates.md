# Quality Gates

Quality gates define checkpoints where verification must pass before proceeding.

## Gate Types

### Verification Gate (Always Required)

```bash
./verify.sh --ui=false
```

Must pass before:
- Declaring TSC goals complete
- Merging to main branch
- Creating a release

### E2E Gate (When Applicable)

```bash
./verify.sh --ui=false --e2e=standard
```

Run when:
- Touching integration/adapter code
- Before merging AWS-related changes
- Goals involve external services

## When to Run Gates

| Situation | Gate Required |
|-----------|---------------|
| Completing TSC goals | Full verification |
| Merging PR | Full verification |
| Touching adapter code | Verification + E2E |
| Quick iteration | Targeted checks OK |
| Before ending session | Full verification |

## Gate Failure = Stop and Fix

When a gate fails:

1. STOP what you're doing
2. Read the error output
3. Fix the issue
4. Run the gate again
5. Continue only when green

Do NOT:
- "Move on and fix later"
- Ignore warnings that become errors
- Assume someone else will fix it

## Targeted Checks During Development

For faster iteration, run specific stages:

```bash
npm run typecheck    # Just types
npm run test         # Just tests
npm run lint         # Just lint
```

But run full verification:
- Before committing (if significant changes)
- Before declaring goals complete
- When switching between tasks

## Definition of Done Gate

Every TSC goal set includes this implicit gate:

```markdown
- [ ] ./verify.sh --ui=false passes
```

This is non-negotiable. No goal is done without green verification.

## E2E Tiers

| Tier | When to Use |
|------|-------------|
| smoke | Quick sanity check, pre-push |
| standard | Normal development, PR merge |
| full | Release, major changes |

```bash
./verify.sh --ui=false --e2e=smoke
./verify.sh --ui=false --e2e=standard
./verify.sh --ui=false --e2e=full
```

## Continuous Improvement

After completing TSC goals, consider:

- Can we add tests for the new behavior?
- Can we speed up the pipeline?
- Are there flaky tests to fix?
- Is there redundant verification?

Small improvements compound over time.

## Recovery Protocol

If verification has been broken for multiple attempts:

1. Check recent changes: `git log --oneline -10`
2. Try reverting recent commits: `git revert HEAD`
3. Isolate the breaking change
4. Fix or escalate

Max 3 fix attempts before escalating to TSC.
