---
name: rsid
description: Recursive Self-Improvement Design pattern with concentric loops. Use after merging code to reflect, record memories, and generate next improvement. Invoke automatically post-merge or when consolidating learnings into skills.
---

# RSID: Recursive Self-Improvement Design

**Each iteration leaves the system better than before.**

## The Concentric Loop Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LOOP 0: POST-MERGE REFLECTION (automatic, after every merge)            │
│                                                                         │
│   Inputs: Session history, errors encountered, corrections made         │
│   Process:                                                              │
│     1. Review what was learned during the task                          │
│     2. Write memories to memory.yaml (task, context, learnings)         │
│     3. Identify improvement candidates for next iteration               │
│   Outputs: Updated memory.yaml + improvement candidates                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ LOOP 1: IDEA GENERATION (autonomous, fed by reflection)                 │
│                                                                         │
│   Inputs: memory.yaml, existing skills, patterns that recur             │
│   Process:                                                              │
│     1. Scan memory.yaml for patterns (3+ similar learnings)             │
│     2. Prioritize improvement candidates by impact                      │
│     3. If skill update needed: Consolidate memories → update skill      │
│     4. If code change needed: Define implementation scope               │
│   Outputs: Next task definition OR skill update                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ LOOP 2: EXECUTION (plan-writing + coding-patterns apply here)           │
│                                                                         │
│   PLAN → IMPLEMENT → VERIFY → DECIDE → MERGE                            │
│                                                                         │
│   Skills that apply:                                                    │
│   - plan-writing: Rigorous plans for distinguished engineer audience    │
│   - coding-patterns: Hexagonal architecture, contracts, ports           │
│   - verification-pipeline: ./verify.sh gates                            │
│   - effective-git: Atomic commits, PR discipline                        │
│   - tsc-reviewer (agent): Review before merge                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
                          (back to LOOP 0 after merge)
```

## Loop 0: Post-Merge Reflection

**Trigger**: Automatic after every successful merge to main.

**Purpose**: Capture what was learned before context is lost.

### What to Capture

| Type | When to Record | Example |
|------|---------------|---------|
| `command-correction` | A command/approach failed and you found the fix | Heredocs fail in sandbox |
| `q-and-a` | A question was asked and answered | Where do skills live? |
| `misconception` | A belief was corrected | PR creation ≠ task completion |
| `pattern` | A reusable pattern worth remembering | Data contracts have no methods |
| `insight` | A non-obvious realization | Sandbox restricts temp file creation |

### Reflection Checklist

After every merge, before declaring task complete:

- [ ] What commands/approaches failed? Record corrections
- [ ] What questions came up? Record Q&A pairs
- [ ] What did I believe that turned out wrong? Record misconceptions
- [ ] What patterns did I discover or apply? Record patterns
- [ ] What non-obvious things did I learn? Record insights

### Writing to memory.yaml

Append a new entry to `instructions/improvements/memory.yaml`:

```yaml
memories:
  - task: "your-task-name"  # Branch name or feature name
    date: "YYYY-MM-DD"
    context: |
      Brief description of what you were doing and why it matters.
      Include enough context that future sessions can understand.
    learnings:
      - type: "command-correction"
        summary: "One-line summary for scanning"
        detail: |
          Full explanation with examples.
          What failed, why, and what works instead.
```

### Spawning memory-processor

After recording learnings to memory.yaml, spawn the memory-processor agent:

> "Use the memory-processor agent to process memory.yaml"

The agent will:
1. Analyze memories with skeptical lens (reject short-sighted learnings)
2. Create a PR with proposed skill/settings changes
3. Spawn tsc-reviewer for approval
4. Archive all processed memories (clearing memory.yaml)
5. Only merge after TSC approval

**Important:** Do NOT manually commit memory.yaml if spawning the agent. Let the agent
handle the full commit including archival. The agent ensures all processed memories
are moved to memory-archive.yaml.

## Loop 1: Idea Generation

**Trigger**: After Loop 0 completes, or explicitly when reviewing memory.yaml.

**Purpose**: Turn accumulated learnings into actionable improvements.

**Key Skill**: Invoke **memory-consolidation** for detailed consolidation guidance.

### Pattern Detection

Scan memory.yaml for recurring themes:

1. **3+ similar learnings** → Candidate for skill update
2. **Cross-cutting concerns** → May need new skill
3. **Friction points** → Process improvements

### Prioritization Criteria

| Priority | Criteria |
|----------|----------|
| **High** | Same mistake made 3+ times across tasks |
| **High** | Blocks or significantly slows future work |
| **Medium** | Improves clarity but not blocking |
| **Low** | Nice-to-have, single occurrence |

### Consolidation Process

When patterns reach threshold:

1. Group related memories by domain
2. Extract the generalized pattern
3. Update the relevant skill with new guidance
4. Move consolidated memories to `memory-archive.yaml` with consolidation date

```yaml
# memory-archive.yaml
archived:
  - consolidated_date: "2024-12-15"
    consolidated_into: "coding-patterns"
    memories:
      - task: "contract-port-architecture"
        # ... original memory entry
```

## Loop 2: Execution

**Trigger**: When Loop 1 produces a task definition.

**Purpose**: Implement the improvement with full rigor.

### Skills That Apply

| Skill | When It Applies |
|-------|-----------------|
| **plan-writing** | Always—rigorous plans for distinguished engineers |
| **coding-patterns** | When writing TypeScript, contracts, ports |
| **verification-pipeline** | Always—./verify.sh must pass |
| **effective-git** | Always—atomic commits, PR discipline |
| **tsc-reviewer** (agent) | Always—review before merge |

### Execution Flow

```
1. Plan the implementation (invoke plan-writing)
2. Implement with patterns (invoke coding-patterns if applicable)
3. Verify (./verify.sh --ui=false)
4. Create PR with atomic commits (invoke effective-git)
5. Review (spawn tsc-reviewer agent)
6. Merge to main
7. → Loop 0 (reflection)
```

## Memory Schema

### File Location

```
instructions/improvements/
├── memory.yaml          # Active memories
└── memory-archive.yaml  # Consolidated memories
```

### Entry Structure

```yaml
memories:
  - task: string          # Required: Task identifier (branch/feature name)
    date: string          # Required: YYYY-MM-DD
    context: string       # Required: Background and why it matters
    learnings:            # Required: Array of learnings
      - type: string      # Required: command-correction|q-and-a|misconception|pattern|insight
        summary: string   # Required: One-line for scanning
        detail: string    # Required: Full explanation with examples
```

### Memory Types

| Type | Description | Example Summary |
|------|-------------|-----------------|
| `command-correction` | Command failed, found fix | "Heredocs fail in sandbox" |
| `q-and-a` | Question answered durably | "Where skills are stored" |
| `misconception` | Belief corrected | "PR creation ≠ completion" |
| `pattern` | Reusable pattern | "Data contracts have no methods" |
| `insight` | Non-obvious realization | "Sandbox restricts /tmp writes" |

## Integration with Other Skills

### RSID is the Outer Context

```
RSID (this skill)
├── memory-consolidation (Loop 1: pattern detection and skill updates)
└── plan-writing (Loop 2: rigorous plans)
    └── coding-loop (execution coordination)
        └── coding-patterns (architectural guidance)
            └── effective-git (commit discipline)
                └── tsc-reviewer (pre-merge verification)
```

### When to Invoke Each

| Situation | Invoke |
|-----------|--------|
| After merge to main | **rsid** (this skill) for reflection |
| Patterns recurring 3+ times | **memory-consolidation** for skill updates |
| Starting new implementation | **plan-writing** for rigorous planning |
| During execution | **coding-loop** for gates and verification |
| Writing TypeScript code | **coding-patterns** for architecture |
| Before committing | **effective-git** for commit discipline |
| Before merging PR | **tsc-reviewer** (agent) for verification |

## Anti-Patterns

### Skipping Reflection

**Wrong:** Merge and move on without recording learnings.

**Right:** Every merge triggers Loop 0. Memories are the fuel for improvement.

### Memory Without Consolidation

**Wrong:** memory.yaml grows indefinitely without updating skills.

**Right:** When patterns recur 3+ times, consolidate into skills.

### Reflection Without Action

**Wrong:** Record memories but never generate tasks from them.

**Right:** Loop 1 scans memory and produces actionable improvements.

### Breaking the Loop

**Wrong:** Do Loop 2 (execution) without Loop 0 (reflection) afterward.

**Right:** Every merge feeds back into reflection. The loop is continuous.

## Quick Reference

### Post-Merge Checklist

```
[ ] Review session for learnings
[ ] Append to memory.yaml with task, date, context, learnings
[ ] Spawn memory-processor agent to process and archive memories
[ ] Agent creates PR → tsc-reviewer approves → merge
```

### Memory Entry Template

```yaml
- task: "feature-name"
  date: "2024-12-15"
  context: |
    What were you doing and why does it matter?
  learnings:
    - type: "misconception"
      summary: "What I thought vs reality"
      detail: |
        WRONG: What I believed
        RIGHT: What's actually true
        Evidence: How I discovered this
```

## The Invariant

**Every session should leave the system better than it found it.**

This means:
- Code improvements merged
- Learnings recorded in memory.yaml
- Patterns consolidated into skills when threshold reached
- Next improvement identified

The loop never stops. Each iteration compounds.
