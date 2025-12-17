---
description: Run full verification pipeline
---
Run the verification pipeline: `./verify.sh --ui=false`

If $ARGUMENTS is provided, run only that stage:
- `lint` - Run lint check only
- `types` - Run type check only
- `tests` - Run tests only
- `build` - Run build only

Otherwise run the full pipeline (all stages).

**On failure:**
1. Report which stage failed
2. Show the specific error output (first 50 lines)
3. Suggest the appropriate fix:
   - Lint failures: "Run `/lint-and-learn` to auto-fix and learn"
   - Type failures: "Check the types manually or run `npm run typecheck`"
   - Test failures: "Review failing tests in the output above"
   - Build failures: "Check build configuration and dependencies"

**On success:**
Report "All stages passed" with total execution time.

**Example usage:**
- `/verify` - Run full pipeline
- `/verify lint` - Run lint only
- `/verify types` - Run types only
