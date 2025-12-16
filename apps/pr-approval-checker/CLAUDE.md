# PR Approval Checker

CLI tool to poll GitHub PRs for bot approval. Use when waiting for automated review feedback.

## Quick Usage

```bash
# Check once (no polling)
node --import tsx apps/pr-approval-checker/src/cli.ts <pr-url> --once

# Poll for 10 minutes (default)
node --import tsx apps/pr-approval-checker/src/cli.ts <pr-url>

# Custom settings
node --import tsx apps/pr-approval-checker/src/cli.ts <pr-url> \
  --bot <username> \
  --timeout 5 \
  --interval 15
```

## Exit Codes

| Code | Status | Meaning |
|------|--------|---------|
| 0 | approved | Bot reacted with thumbs up |
| 1 | feedback | Bot left a comment |
| 2 | timeout | No response within timeout |
| 3 | error | Invalid input or system failure |

## Architecture

Follows contract-port pattern:

- `cli.ts` - Entry point, arg parsing (thin)
- `composition.ts` - Dependency injection (composition root)
- `checker.ts` - Core polling logic
- `github.ts` - GitHub API client via `gh` CLI
- `errors.ts` - ConveauxError subclasses
- `types.ts` - Shared types

## Key Patterns

### Use EphemeralScheduler for delays

```typescript
// Good - lifecycle-managed, testable
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => scheduler.delay(resolve, ms));

// Bad - raw setTimeout, not injectable
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
```

### All platform globals injected at composition root

```typescript
// composition.ts injects: Date, setTimeout, clearTimeout, process.env
const scheduler = createEphemeralScheduler({
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  // ...
});
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PR_CHECKER_BOT` | `chatgpt-codex-connector[bot]` | Bot username |
| `PR_CHECKER_TIMEOUT` | `10` | Timeout in minutes |
| `PR_CHECKER_INTERVAL` | `30` | Poll interval in seconds |
