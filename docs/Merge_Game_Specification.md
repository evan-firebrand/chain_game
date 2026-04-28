# Merge Game Specification

**Status:** Living document — current state of the design
**Audience:** Designer (Evan), engineering collaborators, future builders
**Use case:** "What does the game do? What should I build?"
**Updates:** Every time a decision is settled or revised
**Last updated:** Phase 1 complete — kernel audit passed

**Companion documents:**
- *Game Design Concepts & Frameworks* — vocabulary and frameworks referenced below
- *Merge Game Design Journal* — full decision log and audit notes for this spec

---

## How to use this document

This is the **current contract** for what the game is. It contains only what's true *right now* — no historical baggage, no rejected alternatives, no narrative. When you need to know what to build, read this. When something gets settled or revised, this updates.

If you need to know *why* something is the way it is, see the **Design Journal** for the decision narrative and audit notes.

If you need to know what a term means (kernel, knob, archetype, six pillars, etc.), see the **Concepts** document.

---

## Project overview

The merge game is a 2D number-merging puzzle in the casual puzzle genre, designed as a **multi-mode** game with a shared kernel and mode-specific knobs. It blends three established merge-game lineages (Threes!, 2048, Drop7) into a chain-based mechanic with two extension rules (same-value or doubled-adjacent) and a result rule that rewards both chain length and tier-climbing.

**Working title:** TBD (project codename: "merge game")
**Target platform:** Web (mobile-first portrait orientation), final platform open
**Optimization target:** Affection and mastery satisfaction — not engagement metrics

---

## Mode roster

| Mode | Archetype | Status |
|---|---|---|
| **Endless** | Cult favorite | **Hero mode** — design first, polish first. v1 of all builds. |
| **Levels** | Mass casual | Deferred to v3+; Layer 2/3 content design required |
| **Ascension** | Hardcore mastery | Deferred to v4+; modifier system to design |
| **Drift** | Cozy / chill | Deferred to v5+; soft-pacing parameters to define |

For v1 prototype: only **Endless** is built.

---

## Settled kernel (invariant across all modes that have it)

| Element | Specification |
|---|---|
| Chain start | 2 adjacent same-value tiles (8-way adjacency) |
| Chain extension | Same-value OR doubled-adjacent tile (8-way) |
| Tile reuse | Not allowed within a chain |
| Chain end | Voluntary; chain resolves to single result tile at last position |
| Result rule | **Rule D, k=2:** result = last × 2 × 2^⌊s/2⌋ where s = same-value extensions beyond initial pair |
| Tile system | Powers of 2: 2, 4, 8, 16, 32, ... |
| Result placement | Last position in chain; other chain tiles disappear |
| Post-chain | Gravity drops; new tiles spawn from top of empty columns |
| Goal | Reach max-tile milestones |
| Loss condition | No legal chain start (no adjacent same-value pair) |
| **Tile retirement — trigger** | Reach next tier above current spawn ceiling (first time = 512) |
| **Tile retirement — type** | Hard (no soft fallback) |
| **Tile retirement — pool dynamics** | Sliding window, 8 tiers wide, new top joins as bottom retires |
| **Tile retirement — stranded fate** | Stay as normal tiles; isolated retirees become emergent blockers |

## Settled knobs (vary by mode)

| Knob | Default (Endless) | Range across modes |
|---|---|---|
| Grid dimensions | 6×7 portrait | 5×6 (tight Ascension) to 7×8 (loose Drift) |
| Spawn pool initial range | 2-256 (8 tiers) | Restrict per mode |
| Spawn weights | 1/value power-law | Stage-dependent under retirement |
| Spawn rate | L−1 per chain | Continuous timer for Drift |
| Starting board state | Random per spawn weights | Designed for Levels |
| Win conditions | Open-ended (max tile / score) | Tile target, score target, clear, collect, etc. for Levels |
| Loss conditions | Death on (no chain start) | Death off for Drift |
| Move/time limits | None | Mode-specific |
| Special tile sets | None | None / basic / advanced (Layer 2) |
| Score formula | (Pending — currently max tile = score) | Per mode |
| Combo / chain bonuses | (Pending) | Per mode |
| Visual / audio palette | (Pending) | Cozy soft vs hardcore sharp |
| Tile retirement on/off | On | On for Endless/Ascension; off for Drift; overridden for Levels |
| Tile retirement trigger | Next tier above ceiling | Could intensify in Ascension (e.g., 4× rule) |

## Staged build roadmap

Confirmed: **only Endless mode is built for v1.** Hero mode validates kernel; other modes are spec'd but deferred.

| Stage | What's in it | Validation goal |
|---|---|---|
| **v1** | Bare chain Endless: grid + tiles + chain rule + Rule D k=2 + 1/value spawning, no retirement, no special tiles | Does the chain mechanic feel fun for 30+ minutes? |
| **v1.5** | Add tile retirement (next-tier-above-ceiling trigger, sliding window, stay-as-tiles) | Does retirement add depth or noise? |
| **v2** | Add Layer 2 content (special tiles, wilds, blockers, multipliers) | Does content deepen the game without distorting it? |
| **v2.5** | Add juice and aesthetic identity | Does it become a *thing*? |
| **v3+** | Add Levels mode (objectives, level design, currency) | Does the kernel survive content-driven progression? |
| **v4+** | Add Ascension mode (modifiers, daily challenges) | Does the kernel hold under modifier extremes? |
| **v5+** | Add Drift mode (cozy parameters, retirement off, soft visuals) | Does the kernel work as a cozy experience? |

Each stage is a **gate**: do not proceed if the prior stage didn't land.

For full rationale on the build sequencing, see *Design Journal* — Phase 2 section.

## Open decisions

**Phase 1: Complete.** All design decisions for the kernel are settled. Kernel audit passed (see Journal §1.5).

**Phase 2: Pending start.** Build a prototype of Endless v1 (bare chain mechanic, no retirement, no content). Validate that the chain mechanic feels fun for 30+ minutes. UX/UI lens consultation precedes any visual work.

## Deferred to later phases

- All Layer 2 content design (special tiles, blockers, wilds, multipliers) — v2+
- All Layer 3 objectives design (level structure, win conditions per mode) — v3+
- All Layer 4 meta-progression and economy — v3+
- All Layer 5 game feel / juice — v2.5+
- Visual / aesthetic identity — v2.5+ (biggest known gap from kernel audit)
- Cross-mode parameter sets (full Ascension modifier system, Drift cozy parameters, Levels content) — v3+
- Onboarding / tutorialization design — v3+
- Score formula beyond "max tile = score" — TBD pending playtest
- Persistent stats tracking — v2+ (mastery-curve action item from audit)

---

*End of Specification. For decision rationale, audit notes, and revisit triggers, see the Design Journal.*
