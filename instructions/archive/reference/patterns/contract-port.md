# Contract-Port Architecture

**This pattern is now a Claude Code skill.** Invoke the `coding-patterns` skill for guidance on:

- Package naming conventions (`@scope/contract-{name}`, `@scope/port-{name}`)
- Contracts are pure types (no runtime code)
- Ports inject all dependencies as contracts
- Hermetic primitive ports with environment overrides
- Contract extraction decision tree
- Package structure templates and checklists

## Quick Reference

| Type | Pattern | Purpose |
|------|---------|---------|
| Contract | `@scope/contract-{name}` | Pure interfaces/types, no JS emitted |
| Port | `@scope/port-{name}` | Production implementation, deps injected |

**Rule**: If it emits JavaScript, it doesn't belong in a contract.

For full guidance, invoke: `Skill(coding-patterns)`
