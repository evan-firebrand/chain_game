# Merge Game Tooling Specification

**Status:** Living document — current state of the tooling design
**Audience:** Designer (Evan), engineering collaborators
**Use case:** "What do the tools do? What should I build?"
**Updates:** Every time a tooling decision is settled or revised
**Last updated:** Phase 0 complete (concepts captured); Phase 1 in progress

**Companion documents:**
- *Game Design Concepts & Frameworks* — Part B (Sections 17-25) covers tooling concepts referenced here
- *Merge Game Tooling Journal* — full decision log and audit notes for these tooling decisions
- *Merge Game Specification* — the game design these tools support

---

## How to use this document

This is the **current contract** for what the tooling does. It contains only what's true *right now* — no historical baggage, no rejected alternatives, no narrative. When you need to know what to build, read this. When something gets settled or revised, this updates.

If you need to know *why* something is the way it is, see the **Tooling Journal** for the decision narrative and audit notes.

If you need to know what a term means (forward/inverse mode, tier exposition, simulation harness patterns, etc.), see the **Concepts** document — Part B.

---

## Project overview

The tooling project supports the merge game's design and tuning work. It's a set of three related tools sharing common infrastructure (the pure-logic game module from Section 19).

**Primary user (v1):** Designer (Evan)
**Future users:** Playtesters, researcher-self for batch experiments
**Target platform:** Web (same browser environment as the game)
**Architecture model:** Single source of truth — pure game logic shared between playable game, tuning console, and simulation harness

## Tool roster

| Tool | Stage | Mode | Status |
|---|---|---|---|
| **Tuning Console** | A | Forward, live | **Hero tool** — design first, build alongside game v1 |
| **Simulation Harness** | B | Forward, batch | Built after game v1 fun-validated |
| **Design Intent Solver** | E | Inverse, structured query | Built on top of Stage B; data model designed to support this from start |

Stages C (replay) and D (sandbox) deliberately deferred — not part of current scope.

For full rationale, see *Tooling Journal*.

---

## Settled decisions

*(To be populated during Phase 1.)*

## Open decisions

*(To be populated during Phase 1.)*

## Deferred to later phases

*(To be populated during Phase 1.)*

---

*End of Tooling Specification. For decision rationale, audit notes, and revisit triggers, see the Tooling Journal.*
