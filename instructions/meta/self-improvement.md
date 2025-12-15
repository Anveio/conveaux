# Self-Improvement Protocol

This document defines when and how to improve the instruction system itself.

## The Meta-Loop

Alongside the development loop (PLAN → IMPLEMENT → VERIFY → DECIDE), run the meta-loop:

```
OBSERVE → PROPOSE → EVALUATE → INTEGRATE
    ^                              |
    +------------------------------+
```

The meta-loop asks: "Are the instructions that guide me adequate for the work I am doing?"

## When to Run the Meta-Loop

### OBSERVE (During Development)

While working on product code, notice:

1. **Gaps**: Instructions don't address the situation
2. **Friction**: Process feels heavier than necessary
3. **Repetition**: Same problem solved multiple times
4. **Contradictions**: Instructions conflict with each other
5. **Staleness**: Instructions reference deprecated patterns

Capture observations in your todo list notes or communicate them to the TSC at session end.

### PROPOSE (At Session Boundaries)

**IP Workflow During Sessions:**

1. **Identify** during work - Note "this should be an IP" in todo list
2. **Draft** at session boundary - Create IP file with problem statement
3. **Complete** in dedicated session - Full implementation + verification

**Rule**: Never block product work to complete an IP. Quick fixes (<5 lines to instructions) can be made inline; larger changes need an IP.

When you identify an improvement opportunity:

1. Create an Improvement Proposal (IP) in `instructions/improvements/proposals/`
2. Set Status: draft
3. Complete all sections of the template
4. Continue with development work (don't block on IP)

### EVALUATE (Before Session End)

IP evaluation happens at session boundaries:

- **Self-evaluation**: Does the IP meet the verification criteria?
- **Human review required if**:
  - Changes affect multiple instruction files
  - Changes contradict existing patterns
  - Uncertainty about value

### INTEGRATE (When Accepted)

When an IP is accepted:

1. Make the changes to instruction files
2. Update `instructions/CHANGELOG.md`
3. If derived from experience, add to `instructions/improvements/lessons.md`
4. Set IP Status: implemented
5. Commit with message: `chore(instructions): {brief description} (IP-{id})`

## Decision Heuristic: Code vs Instructions

### Improve Instructions When

| Trigger | Signal |
|---------|--------|
| **Pattern Recognition** | Same problem solved 3+ times across sessions |
| **Guidance Gap** | Instructions don't address a situation encountered |
| **Friction Point** | Process overhead doesn't justify the benefit |
| **Contradiction** | Two instructions conflict |
| **Stale Context** | Instructions reference deprecated patterns |

The key question: **"Would documenting this help future sessions do better work?"**

### Stay with Code When

- This is a one-off situation
- The problem is specific to this codebase
- Adding instruction overhead exceeds benefit
- You're uncertain if the pattern generalizes

### When NOT to Create an IP

- For trivial typo fixes (just fix them directly)
- For this-session-only tactical changes
- When uncertain the observation generalizes (note it, revisit later)

## Preventing Infinite Meta-Loops

### The Depth Limit

Instructions are stratified by depth:

| Depth | Content | Can Improve Via |
|-------|---------|-----------------|
| 0 | Product code | Development loop |
| 1 | Instructions | IPs (this process) |
| 2 | Meta-instructions (this document) | Human review only |
| 3+ | FORBIDDEN | - |

If you want to improve THIS document, note it in `instructions/improvements/meta-feedback.md` for human review. Do NOT create IPs for meta-instructions.

### The Cooldown Rule

After integrating an IP affecting a file, that file cannot be the target of another IP for at least one full development cycle. This prevents:

- Oscillating changes
- Over-specification
- Premature generalization

### The Evidence Rule

IPs must cite specific evidence:

- Session where problem occurred
- Files or code affected
- Concrete example of the gap/friction

No hypothetical improvements. Only observed problems get proposals.

## Time Allocation

RSID does NOT make instruction improvement the primary activity. Product work remains primary.

**Target allocation**: 90% product work, 10% instruction work

- Observations are collected passively during product work
- IPs are created at session boundaries, not mid-task
- Integration happens only when IPs are accepted

## Session Close Checklist

**CRITICAL**: A task is NOT complete until the PR is merged to main. Creating a PR is not completion.

Before marking work complete:
- [ ] All observations captured in `lessons.md` (or noted for next session)
- [ ] Any identified IPs drafted or deferred with reason
- [ ] No contradictions introduced between instruction files
- [ ] `./verify.sh --ui=false` passes
- [ ] Changes committed and pushed
- [ ] **PR merged to main** (not just created)
- [ ] Main branch verified healthy post-merge

## IP Verification Checklist

Each Improvement Proposal must pass:

- [ ] **Grounded**: Cites specific session and observation
- [ ] **Non-contradictory**: Does not conflict with existing instructions
- [ ] **Actionable**: Proposed change is concrete, not vague
- [ ] **Minimal**: Does not over-specify
- [ ] **Testable**: Compliance can be verified
- [ ] **Bounded**: Affects depth 1 only (not meta-instructions)

## When Lessons Become Instructions

A lesson becomes an instruction when:

1. It recurs 3+ times across different contexts
2. Multiple sessions would benefit
3. It can be expressed as actionable guidance
4. It does not over-constrain

Process:
1. Lesson recorded in `lessons.md`
2. After 3+ similar lessons, create IP to formalize
3. IP proposes instruction addition/update
4. Upon acceptance, instruction updated, lessons marked as "incorporated"

## Anti-Patterns to Avoid

### Over-Specification

**Symptom**: Instructions become so detailed they're harder to follow than the code they describe.

**Prevention**: IPs must pass the "minimal" check.

### Hypothetical Improvement

**Symptom**: "This might be useful someday" IPs without real observations.

**Prevention**: Evidence rule requires specific session and observation.

### Instruction Churn

**Symptom**: Same instruction keeps getting updated back and forth.

**Prevention**: Cooldown rule prevents rapid re-proposals.

### Meta-Loop Dominance

**Symptom**: Agent spends more time on IPs than product work.

**Prevention**: Time allocation guidance (90/10), session-boundary-only creation.

## Quick Reference

```
Observe gap/friction during work
        ↓
Note in todo list or report to TSC
        ↓
At session end: Create IP if pattern generalizes
        ↓
Self-evaluate against checklist
        ↓
If accepted: Integrate, update CHANGELOG, record lesson
        ↓
Continue with next session
```
