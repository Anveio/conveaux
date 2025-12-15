# Package Setup Pattern

This document defines the canonical patterns for creating packages in this monorepo. **Read this document before creating any new package.**

## When to Consult This Document

- Before creating a new package in `packages/`
- Before modifying package.json exports of an existing package
- Before setting up TypeScript configuration for a package
- When debugging import issues

## Core Principle: Source-First Development

**We do not compile TypeScript.** All packages export TypeScript source directly:

- `tsc` is used **only for typechecking** (`noEmit: true`)
- Runtime execution uses `tsx` to run TypeScript directly
- No `dist/` directories, no build step, no transpilation
- Faster iteration, simpler debugging, cleaner codebase

## Package.json Pattern

```json
{
  "name": "@conveaux/package-name",
  "version": "0.1.0",
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "files": ["src"],
  "devDependencies": {
    "@conveaux/tsconfig": "*",
    "typescript": "^5.7.2"
  }
}
```

### Key Points

| Field | Value | Rationale |
|-------|-------|-----------|
| `main` | `src/index.ts` | Direct source, no compilation |
| `types` | `src/index.ts` | Same file for types and implementation |
| `exports.default` | `./src/index.ts` | Single export pointing to source |
| `files` | `["src"]` | Only ship source, no dist |
| No `build` script | - | We don't compile |

## TypeScript Configuration

Each package extends the shared workspace config:

```json
{
  "extends": "@conveaux/tsconfig/workspace-package-config.json",
  "compilerOptions": {
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

The shared config (`@conveaux/tsconfig/workspace-package-config.json`) includes:
- `noEmit: true` - typecheck only, no output
- `composite: true` - for incremental builds
- `strict: true` - full type safety
- `noUncheckedIndexedAccess: true` - array access returns `T | undefined`

### Apps with CLI Entry Points

Apps use `@conveaux/tsconfig/workspace-app-config.json` and run via `tsx`:

```json
{
  "name": "@conveaux/my-app",
  "type": "module",
  "bin": {
    "my-app": "./src/cli.ts"
  },
  "scripts": {
    "start": "tsx src/cli.ts",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@conveaux/tsconfig": "*",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

## Turbo Pipeline

Since we don't build, the pipeline is simpler:

```json
{
  "tasks": {
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    }
  }
}
```

## Directory Structure

```
packages/package-name/
├── src/
│   ├── index.ts          # Main entry point
│   └── index.test.ts     # Tests (if applicable)
├── package.json
└── tsconfig.json
```

No `dist/`, no `tsup.config.ts`, no build artifacts.

## Checklist Before Creating a Package

- [ ] Package name follows `@conveaux/` namespace
- [ ] `main` and `types` point to `src/index.ts`
- [ ] `exports` has single `default` pointing to source
- [ ] tsconfig.json extends `@conveaux/tsconfig/workspace-package-config.json`
- [ ] `@conveaux/tsconfig` added as devDependency
- [ ] `files` only includes `src` (no dist)
- [ ] No `build` script (only `typecheck`)

## Package Types

| Type | Config | Dependencies |
|------|--------|--------------|
| Contract | `workspace-package-config.json` | None (pure types) |
| Port | `workspace-package-config.json` | Contracts + vitest |
| App | `workspace-app-config.json` | Packages + tsx |

## Common Mistakes

### Mistake 1: Adding a build script

```json
// WRONG - we don't build
"scripts": {
  "build": "tsc"
}
```

### Mistake 2: Pointing to dist

```json
// WRONG - no dist directory exists
"main": "dist/index.js",
"exports": {
  ".": "./dist/index.js"
}
```

### Mistake 3: Running node on TypeScript

```bash
# WRONG - node can't run .ts files
node src/cli.ts

# RIGHT - use tsx
tsx src/cli.ts
```

### Mistake 4: Forgetting noUncheckedIndexedAccess

The tsconfig has `noUncheckedIndexedAccess: true`, so array access returns `T | undefined`:

```typescript
// This won't compile:
const first = items[0]; // Type: T | undefined
first.method(); // Error: Object is possibly 'undefined'

// Fix with explicit check:
const first = items[0];
if (first !== undefined) {
  first.method(); // OK
}

// Or with assertion when you know it's safe:
const first = items[0] as T; // Use sparingly, with comment explaining why
```

## Related Lessons

- L-001: Source + Compiled Export Patterns (now superseded by pure source-first)
- L-004: Build Tool Selection - tsc vs tsup (now: neither, just typecheck)
