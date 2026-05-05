# Session Brief: Lifecycle Follow-Up — Discover + Design

**Date:** 2026-05-01
**Agent role:** Open (likely Game Logic + Simulation, possibly UI)
**Assigned by:** Engineering agent (handoff from 2026-05-01 study session)
**Branch context:** PR #24 has just been opened against `develop` and is awaiting review/merge. New work cuts from `develop` once that lands, OR from `study/death-mechanism` if it has not yet merged.

---

## Why this brief exists

A long working session on 2026-05-01 produced (a) a death-mechanism study, (b) a major reframing of the game's design intent, and (c) a list of follow-up items. None of that is yet "done." This brief is your orientation so you can pick up cleanly without re-deriving everything from scratch.

**The headline:** the game is a *lifecycle* (Free Play → Friction → Cleanup → Conquest → Loop), and the design intent is far richer than the original death-mechanism study assumed. The lifecycle is now the canonical mental model. Your work probably involves either *measuring* whether the lifecycle works mechanically, or *surfacing* it to players via UX, or *extending* it with rewards.

---

## Read these first (ordered)

1. **`CLAUDE.md`** — start here every session. Includes the lifecycle section near the top.
2. **`~/.claude/projects/-Users-eluckey-Developer-2248/memory/MEMORY.md`** — auto-loads every session. Index of canonical design framings. Read each linked memory file:
   - `project_lifecycle_framing.md`
   - `project_retirement_is_pressure.md`
   - `project_badge_vs_nomination.md`
   - `project_magnitude_scales_cleanup.md`
   - `project_strategic_tension_duality.md`
   - `feedback_adaptive_bots.md`
   - `feedback_branch_workflow_archive.md`
3. **`docs/engineering/studies/01-death-mechanism.md`** — descriptive findings from the first-pass study. Important: the study was first written with a *wrong* framing ("design punishes effort"), then rewritten after Evan manually validated the lifecycle. Read it as "what we know now" rather than "the original conclusions."
4. **`docs/engineering/journal-draft-2026-05-01-lifecycle.md`** — draft journal entry capturing tonight's design conversation. Evan-only writes the actual `Merge_Game_Design_Journal.md`, but the draft is yours to read for context.
5. **`docs/engineering/puzzles/001-cascading-trap.md`** — first puzzle in the new puzzle library. Concrete teaching example for the "magnitude scales cleanup" principle.
6. **`docs/Merge_Game_Specification.md`** — current authoritative game contract (Evan-only writes). Note: does *not yet* include the lifecycle vocabulary. Reading it is still important for what it does say.

---

## Current state (where things stand)

- **Phase 3 (Tuning Console)** is complete per the project's phase plan.
- **Death-mechanism study** is complete first-pass (PR #24 in flight to develop).
- **Lifecycle framing is settled** as the canonical mental model. Saved in CLAUDE.md and memory.
- **Adaptive bot is NOT built.** This is the most-requested next experiment — see backlog.
- **Lifecycle UX does not exist.** Players cannot currently see what phase they are in, do not get a celebration moment for conquering a tier, and have no badge display. The mechanic that the game supposedly rewards is invisible.
- **Pattern badges, multi-conquest tier, hidden achievements** are brainstorm ideas only — not specced, not built.

---

## The design model in 90 seconds

```
Free Play   →   Friction   →   Cleanup   →   Conquest 🎉   →   Loop
                (retirement     (clear           (full clearance,
                 fires)         retired tiles    no dead tiles =
                                before they      badge earned;
                                strand)          partial = nominated only)
```

- **Retirement is the pressure source, not a milestone.** Triggering it is normal play.
- **Conquest is the milestone.** Removing every retired tile of a tier before any get stranded.
- **Result value (not chain length) scales the cleanup workload.** Bigger results trigger bigger and possibly cascading retirement.
- **Strategic tension** = control (player chains) vs randomness (game spawns). Patience to set up patterns is itself a gamble.
- **Skill expression** is "find the longest chain you can also clean up after," not "find the longest chain."

The bots from the first-pass study could not represent this lifecycle because they all played a single fixed strategy. **Future bot work must be phase-aware.**

---

## Open backlog (priority-ordered)

### High — directly tests / surfaces the design

1. **Build `adaptiveStrategy` bot.** A phase-aware bot that switches between Free Play (greedy by resultValue) and Cleanup mode (prefer chains that include retired cells AND don't escalate). Re-run the death-mechanism study with this bot. If it conquers multiple tiers in a game, the lifecycle is mechanically validated. If it cannot conquer even the first, we have a real cleanup-window problem.
   - Rough scorer:
     ```
     if any retired tiles on board:
       prefer chains where retiredCount(chain) > 0 AND resultValue <= maxOnBoard
       within that, score by retiredCount * 1000 + chain.length
     else:
       score by resultValue (greedy)
     ```
   - Add as `adaptiveStrategy` in `src/sim-harness/strategies/archetypes.ts`. Wire into `archetypeList()` in `scripts/studies/death-mechanism.ts`.
   - Rough estimate: ~30 minutes of code + 1–2 hours of study run + write-up.

2. **Lifecycle UX in HUD.** Visible phase indicator (Free Play / Cleanup / Conquest!), so players see when they have shifted phase. Currently the phase shift is invisible, so even players who would play the lifecycle right do not know they should switch behavior.
   - Files: `src/ui/hud.ts`, `src/ui/app.ts`. Possibly `src/ui/board.ts` for visual cues.
   - This is the *highest-leverage UX work* per tonight's discussion. Without it, the design is invisible.

3. **Conquest celebration moment + Badge display.** When a player fully clears all retired tiles of a tier, fire a celebration (visual + brief animation, maybe sound). Show persistent badge afterward.
   - Distinguish three states per tier: not-yet-attempted, nominated (triggered but didn't fully clean up), badge-earned (fully cleared no dead tiles), lost (some retired tiles got stranded permanently).
   - Files: `src/ui/hud.ts` (badge UI), `src/game-session/session.ts` (event detection — game-session, NOT kernel; kernel doesn't track player progress).

### Medium — extends the loop with depth

4. **Pattern badges (lightweight, additive).** Detect special chain shapes when played and award badges with visual flourish. Examples: *Pool Traversal* (chain visits every active pool tier), *Cluster Master* (N+ same-value tiles in one chain), *Cascade Maker* (single chain triggers ≥2 retirement events). No rule changes — purely recognition.

5. **Multi-conquest badge tier.** Extend the badge model to recognize cleaning up multiple cascaded tiers from one trigger. *Double Conquest*, *Triple+*. Directly rewards setup-heavy play.

6. **Hidden achievements.** Some pattern badges shown as surprise reveal rather than listed. Encourages exploration ("what else is there?").

### Lower / process

7. **Update `Merge_Game_Specification.md` with lifecycle vocabulary.** Evan-only writes — your task is to draft proposed changes for him to review and paste in.
8. **Pre-commit consequence preview.** When a chain is being built (HUD already shows projected resultValue as `CHAIN`), also show: which retirement thresholds it would cross, how many retired tiles will exist on the board after.
9. **Phase 1 friction question.** Currently below the first retirement, all play styles work — even random survives. Is this fine, or does Phase 1 need its own friction? Low priority but worth thinking about.
10. **Add Puzzle 002 to the library.** The turn-139 four-1024 cluster from tonight's conversation. Companion to Puzzle 001 — same principle (cascading retirement), opposite chain shape (short same-value vs long doubling). Demonstrates the result-value-scales-cleanup principle from the other direction.
11. **Fix the in-app PR routing UI** that suggests `archive/v1 → main`. Saw this in the Cowork app on 2026-05-01. See `feedback_branch_workflow_archive.md` memory.

---

## Recommended first task

**Build the adaptive bot (item #1).** Reasons:
- Smallest, most contained piece of work
- Directly tests whether the lifecycle is mechanically real or aspirational
- Provides measurement infrastructure for any future tuning experiments
- Result either validates the design (proceed to UX) or surfaces a problem (re-evaluate)

If the adaptive bot validates the lifecycle, the next work is UX (#2 + #3) so players can actually engage with the loop. If it does not, we need to talk before building anything else.

---

## Process and approvals

- **Branch workflow:** cut from `develop`, PR back to `develop`, Evan promotes `develop → main`. **Never use `archive/v1`** — abandoned prototype.
- **Evan-only writes:** the seven docs in top-level `docs/`. List in CLAUDE.md folder map. Your role for those: draft proposed changes in a separate file or comment for Evan to review.
- **What needs Evan's approval (do not proceed without it):** edits to top-level `docs/`, changes to `game-kernel/index.ts` public API, new Tier 1 parameter, merges to `main`, new ADRs, sim harness output schema, new package dependency.
- **Game logic:** all rule logic stays in `src/game-kernel/`. UI never imports kernel directly — go through `src/game-session/`. Studies use `src/sim-harness/`.
- **Capture as you go:** if your work surfaces a non-obvious design insight, save it as a memory in `~/.claude/projects/-Users-eluckey-Developer-2248/memory/` and link from `MEMORY.md`. Memories survive across sessions; conversation does not.

---

## Tools and commands

```bash
npm run dev          # vite dev server (browser-playable game). Starts on port 3000 if 5173 is taken.
npm run test         # vitest run (fast)
npm run lint         # eslint over src + tests
npm run typecheck    # tsc --noEmit

# Run the death-mechanism study:
npx tsx scripts/studies/death-mechanism.ts --seed 1 --n 10 --max-turns 500 --out dist/run.json

# Run the original baseline (non-adaptive bots):
npx tsx scripts/studies/archetype-baseline.ts
```

Studies emit JSON manifests under `dist/`. Use `jq` to inspect.

The dev server lets you play the game directly. **Manual play-testing is a valid form of validation** — Evan invalidated my first-pass study findings by playing the game himself. Take the dev server seriously as a research tool.

---

## Open questions (worth thinking about, not blocking)

1. **Does adaptive play actually conquer multiple tiers in a single game?** This is the #1 empirical question.
2. **What is the failure mode when conquest fails?** Did a retired tile get stranded? Did a cleanup chain accidentally trigger the next retirement?
3. **Is the cleanup window too tight at higher tiers?** As retirement advances, the spawn pool widens upward; cleanup of mid-tier retired tiles may compete with new high-tier spawns.
4. **Does Phase 1 (Free Play) need any friction?** Currently all play styles survive below the first retirement.
5. **Where does the "earn or purchase" idea fit?** Brainstormed by Evan in the journal draft — heavier than pattern badges, may dilute the strategic tension if not designed carefully.
6. **What are the first three tiers' badge "names"?** Conquering tier 2 = ?, tier 4 = ?, etc. Could be flavor (named after concepts) or numeric (Tier I, II, III). Design decision deferred.

---

## Do NOT

- Do not edit Evan-only-write docs (`docs/Game_Design_Concepts.md`, `docs/Merge_Game_Specification.md`, `docs/Merge_Game_Design_Journal.md`, `docs/Merge_Game_Tooling_Specification.md`, `docs/Merge_Game_Tooling_Journal.md`, `docs/swarm_framework.md`, `docs/swarm_prompts.md`).
- Do not put game logic outside `src/game-kernel/`. The Prime Directive in CLAUDE.md.
- Do not merge anything into `main`.
- Do not use `archive/v1` as a base or merge target.
- Do not chase astronomical tile values (>2^15) — those are bot artifacts, not human-relevant. Focus analysis on the playable band.
- Do not assume the first-pass study findings are "done" — they were partly wrong and the rewrite reflects the corrected picture.

---

## If you get stuck

- File a `design-question` GitHub issue per CLAUDE.md's design-gap protocol.
- Or just ask Evan. He encourages reaching out.
- Capture the question as a memory if it would otherwise have to be re-asked next session.
