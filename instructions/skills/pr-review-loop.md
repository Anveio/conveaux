# PR Review Loop

This document defines the **PR → Review → Improve → Review** cycle - a fundamental inner loop for code quality.

## The Loop

```
┌─────────────┐
│  Create PR  │
└──────┬──────┘
       ↓
┌─────────────┐
│ Self-Review │ ←──────────────┐
└──────┬──────┘                │
       ↓                       │
┌─────────────┐                │
│ Fix Issues  │                │
└──────┬──────┘                │
       ↓                       │
   Issues      NO              │
   Found?  ─────────→  DONE    │
       │                       │
      YES                      │
       └───────────────────────┘
```

## When to Run This Loop

Run the PR review loop for **every PR** before requesting human review:

1. **After completing a feature** - Self-review before sharing
2. **After receiving feedback** - Review fixes before re-requesting
3. **Before merging** - Final sanity check

## Step 1: Create PR

Create a PR with a clear description:

```bash
gh pr create --title "feat: description" --body "## Summary
- What changed
- Why it changed

## Test plan
- [ ] How to verify

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Step 2: Self-Review

Review your own diff systematically:

```bash
# View the diff
gh pr diff <pr-number>

# Or review files changed
git diff main..HEAD --stat
git diff main..HEAD -- <specific-file>
```

### Review Checklist

| Area | Questions |
|------|-----------|
| **Correctness** | Does the logic work? Edge cases? |
| **Tests** | Are changes tested? Do tests verify behavior? |
| **Types** | No `any` outside tests? Precise types? |
| **Contracts** | Breaking changes? API documented? |
| **Dependencies** | New deps justified? Versions pinned? |
| **Patterns** | Follows project conventions? |
| **Documentation** | Instructions updated if needed? |

### Common Issues to Catch

1. **Unchecked checkboxes** - IPs, test plans left incomplete
2. **Missing re-exports** - Types not exported for convenience
3. **Leftover debug code** - console.log, TODO comments
4. **Import order** - Types separate from implementations
5. **Missing tests** - New code without coverage
6. **Hardcoded values** - Magic strings/numbers

## Step 3: Fix Issues

For each issue found:

1. Make targeted fixes
2. Verify fix doesn't break other things
3. Commit with clear message referencing the fix

```bash
git add <files>
git commit -m "fix(review): description of fix"
git push
```

## Step 4: Re-Review

After fixing, loop back to Step 2:

- Review the new diff
- Ensure fixes are complete
- Check for new issues introduced
- Exit only when no issues remain

## Integration with RSID

During PR review, apply OBSERVE from the RSID meta-loop:

- **Gap**: Missing documentation or patterns?
- **Friction**: Process harder than necessary?
- **Repetition**: Same issue caught multiple times?

If you identify instruction improvements, note them for the RSID PROPOSE phase at session end.

## Commands Reference

```bash
# Create PR
gh pr create --title "..." --body "..."

# View PR diff
gh pr diff <number>

# View specific file changes
git diff main..HEAD -- path/to/file

# Check build/tests
npm run build && npm run test

# Commit fix
git add . && git commit -m "fix(review): ..."

# Push updates
git push
```

## Anti-Patterns

### Review-Then-Ship

**Wrong**: Create PR → brief glance → merge

**Right**: Create PR → systematic review → fix → re-review → merge

### Batch Fixing

**Wrong**: Find 5 issues → one giant fix commit

**Right**: Find issues → fix each with targeted commit → verify each fix

### Skipping Re-Review

**Wrong**: Fix issue → assume done → push

**Right**: Fix issue → re-review entire diff → verify no new issues → push

## Example Session

```
1. Create PR for feature
2. gh pr diff 4
3. Notice: IP checkboxes unchecked
4. Fix: Edit files, check boxes
5. Notice: Types not re-exported from ports
6. Fix: Add re-exports
7. git commit -m "fix(review): ..."
8. Re-review: gh pr diff 4
9. No new issues found
10. git push
11. Done - ready for human review
```

## Related Skills

- [code-review.md](./code-review.md) - What reviewers look for
- [git.md](./git.md) - Git operations and hygiene
