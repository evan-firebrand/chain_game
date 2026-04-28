# Merge Game Tooling Journal

**Status:** Living document — process record for tooling design
**Audience:** Designer (Evan), future-self auditing decisions
**Use case:** "Why did we choose X for the tools?" / "What did we consider and reject?" / "What should I revisit?"
**Updates:** Each time a tooling design decision is discussed
**Last updated:** Phase 0 complete; Phase 1 in progress

**Companion documents:**
- *Game Design Concepts & Frameworks* — Part B (Sections 17-25) is the vocabulary
- *Merge Game Tooling Specification* — current settled state of the tooling design
- *Merge Game Specification* and *Merge Game Design Journal* — the game project these tools serve

---

## How to use this document

This is the **process record** for tooling design — the meeting minutes of tooling design conversations. It contains:

- **Phase-by-phase narrative** of decisions made for the tooling, including alternatives considered
- **The tooling audit** against tool-design criteria (when complete)
- **Soft commitments** with revisit triggers
- **Things rejected** and why
- **Things deferred** with notes on when to revisit
- **Things to verify in tooling playtest**

When auditing a past decision: find the relevant Phase/Step in the narrative, see the alternatives we considered and the rationale, then decide whether new information changes the answer. If you change a decision, update the *Tooling Specification* and add a note here explaining what changed and why.

---

## Process framing

Same shape as the game design process:

1. Identify the open decision
2. State happy-path assumptions / defaults
3. Surface candidate options
4. Apply criteria + analysis
5. Pick (or defer with explicit reasoning)
6. Note what we'd revisit and under what conditions

Soft commitments — ideas as working assumptions we proceed under, flag as revisitable, and revisit when new info arrives.

---

## Phase 0 — Tooling concepts (COMPLETED)

Captured nine concept sections (17-25) in the Concepts document covering:

- The role of internal tools in game design
- Tool archetypes (designer's microscope, team's dashboard, QA's stress rig, researcher's instrument, public playground)
- Single source of truth (the load-bearing tooling principle)
- Instrumentation principles
- Parameter exposition (Tier 1/2/3)
- Simulation harness patterns (strategies, runners, analyzers)
- Failure modes specific to tooling
- The "build less, build well" discipline
- Forward and inverse modes (with three approaches to inverse)

Key load-bearing concepts identified:
- **Section 19 (single source of truth)** — most important architectural decision
- **Section 21 (parameter exposition tiers)** — load-bearing for tuning console design
- **Section 25 (forward/inverse unified data model)** — affects Stage B/E architecture from day one
- **Section 23 (failure modes)** — keep visible during build

Decisions made during Phase 0:

- **Tooling will be three tools, not one:** Tuning Console (Stage A), Sim Harness (Stage B), Design Intent Solver (Stage E)
- **Single user (Evan) for v1**, with playtester and researcher modes deferred
- **Stages C (replay) and D (sandbox) deferred** — not part of current scope
- **Architecture: shared pure-logic module** between playable game and all tools (single source of truth)
- **Sim harness data model designed for inverse querying from day one** (insight from Section 25)

## Phase 1 — Pin down enough to build (IN PROGRESS)

Planned steps:

- 1.1 Tool architecture decisions (how does tool relate to game? embedded vs separate? single app vs multiple?)
- 1.2 Parameter exposition — which parameters are Tier 1 / Tier 2 / Tier 3?
- 1.3 Tuning Console design (Stage A specifics)
- 1.4 Simulation Harness design (Stage B specifics)
- 1.5 Design Intent Solver design (Stage E specifics)
- 1.6 Audit against tool design criteria

*(To be populated as decisions are made.)*

## Phase 2 — Build (DEFERRED until Phase 1 complete)

Will integrate with the game v1 prototype build path. Specific build sequencing TBD in Phase 1.

---

# AUDIT AND REVISIT NOTES

This section captures the *living watchlist* — soft commitments with revisit triggers, things considered and rejected, things deliberately deferred. Update as decisions are made or revisited.

## Decisions explicitly held as soft commitments

| Decision | Revisit if |
|---|---|
| Three tools (A, B, E) — not C or D | Need to reproduce specific board states (would suggest C); start designing Levels content (would suggest D) |
| Designer-only v1 | Want playtester feedback before mechanic is settled (would add playtester variant) |
| Approach 1 (sweep + filter) for inverse mode | Sweep proves too slow; parameter space proves too large |

## Things considered and rejected

| Rejected | Why |
|---|---|
| Building all five stages (A-E) at once | Procrastination trap; tools should answer specific questions, not preempt |
| Tools and game in separate codebases | Simulation drift risk too high; single source of truth is non-negotiable |
| Surrogate models / Bayesian optimization for inverse mode | Approach 1 should suffice for our scale; reserve as upgrade path |

## Things deliberately deferred (with notes on when to revisit)

| Deferred | When to revisit |
|---|---|
| Stage C (replay / session recording) | When first non-Evan playtester arrives (v2+) |
| Stage D (sandbox / state setup) | When designing Levels content (v3+) |
| Public-facing tool variant | If/when there's an audience beyond Evan |
| AI / LLM-based player strategies | If heuristic strategies prove inadequate |
| Real-time telemetry dashboard | After single-config sim runner exists |

## Things to verify in tooling validation

*(To be populated during Phase 1 and 2.)*

## Things explicitly NOT in scope yet

- Tool monetization or distribution — this is internal infrastructure
- Multi-user / collaborative features — single user only
- Cloud / hosted versions — runs in browser locally
- Authentication / security model — not a public tool

---

*End of Tooling Journal. Companion to the Tooling Specification.*
