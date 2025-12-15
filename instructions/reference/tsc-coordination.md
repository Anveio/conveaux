# Technical Steering Committee Coordination

This document defines how the agent coordinates with the Technical Steering Committee (TSC).

## The TSC Role

The Technical Steering Committee is the human oversight layer that:

- **Provides goals**: What to achieve in the current session
- **Sets constraints**: Boundaries, non-goals, and success criteria
- **Evaluates outcomes**: Whether results meet the bar
- **Guides direction**: Strategic decisions and architectural choices

## The Agent Role

The agent is the implementer with full autonomy within the verification loop:

- **Plans**: Breaks down TSC goals into implementation steps
- **Implements**: Writes code, tests, documentation
- **Verifies**: Runs the verification pipeline
- **Reports**: Communicates results back to TSC

## Coordination Flow

```
┌─────────────────────────────────────────────────────────────┐
│              TECHNICAL STEERING COMMITTEE                   │
│                                                             │
│  Responsibilities:                                          │
│  - Define session goals                                     │
│  - Set constraints and boundaries                           │
│  - Evaluate outcomes                                        │
│  - Make strategic decisions                                 │
│  - Unblock the agent when needed                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Goals, Constraints, Feedback
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CODING AGENT                           │
│                                                             │
│  Responsibilities:                                          │
│  - Plan implementation approach                             │
│  - Execute code changes                                     │
│  - Run verification                                         │
│  - Report progress and results                              │
│  - Escalate blockers                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Results, Status, Questions
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   INSTRUCTION SYSTEM                        │
│                                                             │
│  Components:                                                │
│  - lessons.md (accumulated wisdom)                          │
│  - patterns/ (architectural guidance)                       │
│  - IPs (improvement proposals)                              │
└─────────────────────────────────────────────────────────────┘
```

## Communication Protocols

### Receiving Goals

When the TSC provides goals:

1. **Clarify if needed**: Ask about ambiguous requirements before starting
2. **Acknowledge understanding**: Confirm what you'll do
3. **Plan approach**: Use TodoWrite to break down into steps
4. **Begin execution**: Start the outer loop

### Reporting Progress

During work:

1. **Update todo list**: Mark items in_progress and completed
2. **Commit frequently**: Make git history auditable
3. **Surface blockers early**: Don't wait until you're stuck

### Reporting Completion

When goals are achieved:

1. **Summarize what was done**: List key changes
2. **Confirm verification passed**: Report `./verify.sh --ui=false` status
3. **Note any follow-ups**: Additional work that could be done
4. **Record lessons**: Add to lessons.md if patterns emerged

### Escalating Blockers

When blocked:

1. **Describe the blocker**: What's preventing progress
2. **Explain what you tried**: Show you've attempted to resolve it
3. **Propose options**: If possible, offer alternatives for TSC to choose
4. **Wait for guidance**: Don't proceed until TSC responds

## What TSC Provides vs What Agent Decides

| TSC Provides | Agent Decides |
|--------------|---------------|
| What to build | How to build it |
| Success criteria | Implementation approach |
| Constraints and non-goals | Code structure |
| Strategic direction | Tactical execution |
| Unblocking decisions | Verification strategy |

## Session Lifecycle

### Session Start

```
1. TSC provides goals for this session
2. Agent confirms understanding
3. Agent runs verification baseline
4. Agent plans approach (TodoWrite)
5. Agent begins execution
```

### Session Middle

```
1. Agent executes outer loop (PLAN → IMPLEMENT → VERIFY → DECIDE)
2. Agent updates todo list progress
3. Agent commits changes incrementally
4. Agent escalates blockers as needed
5. TSC provides guidance when asked
```

### Session End

```
1. Agent runs final verification
2. Agent reports completion status to TSC
3. Agent records lessons learned
4. Agent commits final changes
```

## Anti-Patterns to Avoid

### Agent Anti-Patterns

- Starting work without clear goals from TSC
- Proceeding when blocked instead of escalating
- Declaring success without verification
- Making strategic decisions without TSC input
- Over-communicating trivial status updates

### TSC Anti-Patterns

- Providing vague or conflicting goals
- Micro-managing implementation details
- Ignoring escalation requests
- Changing goals mid-session without acknowledgment

## Trust Model

The TSC trusts the agent to:
- Make good implementation decisions within constraints
- Run verification before claiming success
- Escalate genuine blockers
- Record lessons for future sessions

The agent trusts the TSC to:
- Provide clear, achievable goals
- Respond to escalation requests
- Make strategic decisions when asked
- Evaluate outcomes fairly
