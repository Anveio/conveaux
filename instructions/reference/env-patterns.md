# Environment Patterns

Conventions for configuration and environment variables.

## Principles

1. **Explicit over implicit** - No magic defaults that differ by environment
2. **Fail fast** - Validate config at startup, not deep in code
3. **No secrets in code** - Use env vars, profiles, or secret stores

## Environment Variable Naming

```
<PREFIX>_<CATEGORY>_<NAME>

Examples:
APP_DATABASE_URL
APP_LOG_LEVEL
AWS_REGION
```

Rules:
- SCREAMING_SNAKE_CASE
- Prefix with app name for app-specific vars
- Use standard names for standard tools (AWS_REGION, NODE_ENV)

## Loading Order

1. Environment variables (highest priority)
2. `.env.local` (local overrides, gitignored)
3. `.env` (defaults, may be committed)
4. Hardcoded defaults (last resort)

## Required vs Optional

```typescript
// Required - fail if missing
const apiKey = requireEnv('API_KEY');

// Optional - use default
const logLevel = getEnv('LOG_LEVEL', 'info');
```

Fail fast for required config:
```typescript
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
```

## Validation

Validate at startup:

```typescript
const config = {
  port: parsePort(getEnv('PORT', '3000')),
  logLevel: parseLogLevel(getEnv('LOG_LEVEL', 'info')),
  dbUrl: requireEnv('DATABASE_URL'),
};

// Validate all values
validateConfig(config);
```

## CI vs Local Differences

| Aspect | Local | CI |
|--------|-------|-----|
| `.env` file | May exist | Should not be needed |
| Secrets | In `.env.local` | In CI secrets store |
| Database | Local or Docker | CI service |
| E2E tests | Manual opt-in | Automatic |

## .env Files

```bash
# .env - defaults, can commit
LOG_LEVEL=debug
PORT=3000

# .env.local - secrets, gitignored
API_KEY=secret-key
DATABASE_URL=postgres://...
```

Never commit `.env.local`.

## AWS-Specific

```bash
# Region (required for AWS operations)
AWS_REGION=us-east-1

# Profile (for local development)
AWS_PROFILE=my-profile

# Alternative: explicit credentials (CI)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Prefer profiles locally, explicit credentials in CI.

## Common Issues

### "Works locally but not in CI"

- Missing environment variable in CI
- Different default values
- Local `.env` file not replicated

Solution: Document all required env vars and their defaults.

### Secret in logs

- Logged config object includes secrets

Solution: Redact before logging:
```typescript
console.log('Config:', redactSecrets(config));
```

### Different behavior by environment

- Code branches on NODE_ENV
- Hidden environment-specific behavior

Solution: Make environment differences explicit in config, not code.

## Config Documentation

Document required environment variables:

```markdown
## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 3000 | Server port |
| LOG_LEVEL | No | info | Logging verbosity |
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| API_KEY | Yes | - | External API key |
```

## Quick Reference

```typescript
// Get with default
const port = getEnv('PORT', '3000');

// Require (fail if missing)
const dbUrl = requireEnv('DATABASE_URL');

// Parse and validate
const config = {
  port: parseInt(port, 10),
  dbUrl,
};

// Validate at startup
if (isNaN(config.port)) {
  throw new Error('PORT must be a number');
}
```
