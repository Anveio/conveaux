# Package Setup Pattern

This document defines the canonical patterns for creating packages in this monorepo. **Read this document before creating any new package.**

## When to Consult This Document

- Before creating a new package in `packages/`
- Before modifying package.json exports of an existing package
- Before setting up TypeScript configuration for a package
- When debugging build/import issues

## Package.json Export Pattern

Use conditional exports with source-first development:

```json
{
  "name": "@conveaux/package-name",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "development": "./src/index.ts",
      "source": "./src/index.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "src"],
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit"
  }
}
```

### Export Conditions Explained

| Condition | Purpose | When Used |
|-----------|---------|-----------|
| `types` | TypeScript type resolution | IDE, tsc |
| `development` | Zero-transpilation dev mode | NODE_ENV=development |
| `source` | Direct source access | Tools that support it |
| `import` | ESM production builds | Runtime import |
| `require` | CJS production builds | Runtime require |

### Why Source-First?

1. **Zero transpilation during development**: Changes reflect immediately
2. **Better debugging**: Stack traces point to source, not compiled code
3. **Faster iteration**: No build step needed for dependent packages
4. **Production optimization**: Compiled output still used in production

## TypeScript Configuration Pattern

Each package should extend the shared workspace config:

```json
{
  "extends": "@conveaux/tsconfig/workspace-package-config.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Composite Build Requirements

For proper Turbo caching, the shared config must include:

```json
{
  "compilerOptions": {
    "composite": true,
    "incremental": true,
    "declaration": true,
    "declarationMap": true
  }
}
```

### Turbo Pipeline for TypeScript

In `turbo.json`, include tsbuildinfo in outputs:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "*.tsbuildinfo"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": ["*.tsbuildinfo"]
    }
  }
}
```

## Build Tool Selection

Choose the appropriate build tool based on package complexity:

| Package Type | Recommended Tool | Rationale |
|--------------|------------------|-----------|
| Contract | tsc | No runtime code, declarations only |
| Simple Port | tsc | Single entry point, no bundling needed |
| Complex Application | tsup | Multiple entry points, bundling, tree-shaking |

### When to Use tsc

Use plain TypeScript compiler when:
- Contract packages (interfaces and types only)
- Simple ports with single entry point
- Packages with no external dependencies to bundle
- ESM-only output is sufficient

**tsc package.json:**
```json
{
  "scripts": {
    "build": "tsc"
  }
}
```

**tsc tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

### When to Use tsup

Use tsup when:
- Applications with multiple entry points
- Packages needing both ESM and CJS output
- Packages requiring tree-shaking or minification
- Packages with complex dependency handling

## tsup Configuration Pattern

Create `tsup.config.ts` in each package:

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
```

## Directory Structure

```
packages/package-name/
├── src/
│   └── index.ts          # Main entry point
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md             # Package-specific docs
```

## Checklist Before Creating a Package

- [ ] Package name follows `@conveaux/` namespace
- [ ] package.json has all export conditions (types, development, source, import, require)
- [ ] tsconfig.json extends shared workspace config
- [ ] Composite builds enabled (composite: true, incremental: true)
- [ ] tsup.config.ts creates both ESM and CJS outputs
- [ ] `files` field includes both `dist` and `src`
- [ ] Package registered in root package.json workspaces
- [ ] Package added to turbo.json pipeline if needed

## Common Mistakes

### Mistake 1: Compiled-Only Exports

```json
// WRONG - requires transpilation even in development
"exports": {
  ".": "./dist/index.js"
}
```

### Mistake 2: Missing Source Condition

```json
// WRONG - no source access for tools
"exports": {
  ".": {
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```

### Mistake 3: Not Including src in files

```json
// WRONG - source not published, development condition fails
"files": ["dist"]
```

### Mistake 4: Missing tsbuildinfo in Turbo Outputs

```json
// WRONG - loses incremental build benefits
"outputs": ["dist/**"]
```

## Reference Implementation

See the firedrill workspace at `~/Documents/workspaces/firedrill` for a working example of these patterns.

## Related Lessons

- L-001: Source + Compiled Export Patterns
- L-002: TypeScript Composite Builds for Turbo Caching
