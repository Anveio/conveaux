# Architecture Guidance

This document provides architectural patterns for building maintainable software.

## Required Reading Before Architectural Decisions

| Decision | Required Reading |
|----------|------------------|
| Creating a new package | `patterns/package-setup.md` |
| Using time, logging, or randomness | `patterns/core-ports.md` |
| Accessing environment variables | `patterns/core-ports.md` |
| Modifying package.json exports | `patterns/package-setup.md` |

**Stop and read the relevant pattern document before proceeding.** These patterns encode institutional knowledge that prevents common mistakes.

## Hexagonal Architecture (Ports & Adapters)

### Core Principle

Domain logic in the middle, I/O at the edges.

```
        ┌─────────────────────────────────────┐
        │           Adapters (I/O)            │
        │  ┌─────────────────────────────┐    │
        │  │       Domain Logic          │    │
        │  │  ┌───────────────────┐      │    │
        │  │  │    Contracts      │      │    │
        │  │  │   (Types/Ports)   │      │    │
        │  │  └───────────────────┘      │    │
        │  └─────────────────────────────┘    │
        └─────────────────────────────────────┘
```

### Dependency Direction

Dependencies point inward:
- Adapters depend on Domain
- Domain depends on Contracts
- Contracts depend on nothing

Never:
- Domain depending on Adapters
- Contracts depending on anything

### Contracts Package

The contracts package is the single source of truth:
- Pure types (no runtime code)
- Port interfaces
- Shared domain types

Rules:
- No imports from other packages
- No constants or functions
- Changes affect many packages (high impact)

## No Globals

All dependencies are injected. Nothing reads from:
- `globalThis`
- `process.env` directly
- `Date.now()` directly
- `Math.random()` directly
- `console` directly

Instead:
- Inject configuration
- Inject clock/random ports
- Inject logger ports

This enables:
- Testing with fakes
- Cross-platform compatibility
- Deterministic behavior

## Package Layering

```
apps/           # Entrypoints (CLI, servers)
  cli/          # Can depend on anything

packages/       # Reusable logic
  contracts/    # Types and ports (no deps)
  core-domain/  # Business logic (depends on contracts)
  adapter-*/    # I/O implementations (depends on contracts)
```

Rules:
- Apps can depend on packages
- Packages never depend on apps
- Adapters depend on contracts, not vice versa

## Module Boundaries

Each package has:
- Clear public API (index.ts exports)
- Internal implementation (not exported)
- Explicit dependencies (package.json)

Don't:
- Reach into another package's internals
- Import from paths not in public API
- Create circular dependencies

## Data Model

### Entity Ownership

Each entity has one owning module:
- Only the owner creates/modifies
- Others request changes through ports
- Clear responsibility boundaries

### Value Objects

Prefer immutable value objects:
- No setters
- Create new instances for changes
- Equality by value, not reference

## Testing Implications

Architecture enables testing:
- Domain logic testable without I/O
- Inject fakes for ports
- Fast, deterministic unit tests
- Adapters tested separately with real I/O

## Quick Reference

| Layer | Depends On | Contains |
|-------|------------|----------|
| Apps | Everything | Entrypoints, wiring |
| Adapters | Contracts | I/O implementations |
| Domain | Contracts | Business logic |
| Contracts | Nothing | Types, ports |
