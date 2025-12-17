---
description: Spawn TSC reviewer with auto-merge on approval
---
Execute full review lifecycle for a pull request.

**Arguments:**
$ARGUMENTS must be a PR number (e.g., `123`)

**Workflow:**

1. **Validate PR exists:**
   Run `gh pr view $ARGUMENTS` to confirm PR is open and reviewable.
   If PR not found or already merged, report and exit.

2. **Spawn tsc-reviewer agent:**
   Use the tsc-reviewer agent to review the PR:
   - Determine rigor level (Quick/Standard/Deep/Critical) based on PR size
   - Evaluate against criteria: correctness, tests, types, security, patterns, architecture, dependencies
   - Produce verdict: APPROVED / CHANGES_REQUESTED / NEEDS_DISCUSSION

3. **Handle verdict:**

   **If APPROVED:**
   - Verify all CI checks pass: `gh pr checks $ARGUMENTS`
   - If checks pass: auto-merge with squash and delete branch
   - If checks fail: report which checks failed, do NOT merge

   **If CHANGES_REQUESTED:**
   - Report the required changes with rationale
   - Do NOT auto-retry or auto-fix
   - Human must address feedback and re-run `/tsc-review`

   **If NEEDS_DISCUSSION:**
   - Report concerns requiring human input
   - Do NOT proceed with merge
   - Await human decision

**Human checkpoints:**
- Only auto-merge on clean APPROVED + passing checks
- All other verdicts pause for human action

**Example usage:**
- `/tsc-review 42` - Review and potentially auto-merge PR #42
