---
name: claude-code-works
description: Run the claude-code-works coding agent to create or improve packages following the instructions framework. Use when creating new packages, improving existing packages, or running autonomous coding loops.
---

# claude-code-works

A Bun-based coding agent that follows the `/instructions` framework for recursive self-improvement.

## When to Use

Use this skill when:
- Creating a new package from scratch
- Improving an existing package autonomously
- Running the outer loop (PLAN → IMPLEMENT → VERIFY → DECIDE)
- Testing the instructions framework end-to-end

## Prerequisites

- Bun runtime installed
- `ANTHROPIC_API_KEY` environment variable set

## Commands

### Improve an Existing Package

Analyze and improve a package following the instructions framework:

```bash
bun run apps/claude-code-works/src/cli.ts improve <package-path>
```

Example:
```bash
bun run apps/claude-code-works/src/cli.ts improve packages/agent-core
```

Options:
- `--iterations=<n>` - Maximum iterations (default: 3)

### Create a New Package

Create a new package from scratch, following patterns:

```bash
bun run apps/claude-code-works/src/cli.ts create <package-name> --type=<type> --description="<desc>"
```

Example:
```bash
bun run apps/claude-code-works/src/cli.ts create clock --type=port --description="Clock port implementation"
```

Options:
- `--type=<type>` - Package type: `contract`, `port`, `adapter`, `core`, `app`
- `--description=<desc>` - Package description
- `--iterations=<n>` - Maximum iterations (default: 5)

## How It Works

1. **Loads instructions** - Reads `/instructions` directory (START.md, outer-loop.md, patterns, lessons)
2. **Builds context** - Injects relevant instructions into Claude's system prompt
3. **Runs outer loop** - Coordinates through PLAN → IMPLEMENT → VERIFY → DECIDE
4. **Parses signals** - Agent outputs markers like `[VERIFICATION:PASS]`, `[LESSON:...]`
5. **Verifies completion** - Runs `./verify.sh --ui=false` to check gates

## Output Signals

The agent outputs these markers for coordination:
- `[VERIFICATION:PASS]` - Verification succeeded
- `[VERIFICATION:FAIL]` - Verification failed
- `[MILESTONE:COMPLETE]` - Task is done
- `[LESSON:...]` - Lesson learned worth recording
- `[BLOCKED:...]` - Cannot proceed
- `[MORE_WORK_NEEDED]` - Needs another iteration

## Completion Gate

The agent considers itself done when:
1. `MILESTONE.md` contains `Status: done`
2. `./verify.sh --ui=false` exits with code 0

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "ANTHROPIC_API_KEY not set" | Export your API key: `export ANTHROPIC_API_KEY=sk-...` |
| Agent stuck in loop | Check `--iterations` limit, review agent output for blockers |
| Verification fails | Run `./verify.sh --ui=false` manually to see detailed errors |
| Package not following patterns | Ensure `/instructions/reference/patterns/` exists and is readable |

## Related

- `/instructions/loop/outer-loop.md` - The development loop protocol
- `/instructions/reference/patterns/package-setup.md` - Package creation patterns
- `/instructions/improvements/lessons.md` - Accumulated lessons
