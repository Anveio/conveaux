---
name: devcontainer-sandboxing
description: Create or harden a devcontainer-based development sandbox so coding agents run inside an isolated container with least privilege and strong guardrails (no destructive host access, controlled network/secrets, reproducible toolchain).
---

# Devcontainer Sandboxing (Security-First Development)

## When to use

Use this skill when the task mentions:

- “devcontainer”, “containerize dev”, “Codespaces”, “Docker”, “Podman”
- “run the agent in a sandbox”, “avoid host damage”, “destructive commands”
- “lock down filesystem/network/secrets”, “least privilege”

## Goal (what “done” looks like)

You have a repo that can be developed and validated from inside a container so that:

- edits are limited to the workspace checkout (not the rest of the host)
- the default user is non-root
- privileges/capabilities are minimized
- secrets are not baked into the image
- verification (`./verify.sh --ui=false` or equivalent) runs inside the container
- the setup is reproducible (pinned versions / deterministic installs)

## State of the art (what teams do in 2025)

### 1) Devcontainers as the default dev “envelope”

- Use a `devcontainer.json` + Dockerfile (or image reference) as the canonical environment definition.
- Run locally (VS Code / devcontainer CLI) and in the cloud (Codespaces or similar) using the same definition.
- Keep host requirements minimal (container runtime + editor).

### 2) Least privilege by default

- **Non-root `remoteUser`**; avoid `sudo` unless explicitly required.
- Drop Linux capabilities and deny privilege escalation whenever possible.
- Never run with `--privileged`.

### 3) Don’t mount the Docker socket unless you truly need it

Mounting `/var/run/docker.sock` effectively gives container code root-equivalent control of the host’s container runtime.

- Prefer building images outside the devcontainer (CI) or use rootless builders (e.g. `buildkitd` rootless) in a dedicated environment.
- If Docker-in-Docker is required, isolate it (separate VM or cloud runner), not the developer laptop.

### 4) Constrain blast radius: filesystem, resources, network

- Filesystem: the only writable mount should be the repo workspace (plus ephemeral caches).
- Resources: cap CPU/memory where feasible to limit runaway processes.
- Network:
  - keep egress enabled by default (developer UX), but document how to run with reduced network for sensitive tasks (e.g. `--network=none` for “format/lint/test” if your toolchain permits)
  - explicitly document any required external hosts (package registries, artifact stores)

### 5) Secrets discipline

- No secrets in the image or git.
- Use runtime injection:
  - env vars via the editor/CLI
  - per-developer secret stores
  - platform secret mounts (Codespaces secrets)
- Ensure logs redact common secret patterns.

### 6) Reproducible toolchains

Pin versions for:

- language runtime (Node/Python/Go/etc.)
- package manager
- system deps

Prefer lockfiles and deterministic install commands.

### 7) Disable Claude Code's built-in sandbox when using devcontainers

When devcontainer isolation is your security layer, **disable Claude Code's built-in sandbox**. The two sandboxing mechanisms conflict - Claude Code's sandbox restricts temp file creation, breaking heredocs, git commits, and many common operations.

**Symptom of the problem:**
```
(eval):1: can't create temp file for here document: operation not permitted
```

**Solution - Every Bash tool call must include:**
```json
{ "dangerouslyDisableSandbox": true }
```

**Add this to your project's CLAUDE.md:**
```markdown
## Session Defaults (MANDATORY)

### Sandbox Mode
- **Sandbox is DISABLED** - we rely on devcontainer isolation instead of Claude Code's built-in sandbox.
- Always use `dangerouslyDisableSandbox: true` for bash commands to avoid temp file and heredoc issues.
```

**Why this is safe:** The devcontainer provides stronger, more appropriate isolation:
- Filesystem writes limited to workspace mount
- Non-root user with minimal privileges
- No docker socket or privileged mode
- Network constraints as needed

Claude Code's sandbox is designed for running on bare metal; devcontainers are the superior isolation mechanism for development workflows.

## Implementation algorithm (agent-friendly)

1) **Detect existing containerization**
   - If `.devcontainer/devcontainer.json` exists: read it and audit for footguns (below).
   - If not, create a minimal devcontainer that supports the repo’s verification pipeline.

2) **Choose the runtime strategy**
   - Local: Docker Desktop, Colima, Podman (rootless preferred).
   - Cloud: Codespaces (recommended for strongest host isolation).
   - If the user is security-sensitive: recommend running the agent inside the devcontainer or inside Codespaces rather than directly on the host.

3) **Create minimal `devcontainer.json`**
   - Use a Dockerfile (or pinned image digest).
   - Set `remoteUser` to non-root.
   - Add only required tooling for `./verify.sh --ui=false` (or repo equivalent).

4) **Harden the container runtime settings**
   - Ensure no docker socket mount.
   - Avoid privileged mode.
   - Prefer capability drops and `no-new-privileges` when supported by the runtime.

5) **Add a “doctor” and a “verify inside container” doc**
   - Document the one command to start the container and the one command to verify.
   - If your repo has `./verify.sh`, make that the default validation contract.

6) **Prove it works**
   - Run verification inside the container.
   - Confirm file writes stay within the workspace.

## Security audit checklist (quick)

- [ ] `remoteUser` is non-root (or `containerUser` is non-root)
- [ ] No `--privileged`
- [ ] No `/var/run/docker.sock` mount
- [ ] Minimal ports exposed
- [ ] Secrets not baked into the image
- [ ] Workspace is the only writable host mount
- [ ] Clear docs: “how to open container” + “how to run verify”

## Optional resources

If you need concrete starting points, read:

- `factory-md/claude-skills/devcontainer-sandboxing/devcontainer.json.example`
- `factory-md/claude-skills/devcontainer-sandboxing/SECURITY-FOOTGUNS.md`

