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
   Issues      NO     ┌────────────────┐
   Found?  ─────────→ │ Merge Criteria │
       │              │    Pass?       │
      YES             └───────┬────────┘
       │                      │
       └──────────────────────┤
                              │ YES
                              ↓
                      ┌───────────────┐
                      │ Merge to Main │
                      └───────────────┘
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

## Step 5: Merge (Autonomous)

When all review criteria pass, merge the PR autonomously.

### Merge Criteria Checklist

All must be true before merging:

| Criterion | How to Verify |
|-----------|---------------|
| **Build passes** | `npm run build` exits 0 |
| **Tests pass** | `npm run test` exits 0 |
| **No unresolved review comments** | `gh pr view <number> --comments` shows no pending items |
| **Branch is up to date** | `git fetch origin main && git log HEAD..origin/main --oneline` is empty |
| **PR description is complete** | Summary explains what/why, test plan exists |
| **Self-review complete** | At least one PR review loop iteration done |

### Merge Commands

```bash
# Verify all criteria first
npm run build && npm run test

# Check for conflicts with main
git fetch origin main
git log HEAD..origin/main --oneline  # Should be empty or rebase needed

# If rebase needed
git rebase origin/main
git push --force-with-lease

# Merge the PR (squash for clean history)
gh pr merge <number> --squash --delete-branch

# Or merge with all commits preserved
gh pr merge <number> --merge --delete-branch
```

### Merge Strategy Selection

| Strategy | When to Use |
|----------|-------------|
| `--squash` | Multiple small commits that form one logical change (default) |
| `--merge` | Each commit is meaningful and should be preserved |
| `--rebase` | Linear history preferred, commits are clean |

### Post-Merge Verification

After merging, verify main is healthy:

```bash
# Switch to main and pull
git checkout main
git pull origin main

# Verify build and tests still pass
npm run build && npm run test
```

### When NOT to Merge Autonomously

Do **not** auto-merge if:

1. **Human review requested** - User explicitly asked for review
2. **Breaking changes** - API changes affecting other consumers
3. **Security-sensitive** - Auth, credentials, permissions changes
4. **Uncertain about correctness** - Edge cases unclear
5. **Large scope** - PR touches many unrelated areas

In these cases, request human review:

```bash
gh pr edit <number> --add-reviewer <username>
# Or comment requesting review
gh pr comment <number> --body "Ready for review. Please check [specific concern]."
```

### Autonomous Merge Example

```bash
# 1. Final verification
npm run build && npm run test

# 2. Check branch status
git fetch origin main
git log HEAD..origin/main --oneline  # Empty = good

# 3. Merge
gh pr merge 4 --squash --delete-branch

# 4. Verify main
git checkout main && git pull
npm run build && npm run test

# 5. Done - main is healthy
```

## Related Skills

- [code-review.md](./code-review.md) - What reviewers look for
- [git.md](./git.md) - Git operations and hygiene
