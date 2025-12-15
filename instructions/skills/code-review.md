# Code Review

This document defines how changes are reviewed so the repo converges instead of thrashing.

## Review Goals

- Catch correctness, security, and maintainability issues early
- Keep changes small and explainable
- Ensure verification and docs match reality

## PR Checklist

Before submitting a PR:

- [ ] Scope is cohesive (unrelated changes split)
- [ ] `./verify.sh --ui=false` is green
- [ ] Public APIs are intentional and documented
- [ ] Tests added/updated for behavior changes
- [ ] No new secrets, credentials, or PII committed
- [ ] Docs updated when behavior/contracts changed

## Agent Response to Feedback

When receiving review feedback:

1. **Treat feedback as requirements**
   - Reviewer comments are not suggestions
   - Address each comment explicitly

2. **Respond with clarity**:
   - What you changed
   - What you didn't change (and why)
   - How you verified the changes

3. **Make targeted follow-up commits**
   - Small, focused fixes
   - Clear commit messages referencing feedback
   - Don't mix unrelated changes

## Example Response

```markdown
Addressed review feedback:

Changed:
- Fixed type error in parseConfig (commit abc123)
- Added test for edge case (commit def456)

Not changed:
- Kept the existing error format per project conventions

Verified:
- ./verify.sh --ui=false passes
- Manual test of the affected flow
```

## What Reviewers Look For

| Area | Questions |
|------|-----------|
| Correctness | Does it work? Are edge cases handled? |
| Security | Any secrets? Injection risks? Auth checks? |
| Tests | Are changes tested? Do tests actually verify behavior? |
| Clarity | Can someone understand this in 6 months? |
| Scope | Is this PR cohesive? Should it be split? |

## Preparing for Review

Before requesting review:

1. Self-review your own diff
2. Ensure verification passes
3. Write clear PR description:
   - What changed
   - Why it changed
   - How to test it
4. Keep PR size reasonable (< 500 lines ideal)

## Handling Conflicts

If you disagree with feedback:

1. Explain your reasoning clearly
2. Propose alternatives if applicable
3. Accept reviewer's decision if they insist
4. Escalate to tech lead only for significant disagreements

## Git Hygiene in PRs

- Rebase onto main before merge
- Squash fixup commits if they add noise
- Keep commit history meaningful
- Reference issue numbers where applicable
