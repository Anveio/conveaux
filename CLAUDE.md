# Conveaux Instructions

## Session Defaults (MANDATORY)

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
@instructions/improvements/proposals/IP-001-consolidate-port-documentation.md
@instructions/improvements/proposals/IP-002-build-tool-guidance.md

## Session Prompts
@instructions/prompts/session-improve-package.md

## Changelog
@instructions/CHANGELOG.md

## Devcontainer Sandboxing Skill (auto-loaded)
@~/.claude/skills/devcontainer-sandboxing/SKILL.md
@~/.claude/skills/devcontainer-sandboxing/SECURITY-FOOTGUNS.md
