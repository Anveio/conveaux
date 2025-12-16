---
name: rsid
description: Recursive Self-Improvement Design pattern. Two modes - user-driven (Listen→Execute→Reflect) and autonomous (Ideate→Execute→Reflect). Invoke after merging to reflect, or when consolidating learnings into skills.
---

# RSID: Recursive Self-Improvement Design

**Each iteration leaves the system better than before.**

## The Two-Mode Cycle

```
USER-DRIVEN MODE:
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   LISTEN ──────► EXECUTE ──────► REFLECT                             │
│   (receive        (plan,          (capture                           │
│    task)          implement,       learnings)                        │
│                   verify,                                            │
│                   merge)                                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼ (patterns accumulate)
AUTONOMOUS MODE:
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   ┌──► IDEATE ──────► EXECUTE ──────► REFLECT ───┐                   │
│   │    (generate       (implement      (capture   │                   │
│   │     next task       improvement)    learnings)│                   │
│   │     from patterns)                            │                   │
│   └───────────────────────────────────────────────┘                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## The Four Stages

| Stage | Trigger | Purpose |
|-------|---------|---------|
| **Listen** | User provides task | Receive and understand instructions |
| **Execute** | Task defined | Plan, implement, verify, merge |
| **Reflect** | After merge | Capture learnings to memory.yaml |
| **Ideate** | Patterns recur 3+ times | Generate next improvement task |

---

## Listen

**Trigger**: User provides a task.

**Purpose**: Understand what needs to be done before acting.

This is the entry point for user-driven work. Skills that apply:
- Read the task carefully
- Ask clarifying questions if needed
- Invoke **plan-writing** if non-trivial

---

## Execute

**Trigger**: Task is defined (from Listen or Ideate).

**Purpose**: Implement with full rigor.

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
7. → Reflect
```

---

## Reflect

**Trigger**: After every successful merge to main.

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

**Important:** Do NOT manually commit memory.yaml if spawning the agent. Let the agent handle the full commit including archival.

---

## Ideate

**Trigger**: After Reflect, when patterns accumulate (3+ similar learnings).

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

### Output

Ideate produces one of:
- **Skill update** → Execute the update, then Reflect
- **Code change** → Execute the implementation, then Reflect
- **Nothing** → Wait for more patterns to accumulate

---

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

---

## Integration with Other Skills

### RSID is the Outer Context

```
RSID (this skill)
├── memory-consolidation (Ideate: pattern detection and skill updates)
└── plan-writing (Execute: rigorous plans)
    └── coding-loop (execution coordination)
        └── coding-patterns (architectural guidance)
            └── effective-git (commit discipline)
                └── tsc-reviewer (pre-merge verification)
```

### When to Invoke Each

| Situation | Invoke |
|-----------|--------|
| After merge to main | **rsid** (this skill) for Reflect |
| Patterns recurring 3+ times | **memory-consolidation** for Ideate |
| Starting new implementation | **plan-writing** for Execute planning |
| During implementation | **coding-loop** for gates and verification |
| Writing TypeScript code | **coding-patterns** for architecture |
| Before committing | **effective-git** for commit discipline |
| Before merging PR | **tsc-reviewer** (agent) for verification |

---

## Anti-Patterns

### Skipping Reflect

**Wrong:** Merge and move on without recording learnings.

**Right:** Every merge triggers Reflect. Memories fuel improvement.

### Memory Without Ideate

**Wrong:** memory.yaml grows indefinitely without generating tasks.

**Right:** When patterns recur 3+ times, Ideate generates the next improvement.

### Reflect Without Action

**Wrong:** Record memories but never Ideate from them.

**Right:** Ideate scans memory and produces actionable improvements.

### Breaking the Cycle

**Wrong:** Execute without Reflect afterward.

**Right:** Every merge feeds back into Reflect. The cycle is continuous.

---

## Quick Reference

### Post-Merge Checklist (Reflect)

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

---

## The Invariant

**Every session should leave the system better than it found it.**

This means:
- Code improvements merged
- Learnings recorded in memory.yaml
- Patterns consolidated into skills when threshold reached
- Next improvement identified

The cycle never stops. Each iteration compounds.
