# Session Briefs

Per-agent task context files. Every agent session starts by reading the relevant brief from this directory.

**Naming:** `YYYY-MM-DD-[role]-[task].md`

**Created by:** Architecture Agent or the previous agent handing off work.

**Template:**

```markdown
# Session Brief: [Role] — [Task]
**Date:** YYYY-MM-DD
**Agent role:** [Architecture | Game Logic | UI | Test | Simulation | Design]
**Assigned by:** [Evan or agent role]

## Context
[What phase are we in? What was the last completed work?]

## Task
[Precise description of what to build/write/fix]

## Acceptance criteria
1. [Verifiable criterion]
2. [Verifiable criterion]

## Files to read first (ordered)
1. CLAUDE.md
2. [Most relevant spec or interface doc]
3. [Other files]

## Files to write/modify
- [Expected outputs]

## Do NOT
- [Explicit out-of-scope list]

## Open questions to file if encountered
- [Known spec gaps for this task]
```
