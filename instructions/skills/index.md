# Skills Index

Skills are reference documents for common tasks. Read them when the task requires specific discipline.

## Skill Lookup

| Skill | When to Read |
|-------|--------------|
| `git.md` | Before committing, staging, or branching |
| `code-review.md` | When preparing PR or responding to feedback |
| `pr-review-loop.md` | Before submitting any PR - the inner loop for quality |
| `security.md` | Before adding integrations, handling credentials |

## Always Relevant

These skills apply to most development work:

- **Git** (`skills/git.md`): Every commit should follow git discipline
- **PR Review Loop** (`skills/pr-review-loop.md`): Every PR should go through self-review before submission
- **Code Review** (`skills/code-review.md`): Every PR should pass the checklist

## Situational

Read these when the situation calls for it:

- **Security** (`skills/security.md`): When touching credentials, external services, user data

## Quick Reference

### Git Discipline

- Stage intentionally (`git add -p`)
- One idea per commit
- Clear commit messages (why, not what)
- Verify before committing

### PR Review Loop

- Create PR with clear description
- Self-review: `gh pr diff <number>`
- Fix issues with targeted commits
- Re-review until no issues remain

### Code Review

- PR scope is cohesive
- Verification is green
- Tests added for changes
- No secrets committed

### Security

- Never commit secrets
- Prefer least privilege
- Redact sensitive logs
- Validate untrusted input
