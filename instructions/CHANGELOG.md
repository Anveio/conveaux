# Instruction Changelog

All notable changes to the instruction system.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- `instructions/meta/self-improvement.md` - Meta-loop protocol for recursive self-improvement
- `instructions/improvements/lessons.md` - Accumulated wisdom registry
- `instructions/improvements/meta-feedback.md` - Feedback on meta-instructions (human review)
- `instructions/improvements/proposals/` - Directory for Improvement Proposals
- `instructions/CHANGELOG.md` - This file
- `instructions/improvements/proposals/IP.md.tmpl` - Improvement Proposal template (moved from living-docs)
- `instructions/reference/patterns/contract-port.md` - Contract-port package architecture pattern
- `instructions/improvements/proposals/IP-001-consolidate-port-documentation.md` - Port documentation consolidation
- `instructions/improvements/proposals/IP-002-build-tool-guidance.md` - Build tool selection guidance
- `instructions/improvements/proposals/IP-003-claude-code-works-type-safety.md` - Type safety improvements for claude-code-works
- `apps/claude-code-works/src/type-guards.ts` - Centralized type guards for runtime validation
- `apps/claude-code-works/src/type-guards.ts:extractExecErrorOutput` - Helper for consistent exec error extraction
- Technical Steering Committee (TSC) coordination model - Human provides goals, agent executes

### Changed

- `instructions/START.md` - Rewritten for TSC coordination model, removed living document references
- `instructions/loop/outer-loop.md` - Rewritten for TSC coordination model, replaced REQUIREMENTS.md/MILESTONE.md with TSC goals
- `instructions/loop/completion-gate.md` - Rewritten for TSC goals instead of MILESTONE.md status markers
- `instructions/loop/session-continuity.md` - Rewritten for TSC coordination, removed HANDOFF.md references
- `instructions/verification/gates.md` - Updated to reference TSC goals instead of milestones
- `instructions/meta/self-improvement.md` - Updated to use todo list instead of PLAN.md for observations
- `CLAUDE.md` - Removed living-docs import
- `instructions/reference/patterns/core-ports.md` - Refactored to reference contract packages instead of inline interfaces (IP-001)
- `instructions/reference/patterns/package-setup.md` - Added build tool selection guidance for tsc vs tsup (IP-002)
- `instructions/improvements/lessons.md` - Added L-004 (build tool selection), L-005 (instruction consolidation), L-007/L-008/L-009 (type safety)
- `apps/claude-code-works/src/tools.ts` - Replaced type assertions with type guards, improved grep error handling (IP-003)
- `apps/claude-code-works/src/agent.ts` - Replaced type assertions with type guards (IP-003)
- `apps/claude-code-works/src/loop.ts` - Fixed regex escaping, replaced type assertions (IP-003)
- `apps/claude-code-works/src/cli.ts` - Fixed parseIntFlag to handle value 0 correctly (IP-003)

### Removed

- `instructions/living-docs/` - Entire directory removed, replaced by TSC coordination model
- `instructions/living-docs/overview.md` - Living documents concept replaced by TSC goals
- `instructions/living-docs/templates/REQUIREMENTS.md.tmpl` - TSC provides goals directly
- `instructions/living-docs/templates/MILESTONE.md.tmpl` - TSC provides goals directly
- `instructions/living-docs/templates/PLAN.md.tmpl` - Replaced by TodoWrite tool
- `instructions/living-docs/templates/HANDOFF.md.tmpl` - Replaced by TSC communication
- `instructions/skills/code-review.md` - Moved to github-cli skill
- `instructions/skills/git.md` - Moved to github-cli skill
- `instructions/skills/index.md` - Skills now managed via .claude/skills/
- `instructions/skills/pr-review-loop.md` - Moved to github-cli skill
- `instructions/skills/security.md` - Archived

---

## [1.0.0] - 2024-12-14

Initial instruction system.

### Added

- Core development loop (PLAN → IMPLEMENT → VERIFY → DECIDE)
- Living documents system (REQUIREMENTS, MILESTONE, PLAN, HANDOFF)
- Verification pipeline and gates
- Skills documentation (git, code-review, security)
- Reference documentation (architecture, env-patterns, error-handling)
