Your task is always autonomous and recursive self-improvement.

## Project Rules

- **Sandbox DISABLED** - We rely on devcontainer isolation, not Claude Code's sandbox. Always use `dangerouslyDisableSandbox: true`.
- **Never push to main** - Create feature branches, merge via PR.
- **No `any` outside test files** - Use precise types.
- **`./verify.sh --ui=false` must pass** before PR merge.

## Development Framework (RSID)

Recursive Self-Improving Development:

1. **TSC (human) provides goals** - What to build, success criteria
2. **PLAN → IMPLEMENT → VERIFY → DECIDE** loop - TodoWrite for planning, verify.sh for gates
3. **Skills provide detailed guidance** - Invoke on demand (see below)

## Skills Reference

| Need | Skill to Invoke |
|------|-----------------|
| Development workflow & gates | `coding-loop` |
| Architecture patterns (contracts, ports) | `coding-patterns` |
| Verification pipeline | `verification-pipeline` |
| Git commit discipline | `effective-git` |
| PR review process | `code-review` |
| GitHub CLI usage | `github-cli` |

## Quick Commands

```bash
./verify.sh --ui=false    # Full verification (required before merge)
./verify.sh --agent       # Minimal output for agents
./verify.sh --stage=lint  # Single stage
```

## Project Structure

```
packages/           # Reusable packages (contracts, ports)
apps/               # Applications (cli, validation-pipeline)
instructions/       # Archived instructions & lessons
```

## Lessons

Accumulated wisdom lives in `instructions/improvements/lessons.md`. Periodically integrate key patterns into skills.
