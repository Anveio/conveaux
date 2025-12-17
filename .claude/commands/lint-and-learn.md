---
description: Fix lint errors and propose skill updates
---
Execute the full lint-fixer workflow with learning extraction.

**Workflow:**

1. **Identify errors:**
   Run `npm run lint:check` to get current lint errors.
   If no errors, report "No lint errors found" and exit.

2. **Spawn lint-fixer agent:**
   Use the lint-fixer agent to fix all errors:
   - Apply Biome auto-fixes where possible
   - Manually fix remaining errors following typescript-coding tenets
   - Group similar fixes to identify patterns

3. **Extract lessons:**
   For each novel fix pattern (not already in typescript-coding skill):
   - Document the error type
   - Document the fix pattern
   - Propose as new tenet for typescript-coding skill

4. **Verify fixes:**
   Run `./verify.sh --ui=false` to confirm all fixes are valid.

5. **Create PR:**
   If verification passes:
   - Create branch: `fix/lint-cleanup-{date}`
   - Commit fixes with message describing patterns fixed
   - Open PR with skill update proposals in description
   - Request TSC review via `/tsc-review`

**Auto-behavior:**
- Creates PR automatically when verification passes
- Requests TSC review automatically
- Does NOT auto-merge (requires human checkpoint)

**On blocked:**
If lint-fixer agent encounters unfixable errors, report them and suggest manual review.
