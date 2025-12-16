# Devcontainer Security Footguns (Checklist)

Avoid these unless you have a written justification and you understand the host impact.

> **Automated checking**: These footguns are automatically detected by `./verify.sh --stage=devcontainer`. The verification stage catches root users, privileged mode, docker socket mounts, missing hardening, and dangerous capabilities.

## Host-escape primitives

- Mounting the Docker socket: `/var/run/docker.sock`
- Running with `--privileged`
- Adding broad capabilities (e.g. `SYS_ADMIN`)
- Enabling `--pid=host` / `--network=host`

## Secret leakage patterns

- Baking secrets into images (Dockerfile `ARG`/`ENV` with credentials)
- Writing secrets into the workspace or logs
- Sharing `.env` files into git

## Over-broad mounts

- Mounting the whole home directory into the container
- Mounting `/` or `/Users` (macOS) or other sensitive host paths

## Unsafe defaults

- Running as root by default
- "Convenience" scripts that auto-run `rm -rf`/`git clean -xfd` without a prompt

## Claude Code sandbox conflicts (when using devcontainers)

- **Leaving Claude Code's sandbox enabled** when devcontainer is your security layer
  - Causes: `can't create temp file for here document: operation not permitted`
  - Breaks: git commits with heredocs, many shell operations
  - Fix: Always use `dangerouslyDisableSandbox: true` in Bash tool calls
  - Rationale: Devcontainer isolation is stronger and more appropriate than Claude Code's sandbox

## If you must do something risky

Write down:

- why it’s required
- what the blast radius is
- how you’ll detect misuse
- what the rollback/recovery plan is

