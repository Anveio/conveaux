# Session: Improve @conveaux/port-logger

## Objective

Improve `@conveaux/port-logger` through the RSID loop while updating instructions to accelerate future sessions.

## Bootstrap

1. Read these files first:
   - `instructions/START.md` - Entry point
   - `instructions/meta/self-improvement.md` - RSID loop
   - `instructions/skills/pr-review-loop.md` - PR workflow
   - `instructions/reference/patterns/contract-port.md` - Package architecture

2. Check accumulated wisdom:
   - `instructions/improvements/lessons.md` - Scan domains: package-setup, core-abstractions
   - `instructions/skills/pr-review-loop.md` - PR workflow skill
   - `instructions/skills/code-review.md` - Self-review checklist

3. Understand the target package:
   - `packages/port-logger/src/index.ts` - Implementation
   - `packages/port-logger/src/index.test.ts` - Tests
   - `packages/port-logger/package.json` - Dependencies
   - `packages/contract-logger/src/index.ts` - Contract interface

## Task

### Phase 1: OBSERVE
Analyze the target package for:
- [ ] Missing test coverage
- [ ] API gaps or inconsistencies
- [ ] Documentation missing JSDoc
- [ ] Dependencies that should be extracted to contracts
- [ ] Violations of L-003 (no direct globals)
- [ ] Type precision improvements (no `any`)

### Phase 2: PROPOSE
For each improvement found:
- Create IP in `instructions/improvements/proposals/IP-{NNN}-{slug}.md`
- Or implement directly if small and obvious

### Phase 3: IMPLEMENT
- Create feature branch: `feat/improve-port-logger`
- Make targeted changes with clear commits
- Add/improve tests for new behavior
- Update instructions if patterns discovered

**Potential improvements for port-logger:**
- Add log level filtering (minLevel option)
- Add structured error serialization (Error objects → stack traces)
- Add async/batch writing option for high-throughput
- Add log entry metadata (pid, hostname)
- Improve child logger deep merge behavior

### Phase 4: PR REVIEW LOOP
Execute until no issues remain:
```
Create PR → Self-Review → Fix Issues → Re-Review
```
See `instructions/skills/pr-review-loop.md` for detailed checklist.

### Phase 5: MERGE (Autonomous)
Verify all criteria pass, then merge:
```bash
# For port packages (no external services):
./verify.sh --ui=false

# For adapter packages (external deps):
./verify.sh --ui=false --e2e=smoke

git fetch origin main && git log HEAD..origin/main --oneline  # Empty = good
gh pr merge <number> --squash --delete-branch
git checkout main && git pull && ./verify.sh --ui=false
```

## Constraints

- Never push directly to main
- No `any` types outside test files
- Ports must inject all dependencies as contracts
- Tests use inline mocks, not shipped test implementations
- 90% implementation work, 10% instruction work

## Available Packages to Improve

| Package | Type | Description |
|---------|------|-------------|
| `contract-clock` | Contract | Time operations interface |
| `contract-logger` | Contract | Structured logging interface |
| `contract-outchannel` | Contract | Output channel interface |
| `port-clock` | Port | System time implementation |
| `port-logger` | Port | JSON logging implementation |
| `port-outchannel` | Port | stdout/stderr implementation |
| `agent-contracts` | Contract | Agent system interfaces |
| `agent-core` | Port | Agentic loop + tools |
| `agent-orchestrator` | Port | Agent coordination |

## Success Criteria

- [ ] port-logger improved with all tests passing
- [ ] At least one IP created or lesson recorded in lessons.md
- [ ] PR merged to main via review loop
- [ ] Main branch healthy post-merge (build + tests green)
- [ ] Instructions updated if new patterns discovered

## To Target a Different Package

Replace `port-logger` with any of:
- `contract-clock`, `port-clock` - Time operations
- `contract-outchannel`, `port-outchannel` - Output channels
- `contract-logger` - Logger interface (if extending API)
- `agent-contracts`, `agent-core`, `agent-orchestrator` - Agent system
