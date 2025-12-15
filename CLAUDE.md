# Conveaux Instructions

## Session Defaults (MANDATORY)

### Coding Loop Skills (Required for All Coding Tasks)

**At the start of every coding session**, read all coding-loop related skills:

| Skill | Purpose | When Critical |
|-------|---------|---------------|
| `coding-loop` | Core verification gates | Always |
| `code-review` | Rigorous PR review | Before any merge |
| `effective-git` | Commit discipline | Changes > 200 lines |
| `coding-patterns` | Architecture patterns | Creating/modifying packages |
| `github-cli` | PR workflow | PR creation and merge |
| `verification-pipeline` | Debugging verify.sh | When verification fails |

**Invoke `Skill(coding-loop)` at session start.** The skill will guide you to related skills based on task size.

### Sandbox Mode
- **Sandbox is DISABLED** - we rely on devcontainer isolation instead of Claude Code's built-in sandbox.
- Always use `dangerouslyDisableSandbox: true` for bash commands to avoid temp file and heredoc issues.

### Devcontainer Sandboxing (Primary Security Layer)
- **At the start of every session**, invoke the `devcontainer-sandboxing` skill to ensure the development environment is properly containerized and hardened.
- Before executing any destructive or system-modifying commands, verify you are running inside a devcontainer.
- Follow all security guidelines from the devcontainer-sandboxing skill (non-root user, no docker socket mount, no privileged mode).

---

All instruction files are imported below for automatic context loading.

## Core Entry Point
@instructions/START.md

## Architecture & Reference
@instructions/reference/architecture.md
@instructions/reference/tsc-coordination.md
@instructions/reference/env-patterns.md
@instructions/reference/error-handling.md
@instructions/reference/patterns/contract-port.md
@instructions/reference/patterns/core-ports.md
@instructions/reference/patterns/package-setup.md

## Agent Loop Protocol
@instructions/loop/outer-loop.md
@instructions/loop/completion-gate.md
@instructions/loop/session-continuity.md

## Verification
@instructions/verification/pipeline.md
@instructions/verification/gates.md

## Meta & Self-Improvement
@instructions/meta/self-improvement.md
@instructions/improvements/lessons.md
@instructions/improvements/meta-feedback.md

## Session Prompts
@instructions/prompts/session-improve-package.md

## Changelog
@instructions/CHANGELOG.md

## Auto-loaded Skills

### Devcontainer Sandboxing
@~/.claude/skills/devcontainer-sandboxing/SKILL.md
@~/.claude/skills/devcontainer-sandboxing/SECURITY-FOOTGUNS.md

### Coding Loop (Core + Related)
@~/.claude/skills/coding-loop/SKILL.md
@~/.claude/skills/code-review/SKILL.md
@~/.claude/skills/effective-git/SKILL.md
@~/.claude/skills/coding-patterns/SKILL.md
@~/.claude/skills/github-cli/SKILL.md
@~/.claude/skills/verification-pipeline/SKILL.md
