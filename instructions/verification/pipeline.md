# Verification Pipeline

The verification pipeline is your source of truth. Code is not done until verification passes.

## The One Command

```bash
./verify.sh --ui=false
```

This is the canonical verification command. Run it:

- Before declaring any milestone complete
- After making significant changes
- When unsure if something broke
- At the start of each session (establish baseline)

## Architecture

The verification pipeline is implemented as a TypeScript application:

```
apps/validation-pipeline/
├── src/
│   ├── cli.ts                 # CLI entry point
│   ├── pipeline.ts            # Pipeline orchestrator
│   ├── contracts/             # Stage/result interfaces
│   ├── stages/                # Individual stage implementations
│   └── reporters/             # Output formatters
```

`verify.sh` is a lightweight wrapper that builds the pipeline if needed and delegates to it.

## Stages

| Stage | What It Checks |
|-------|----------------|
| check | Prerequisites (Node.js ≥22, npm ≥10, git) |
| install | Dependencies installed |
| lint | Code formatting and static analysis (Biome.js) |
| typecheck | TypeScript type errors |
| build | Compilation succeeds |
| test | Unit and integration tests |

## Output Modes

### Headless Mode (for agents/CI)

```bash
./verify.sh --ui=false
```

- Machine-parseable output
- One line per stage: `STAGE:name:START`, `STAGE:name:PASS/FAIL`
- Use this mode for automation

### Interactive Mode (for humans)

```bash
./verify.sh
```

- Colored output with timing
- Detailed progress
- Only use when human is watching

## CLI Options

```bash
./verify.sh                    # Interactive mode, all stages
./verify.sh --ui=false         # Headless mode
./verify.sh --stage=lint       # Run single stage
./verify.sh --no-autofix       # Skip lint autofix
./verify.sh --ci               # CI mode (headless + no autofix)
```

## Command Conventions

**Never use `npx` directly.** Always use `npm run` scripts defined in package.json.

```bash
# WRONG - don't use npx
npx @biomejs/biome check .
npx turbo build

# RIGHT - use npm scripts
npm run lint:check
npm run build
```

Why:
- Scripts are documented in package.json
- Consistent interface across the codebase
- Easier to update tool versions
- Better caching behavior

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All stages passed |
| 1 | At least one stage failed |
| 2 | Invalid usage |

## Running Individual Stages

For faster iteration during development:

```bash
./verify.sh --stage=lint
./verify.sh --stage=typecheck
./verify.sh --stage=test
```

Or use npm scripts directly:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

But always run the full pipeline before declaring done.

## Iterating on Failures

When verification fails:

1. Read the error output carefully
2. Identify the failing stage
3. Fix the issue
4. Run verification again
5. Repeat until green

Do NOT:
- Proceed with broken verification
- Assume "it's probably fine"
- Skip stages manually

## Common Issues

### Check Fails

Missing prerequisites. Install:
- Node.js ≥ 22
- npm ≥ 10
- git

### Lint Fails

Code formatting or static analysis issues. Run with autofix:
```bash
npm run lint
```

Or check without fixing:
```bash
npm run lint:check
```

### Typecheck Fails

Type errors. Fix the types. Do NOT use `any` outside test files.

### Test Fails

Tests broken. Fix the tests or the code they test.

### Build Fails

Compilation error. Fix the code.

## Pipeline as Product

Treat the verification pipeline as a product:

- Keep it fast (cache appropriately)
- Keep it reliable (no flaky tests)
- Keep it deterministic (same input = same output)
- Improve it over time
