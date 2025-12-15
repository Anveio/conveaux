# Security Basics

Minimal, repeatable checklist for security-conscious development.

## Rules of Thumb

1. **Never commit secrets**
   - No API keys, tokens, passwords in code
   - Use environment variables, profiles, or secret stores
   - If accidentally committed, rotate immediately

2. **Assume logs may be shared**
   - Redact sensitive values before logging
   - No tokens or credentials in log output
   - Consider what appears in error messages

3. **Prefer least privilege**
   - Request only permissions you need
   - Scope credentials narrowly
   - Review IAM policies for over-permissiveness

## Threat Modeling (Lightweight)

For any new feature or integration, answer:

| Question | Why It Matters |
|----------|----------------|
| What data is handled? | PII requires extra care |
| Any credentials involved? | Credentials need protection |
| What external calls are made? | Trust boundaries exist |
| What are the abuse cases? | DoS, injection, privilege escalation |

## Dependency Policy

- Prefer well-maintained dependencies with clear provenance
- Avoid adding dependencies for trivial utilities
- Run verification gates before merging
- Keep dependencies updated (security patches)

## Common Footguns

### Logging Secrets

```typescript
// BAD
console.log(`Token: ${apiToken}`);

// GOOD
console.log('Token: [REDACTED]');
```

### Shell Command Injection

```typescript
// BAD
exec(`git checkout ${userInput}`);

// GOOD
execFile('git', ['checkout', userInput]);
```

### Overly Broad IAM

```json
// BAD
"Effect": "Allow",
"Action": "*",
"Resource": "*"

// GOOD
"Effect": "Allow",
"Action": ["s3:GetObject"],
"Resource": "arn:aws:s3:::my-bucket/*"
```

## Before Adding Integrations

Checklist:

- [ ] What credentials are needed?
- [ ] Where are credentials stored? (env vars, profiles)
- [ ] What's the minimum permission set?
- [ ] How are credentials rotated?
- [ ] What happens if credentials leak?

## Secrets in Tests

- Unit tests should NOT require real credentials
- Use fakes/mocks for external services
- E2E tests use separate, scoped credentials
- Never commit test credentials

## If You Find a Secret in Git

1. **Rotate the secret immediately**
2. Purge from git history if possible
3. Notify the team
4. Review access logs if available
5. Document the incident

## Security Review Triggers

Request security review when:

- Adding authentication/authorization
- Handling PII or financial data
- Adding new external integrations
- Changing permission models
- Processing user-provided content

## Quick Reference

| Do | Don't |
|----|-------|
| Use env vars for secrets | Hardcode credentials |
| Validate untrusted input | Trust user input |
| Scope permissions narrowly | Use wildcard permissions |
| Redact logs | Log sensitive data |
| Use parameterized queries | Concatenate SQL strings |
