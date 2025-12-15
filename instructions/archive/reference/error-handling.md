# Error Handling

Conventions for consistent, user-friendly error handling.

## Error Categories

| Category | Example | Handling |
|----------|---------|----------|
| User error | Invalid input | Helpful message, suggest fix |
| Config error | Missing env var | Clear message, how to fix |
| External error | API timeout | Retry or fail gracefully |
| Bug | Null reference | Crash with stack trace |

## Throw vs Return

### Throw When

- The caller cannot reasonably handle it
- It's a programming error (bug)
- Control flow should stop

```typescript
throw new Error('Config validation failed: missing API_KEY');
```

### Return Error When

- The caller needs to decide what to do
- Multiple outcomes are valid
- Error is expected/recoverable

```typescript
type Result<T> = { ok: true; value: T } | { ok: false; error: string };
```

## User-Facing Messages

Messages should be:
- Clear (what happened)
- Actionable (how to fix)
- Not technical jargon

```
// BAD
Error: ENOENT /foo/bar

// GOOD
Error: Configuration file not found at /foo/bar
       Create the file or set CONFIG_PATH to an existing file.
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid usage / arguments |
| 3 | Configuration error |

Be consistent across the codebase.

## Error Mapping

Map internal errors to user-facing errors at boundaries:

```typescript
// Internal
class DatabaseConnectionError extends Error {}

// At CLI boundary
catch (error) {
  if (error instanceof DatabaseConnectionError) {
    console.error('Unable to connect to database. Check your connection settings.');
    process.exit(3);
  }
  throw error; // Unexpected error, let it crash
}
```

## Logging vs Throwing

- **Log**: For observability, debugging
- **Throw**: For control flow, signaling failure

Don't log then throw the same error (double logging).

## Error Shapes

Standardize error structure:

```typescript
interface AppError {
  code: string;        // Machine-readable
  message: string;     // Human-readable
  cause?: Error;       // Original error
  context?: object;    // Additional data
}
```

## Stack Traces

- Include for bugs (unexpected errors)
- Hide for user errors (expected failures)
- Never include in production user output unless debug mode

## Recovery Strategies

| Strategy | When |
|----------|------|
| Retry | Transient failures (network timeout) |
| Fallback | Non-critical feature |
| Fail fast | Critical path, can't continue |
| Escalate | Human intervention needed |

## Quick Reference

```typescript
// User error - helpful message
throw new UserError('Invalid email format. Example: user@example.com');

// Config error - how to fix
throw new ConfigError('Missing AWS_REGION. Set it in .env or environment.');

// External error - may retry
if (isRetryable(error)) {
  await retry(operation);
}

// Bug - crash with context
throw new Error(`Unexpected state: ${JSON.stringify(state)}`);
```
