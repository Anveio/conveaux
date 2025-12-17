---
description: Run lint check with optional scope
---
Run lint check using Biome.

**With scope (package name):**
If $ARGUMENTS is provided, lint only that package:
```
npx biome lint packages/$ARGUMENTS/src --write
```

**Without scope (full repo):**
If no arguments, lint the entire repository:
```
npm run lint:check
```

**On failure:**
1. Count total errors
2. Group errors by rule (e.g., `noExplicitAny`, `useConst`)
3. Show first 3 errors per rule
4. Suggest: "Run `/lint-and-learn` to auto-fix and extract lessons"

**On success:**
Report "Lint passed" with files checked count.

**Example usage:**
- `/verify-lint` - Lint entire repo
- `/verify-lint port-logger` - Lint only port-logger package
- `/verify-lint contract-result` - Lint only contract-result package
