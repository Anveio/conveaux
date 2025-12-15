# IP-004: Add Enforcement Gates to coding-loop Skill

Status: draft

## Trigger

- **Session**: feat/source-first-development (2024-12-15)
- **Context**: Migrating entire monorepo to source-first development
- **Observation**: 52-file change merged as single commit with minimal review. Skills existed (code-review, effective-git) but weren't invoked or enforced.

## Problem

The coding-loop skill references other skills (code-review, effective-git) but doesn't enforce their use. Large changes can be merged without:

1. **Atomic commits** - 52 files in one commit violates effective-git's "one idea per commit"
2. **Substantive review** - Ran `gh pr diff` but didn't document findings per code-review
3. **Size gates** - No blocker for PRs > 200 lines

**Impact of not fixing**: Agent can claim compliance while producing unreviable, un-revertable mega-commits that make history useless for debugging and rollback.

## Proposed Change

**Files affected:**

- `~/.claude/skills/coding-loop/SKILL.md` - Add hard gates section with enforcement

**New section to add:**

```markdown
## Hard Gates (Blocking)

These gates MUST be satisfied before PR creation:

### 1. Commit Atomicity Gate

```bash
# Check commit count and size
git log --oneline main..HEAD
```

| Commits | Lines Changed | Action Required |
|---------|---------------|-----------------|
| 1 | > 200 | SPLIT: Use `git rebase -i main` per effective-git |
| Any | > 500 total | SPLIT: Break into logical units |

**If gate fails**: Invoke `effective-git` skill and restructure before PR.

### 2. Review Documentation Gate

Before merge, document review findings:

```markdown
## Review: PR #<number>
**Level**: Quick/Standard/Deep (per code-review skill)
**Files reviewed**: X
**Issues found**: Y (list them)
**Verified**: tests pass, no secrets, follows patterns
```

**If undocumented**: Review is incomplete. Do not merge.

### 3. Size-Based Skill Invocation

| Change Size | Required Skills |
|-------------|-----------------|
| < 50 lines | coding-loop (this) |
| 50-200 lines | + code-review |
| > 200 lines | + effective-git (restructure first) |
| > 10 files | + human review consideration |
```

## Expected Benefit

1. **Atomic history**: Each commit revertable, reviewable independently
2. **Documented reviews**: Clear audit trail of what was checked
3. **Forced skill usage**: Large changes trigger appropriate discipline
4. **Human escalation**: Very large changes get visibility

## Risks

1. **Over-process for small changes**: Mitigated by size thresholds
2. **Slows velocity**: Acceptable tradeoff for reviewability
3. **Subjective splitting**: "One idea" can be interpreted differently

## Verification Checklist

- [x] **Grounded**: Cites specific session (feat/source-first-development) and 52-file commit
- [x] **Non-contradictory**: Reinforces existing skills, doesn't conflict
- [x] **Actionable**: Specific gates with thresholds
- [x] **Minimal**: Only adds enforcement, doesn't change skill content
- [x] **Testable**: Can check commit count, line count, review documentation
- [x] **Bounded**: Affects skill file (depth 1)

## Decision

**Decided**: 2024-12-15
**Reviewer**: self-review
**Outcome**: accepted
**Rationale**: Direct observation of anti-pattern in same session. Skills exist but need enforcement mechanism.
