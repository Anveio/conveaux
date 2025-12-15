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

## What It Covers

| Stage | What It Checks |
|-------|----------------|
| doctor | Environment setup (Node, npm, git, dependencies) |
| format | Code formatting (Biome/Prettier) |
| lint | Static analysis, code quality |
| typecheck | TypeScript type errors |
| test | Unit and integration tests |
| build | Compilation succeeds |

## Output Modes

### Headless Mode (for agents)

```bash
./verify.sh --ui=false
```

- One line per stage
- Compact failure output
- Machine-parseable
- Use this mode always

### Interactive Mode (for humans)

```bash
./verify.sh
```

- Spinners and status icons
- Detailed progress
- Only use when human is watching

## E2E Tests (Opt-in)

E2E tests require credentials and real infrastructure. They're skipped by default.

```bash
# Run with standard E2E tier
./verify.sh --ui=false --e2e=standard

# Run all E2E tests
./verify.sh --ui=false --e2e=full
```

When to run E2E:
- Before merging to main
- When touching integration/adapter code
- When milestone involves external services

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All stages passed |
| Non-zero | At least one stage failed |

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

## Building the Pipeline

If `./verify.sh` doesn't exist or is broken, building it is your FIRST priority.

Requirements:

1. Root entrypoint `verify.sh` that runs a TypeScript runner
2. Stages: format, lint, typecheck, test, build
3. Doctor stage for environment validation
4. Headless mode for CI/agent use
5. Exit code indicates pass/fail

## Running Individual Stages

For faster iteration during development:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

But always run the full pipeline before declaring done.

## Pipeline as Product

Treat the verification pipeline as a product:

- Keep it fast (cache appropriately)
- Keep it reliable (no flaky tests)
- Keep it deterministic (same input = same output)
- Improve it over time

## Common Issues

### "Doctor" Fails

Missing prerequisites. Install what's needed:
- Node >= 22
- npm >= 10
- Git

### Format Fails

Code not formatted. Run:
```bash
npm run format -- --write
```

### Lint Fails

Static analysis issues. Fix the code or update lint rules if appropriate.

### Typecheck Fails

Type errors. Fix the types. Do NOT use `any` outside test files.

### Test Fails

Tests broken. Fix the tests or the code they test.

### Build Fails

Compilation error. Fix the code.
