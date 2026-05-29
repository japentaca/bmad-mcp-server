# BMAD Party-Mode Workflow

Multi-agent collaborative brainstorming. Invoke multiple BMAD agents simultaneously to tackle a problem from different angles. Each agent contributes their unique perspective, then findings are synthesized.

## How Party Mode Works

Instead of talking to one agent at a time, you load multiple agent personas and ask them to collaborate on a problem. The agents take turns contributing, building on each other's ideas.

## When to Use

- **Project kickoff**: All perspectives on a new product idea
- **Architecture decision**: PM + Architect + Dev weigh in
- **Stuck on a problem**: Fresh eyes from different disciplines
- **Pre-mortem**: Find what could go wrong before building
- **Feature brainstorm**: UX + PM + Analyst explore possibilities

## Party Configurations

### Full Party (All Agents)
```
Read vendor/bmad/pm.md
Read vendor/bmad/architect.md
Read vendor/bmad/dev.md
Read vendor/bmad/tea.md
Read vendor/bmad/analyst.md
Read vendor/bmad/ux-designer.md
Read vendor/bmad/debug.md
Read vendor/bmad/sm.md
Read vendor/bmad/reviewer.md
```

### Planning Party (Scope + Design)
```
PM + Architect + UX-Designer + Analyst
```

### Problem-Solving Party (Debug + Fix)
```
Debug + Dev + Tea + Reviewer
```

### Creative Party (Ideation)
```
Analyst + UX-Designer + PM + Architect
```

## Party Protocol

### 1. Define the Question
Start with a clear, focused prompt. Don't ask "what should we build?" — ask "given our target users are small business owners, what are their top 3 unmet needs in managing inventory?"

### 2. Load the Agents
Read each agent's persona file before starting. Load them all into context.

### 3. Round 1: Individual Perspectives
Ask each agent to contribute their perspective on the problem. Don't let them debate yet — just gather viewpoints.

Example:
```
PM: What outcomes should this feature deliver?
Architect: What technical constraints should we consider?
UX: What does the user's mental model look like?
Analyst: What does the market data suggest?
```

### 4. Round 2: Cross-Pollination
Ask agents to respond to each other's contributions. The dev pushes back on the architect. The PM pushes back on scope. The reviewer finds gaps.

### 5. Synthesis
After rounds of discussion, ask the PM to synthesize the findings into a structured output:
- What we decided
- What we rejected and why
- Open questions
- Next steps

## Output Template

```markdown
# Party Mode Session: [Topic]

## Participants
- [Agent 1]: [perspective contributed]
- [Agent 2]: [perspective contributed]

## Key Insights
### From PM
[Key points]

### From Architect
[Key points]

### From UX-Designer
[Key points]

## Decisions
- **Decision 1**: [What and why]
- **Decision 2**: [What and why]

## Rejected Ideas
- **Idea 1**: [Why rejected]

## Open Questions
- [Question 1]
- [Question 2]

## Next Steps
1. [Action item] → Owner: [agent or person], By: [date]
2. [Action item] → Owner: [agent or person], By: [date]
```

## Rules
- Every agent must contribute — no silent observers
- Disagree constructively — critique the idea, not the person
- The PM has final say on scope decisions
- The Architect has final say on technical decisions
- Time-box the session: 3-5 rounds max, then synthesize
