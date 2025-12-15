# Run Artifacts

This directory contains reproducible artifacts from agent development loops.

## Structure

Each run creates a timestamped directory:

```
runs/
  2024-01-15/
    10-30-00-fix-parser/
      prompt.md      # Input that started this run
      decision.md    # What was decided, trade-offs considered
      diff.patch     # Git diff of changes (git diff HEAD~1)
      verify.log     # Output of ./verify.sh --ui=false
```

## File Specifications

### prompt.md

The exact prompt or work item that initiated this run.

```markdown
# Prompt

## Source
beads issue bd-abc123 / user request / continuation

## Content
[The actual prompt or task description]
```

### decision.md

Documents decisions made during the run.

```markdown
# Decision: <brief title>

## Context
What situation led to this decision?

## Options Considered
1. Option A - pros/cons
2. Option B - pros/cons

## Decision
Which option and why.

## Consequences
What this decision enables or constrains.
```

### diff.patch

Generated via:
```bash
git diff HEAD~1 > runs/<date>/<time>-<slug>/diff.patch
```

### verify.log

Generated via:
```bash
./verify.sh --ui=false > runs/<date>/<time>-<slug>/verify.log 2>&1
```

## Retention

- Keep runs from current milestone
- Archive older runs to separate storage after milestone completion
- Delete runs older than 30 days unless marked for retention

## Creating a Run

At the end of a development session:

```bash
# Create run directory
RUN_DIR="runs/$(date +%Y-%m-%d)/$(date +%H-%M-%S)-<slug>"
mkdir -p "$RUN_DIR"

# Capture artifacts
git diff HEAD~1 > "$RUN_DIR/diff.patch"
./verify.sh --ui=false > "$RUN_DIR/verify.log" 2>&1
# Manually create prompt.md and decision.md
```

## Git Tracking

The runs/ directory is partially tracked:
- Structure and README are tracked
- Large artifacts (logs, patches) are gitignored
- This allows reproducibility without bloating the repo
