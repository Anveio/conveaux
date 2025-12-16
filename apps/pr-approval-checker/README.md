# @conveaux/pr-approval-checker

Poll for PR approval from a bot reviewer (e.g., `chatgpt-codex-connector[bot]`).

## Usage

```bash
# Basic usage - poll for 10 minutes
node --import tsx apps/pr-approval-checker/src/cli.ts https://github.com/owner/repo/pull/123

# Check once without polling
node --import tsx apps/pr-approval-checker/src/cli.ts https://github.com/owner/repo/pull/123 --once

# Custom bot and timeout
node --import tsx apps/pr-approval-checker/src/cli.ts https://github.com/owner/repo/pull/123 \
  --bot my-review-bot \
  --timeout 5 \
  --interval 15

# Enable debug logging
node --import tsx apps/pr-approval-checker/src/cli.ts https://github.com/owner/repo/pull/123 --verbose

# JSON logs for programmatic consumption
node --import tsx apps/pr-approval-checker/src/cli.ts https://github.com/owner/repo/pull/123 --json
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--bot <username>` | Bot username to check for | `chatgpt-codex-connector[bot]` |
| `--timeout <minutes>` | Timeout in minutes | `10` |
| `--interval <seconds>` | Poll interval in seconds | `30` |
| `--once` | Check once and exit (no polling) | `false` |
| `--json` | Output logs as JSON | `false` |
| `-v, --verbose` | Enable debug logging | `false` |

## Environment Variables

Options can also be set via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PR_CHECKER_BOT` | Bot username to check for | `chatgpt-codex-connector[bot]` |
| `PR_CHECKER_TIMEOUT` | Timeout in minutes | `10` |
| `PR_CHECKER_INTERVAL` | Poll interval in seconds | `30` |

CLI options take precedence over environment variables.

## Exit Codes

| Code | Status | Meaning |
|------|--------|---------|
| 0 | approved | Bot reacted with thumbs up to the PR body or a comment |
| 1 | feedback | Bot left a comment (needs changes) |
| 2 | timeout | No response within timeout period |
| 3 | error | Invalid input or system failure |

## JSON Output

The tool outputs structured JSON to stdout for programmatic consumption.

**Approved (exit 0):**

```json
{
  "status": "approved",
  "pr": { "owner": "Anveio", "repo": "conveaux", "number": 73 },
  "approval": {
    "commentId": 73,
    "commentType": "pr_body",
    "reactedBy": "chatgpt-codex-connector[bot]",
    "reactedAt": "2025-12-16T10:30:00Z"
  }
}
```

Note: `commentType` can be `"pr_body"`, `"issue"`, or `"review"` depending on where the reaction was placed.

**Feedback (exit 1):**

```json
{
  "status": "feedback",
  "pr": { "owner": "Anveio", "repo": "conveaux", "number": 73 },
  "feedback": {
    "commentId": 123457,
    "author": "chatgpt-codex-connector[bot]",
    "body": "Please fix the type error in line 42...",
    "createdAt": "2025-12-16T10:30:00Z"
  }
}
```

**Timeout (exit 2):**

```json
{
  "status": "timeout",
  "pr": { "owner": "Anveio", "repo": "conveaux", "number": 73 },
  "elapsedMs": 600000
}
```

**Error (exit 3):**

```json
{
  "status": "error",
  "pr": { "owner": "Anveio", "repo": "conveaux", "number": 73 },
  "message": "GitHub CLI (gh) is not authenticated..."
}
```

## Prerequisites

- **GitHub CLI (gh)**: Must be installed and authenticated
- **Node.js 20+**: Required for running the tool

## Troubleshooting

### "gh is not installed"

Install the GitHub CLI:

- **macOS**: `brew install gh`
- **Linux**: `sudo apt install gh`
- **Windows**: `winget install GitHub.cli`
- **Verify**: `gh --version`

See: https://cli.github.com/

### "gh is not authenticated"

Authenticate with GitHub:

```bash
gh auth login
```

Follow the prompts to authenticate, then verify:

```bash
gh auth status
```

### Rate limiting

The checker automatically handles rate limits by logging warnings and continuing to poll. If you hit persistent rate limits, increase the `--interval` option.

## Architecture

The tool follows the contract-port pattern for dependency injection:

```
src/
├── cli.ts          # Entry point (thin)
├── composition.ts  # Dependency injection setup
├── checker.ts      # Core polling logic
├── github.ts       # GitHub API client
├── errors.ts       # Custom error classes
└── types.ts        # Shared type definitions
```

All platform globals (Date, process.env) are injected via the composition root, making the code testable without mocks.
