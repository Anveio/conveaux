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
- `instructions/living-docs/templates/IP.md.tmpl` - Improvement Proposal template
- `instructions/reference/patterns/contract-port.md` - Contract-port package architecture pattern
- `instructions/improvements/proposals/IP-001-consolidate-port-documentation.md` - Port documentation consolidation
- `instructions/improvements/proposals/IP-002-build-tool-guidance.md` - Build tool selection guidance
- `instructions/skills/pr-review-loop.md` - PR review loop skill (PR → Review → Improve → Review)

### Changed

- `instructions/START.md` - Added reference to meta-instructions and lessons
- `instructions/loop/outer-loop.md` - Added observation points and meta-loop reference
- `instructions/loop/completion-gate.md` - Extended with instruction quality gate
- `instructions/reference/patterns/core-ports.md` - Refactored to reference contract packages instead of inline interfaces (IP-001)
- `instructions/reference/patterns/package-setup.md` - Added build tool selection guidance for tsc vs tsup (IP-002)
- `instructions/improvements/lessons.md` - Added L-004 (build tool selection) and L-005 (instruction consolidation)

### Removed

- None

---

## [1.0.0] - 2024-12-14

Initial instruction system.

### Added

- Core development loop (PLAN → IMPLEMENT → VERIFY → DECIDE)
- Living documents system (REQUIREMENTS, MILESTONE, PLAN, HANDOFF)
- Verification pipeline and gates
- Skills documentation (git, code-review, security)
- Reference documentation (architecture, env-patterns, error-handling)
