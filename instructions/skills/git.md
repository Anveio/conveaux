# Git Discipline

Git is your persistence layer and audit trail. Treat every command as communication to teammates and future you.

## Principles

- Each commit carries one idea and a reason
- Unrelated changes belong in separate commits
- Keep history safe: prefer additive fixes over destructive rewrites
- Commits should build and pass tests when feasible

## Working Loop

1. **Learn current state** before editing:
   ```bash
   git status
   git diff HEAD           # All changes (staged + unstaged)
   git diff                 # Unstaged only
   git diff --cached        # Staged only
   ```

2. **Plan commit boundaries** up front
   - Decide what will live together
   - Decide what stays separate

3. **Edit and run checks** relevant to the change

4. **Stage intentionally**:
   ```bash
   git add -p              # Patch mode: select hunks
   git add <specific-file>  # Stage specific files
   ```

5. **Inspect staged vs unstaged**:
   ```bash
   git diff --cached        # What will be committed
   git diff                 # What won't be committed
   ```

6. **Commit with clear message**

7. **Verify the story**:
   ```bash
   git show HEAD            # Review commit
   git status               # Nothing unexpected remains
   ```

## Stage with Intent

Use `git add -p` to select only the hunks that belong in the current commit.

If you over-stage:
```bash
git restore --staged <file>   # Unstage file
git reset -p                  # Unstage specific hunks
```

For mixed concerns in one file:
1. Stage one idea
2. Commit
3. Stage the next idea
4. Commit

Do NOT let unrelated changes hitch a ride.

## Commit Messages

Format:
```
<subject line: imperative, <= 72 chars>

<body: why, how, tests, follow-ups>
```

Subject line:
- Imperative mood ("Add feature" not "Added feature")
- What action this commit performs
- 72 characters or less

Body covers:
- **Why**: the problem or goal
- **How**: key decisions or implementation notes
- **Tests**: commands run or "Tests: not run (reason)"
- **Follow-ups**: known gaps, TODOs, or links

Example:
```
Add sandbox smoke guardrails

Why: Prevent accidental writes during drills.
How: Block non-sandbox ARNs and log rejections via audit port.
Tests: npm test -- --workspace=core-domain
Follow-ups: Wire audit log into CLI output.
```

## Keep History Healthy

Prefer safe operations:
```bash
git revert <sha>           # Undo by creating new commit
git restore <path>          # Discard working tree changes
```

Avoid destructive operations:
```bash
git reset --hard            # Loses uncommitted work
git push --force            # Rewrites shared history
```

Amend only:
- Before pushing
- When explicitly allowed
- Never on shared branches

## Quick Reference

| Action | Command |
|--------|---------|
| See what changed | `git status`, `git diff`, `git diff --cached` |
| Stage carefully | `git add -p`, `git restore --staged <path>` |
| Review history | `git log --oneline -n 5`, `git show <sha>` |
| Undo safely | `git revert <sha>`, `git restore <path>` |

## Before You Commit

Checklist:
- [ ] Working tree clean or intentionally uncommitted?
- [ ] Staged diff matches the story you intend to tell?
- [ ] Commit message explains why/how?
- [ ] No unrelated changes in same commit?
- [ ] `git show HEAD` matches what you want?

## Agent-Specific Rules

- Commit frequently (don't batch up large changes)
- One logical unit per commit
- Run verification before significant commits
- Never commit secrets or credentials
- Use descriptive branch names when creating branches
