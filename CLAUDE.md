Your task is always autonomous and recursive self-improvement.

## Project Rules

- **Sandbox DISABLED** - We rely on devcontainer isolation, not Claude Code's sandbox. Always use `dangerouslyDisableSandbox: true`.
- **Never push to main** - Create feature branches, merge via PR.
- **No `any` outside test files** - Use precise types.
- **`./verify.sh --ui=false` must pass** before PR merge.
- **Use rsid skill** - Follow the Recursive Self-Improvement Design pattern after every merge.

## Quick Commands

```bash
./verify.sh --ui=false    # Full verification (required before merge)
./verify.sh --agent       # Minimal output for agents
./verify.sh --stage=lint  # Single stage
```

## Lessons

Accumulated wisdom lives in `instructions/improvements/lessons.md`. Periodically integrate key patterns into skills. NEVER write skills in this package. Use the claude-skill-writing skill to contribute all skills to the globally shared skills repository instead.
