# Session Brief: Bot Calibration & Open Design Threads

**Date:** 2026-05-03
**Read alongside:** [`2026-05-01-handoff-lifecycle-followup.md`](2026-05-01-handoff-lifecycle-followup.md). That brief documents the **operating context** — the design model (the lifecycle lens), the branch workflow (process), the do-NOT list (constraints). Those aren't deferred work items; they're the frame of reference everything else operates inside. **Read it first if you haven't.** This brief only captures what *work* has happened since 2026-05-01 and what's open next.

---

## Why this brief exists

Between 2026-05-01 and today, six PRs landed (4 mine, 2 unrelated UI work). Recording infrastructure is now live, the calibration scaffold is in place, and the next concrete blocker is **playlog volume from human play**, not engineering. This brief orients you on the new shape of the work and the methodological insight that came out of Pass 2 of the death-mechanism study.

---

## What changed since 2026-05-01

| PR | What landed |
|---|---|
| [#26](https://github.com/evan-firebrand/chain_game/pull/26) | The 2026-05-01 handoff itself |
| [#27](https://github.com/evan-firebrand/chain_game/pull/27) | `adaptiveStrategy` bot + Pass 2 study results |
| [#28](https://github.com/evan-firebrand/chain_game/pull/28) | `PlaylogRecorder` — captures per-turn human gameplay, "Download playlog" button in HUD, exports JSONL |
| [#29](https://github.com/evan-firebrand/chain_game/pull/29) | `weightedHeuristic` bot — Tetris-style, weights are a *parameter* (`makeWeightedHeuristic(weights)` factory) |
| #30, #31, #32 | UI work I (the prior agent) was not involved in: lifecycle phase indicator, conquest celebration, persistent tier-conquest badges, "luminous-crystal" visual redesign. **Read these PRs cold to understand the current UI** — I can't summarize them. |

---

## The methodological core (this is the most important thing in this brief)

Pass 2 of the death-mechanism study (in [`docs/engineering/studies/01-death-mechanism.md`](../studies/01-death-mechanism.md)) shipped the `adaptiveStrategy` bot. **It died fastest of all 8 archetypes** — median 41 turns vs `skilled`'s 500.

The temptation is to read this as "the bot is wrong, build a better one." That reading is shallow. The sharper reading is:

> **A tool is only as good as it is designed.**

The bot's failure is evidence about *our encoded mental model of the player*, not about the design. We chose depth 20, non-escalating cleanup, greedy fallback — those were our intuitions about what a good player does. None of those choices, in combination, produced anything resembling Evan's actual play (which conquers tier 1 manually with no problem). Naming a strategy `adaptive` did not make it adaptive.

The consequence:

- **Don't propagate bot-study failures into design decisions.** "We built X and it died fast" tells us about X, not the game.
- **Bots can falsify specific hypotheses.** They cannot validate the design unless we are confident they faithfully model human play. We are not.
- **Human play is the ground truth we have.** Evan's manual sessions are the dataset future bots should be trying to imitate.

This is saved as memory ([`feedback_tools_only_as_good_as_design.md`](https://github.com/evan-firebrand/chain_game) — your auto-memory will load it). Internalize it before designing any new evaluation tool.

---

## Current state

- **Recording infrastructure: live on `develop`.** [`src/game-session/playlog.ts`](../../../src/game-session/playlog.ts) auto-records every game; HUD has a "Download playlog" button that exports JSONL.
- **`weightedHeuristic` bot scaffold: live.** [`src/sim-harness/strategies/weighted-heuristic.ts`](../../../src/sim-harness/strategies/weighted-heuristic.ts). Five features (`isolatedRetiredAfter`, `legalChainStartsAfter`, `maxTileVsSpawnPool`, `retiredClearedByThisChain`, `triggersNextRetirement`), unit weights, depth cap 6 (overridable). Wired into the death-mechanism study `archetypeList()`.
- **Recorded playlogs: unknown.** They live on Evan's local machine if they exist. The next blocker is volume — see below.

---

## The next concrete task: PR-C — weight fitting from playlogs

**Blocked on:** Evan having played 5–10 games into the recorder and the JSONLs being reachable (committed to a `dist/playlogs/` directory, gitignored, or shared another way).

**Scope (when unblocked):**

1. New script `scripts/fit-weights.ts` that:
   1. Loads all `*.jsonl` files in a `playlogs/` directory (one record per turn — see `PlaylogRecord` shape in [`src/game-session/playlog.ts`](../../../src/game-session/playlog.ts)).
   2. For each turn: re-derives all *legal* candidate chains (using `enumerateCandidateChains` or similar) and computes the 5-feature vector for each.
   3. Defines an objective: how often does the weighted-sum scorer rank Evan's actual chain in the top-K. Or, alternatively, end-state-similarity — how close are the resulting board features of the bot's pick vs Evan's pick.
   4. Runs a simple optimizer (least-squares against the linear weights, or grid search over a small range). Don't reach for ML — this is 5 weights.
   5. Writes `weights.json` and re-instantiates the bot via `makeWeightedHeuristic(fittedWeights, 'weightedHeuristic-evanFit')`.
2. Re-run the death-mechanism study with `weightedHeuristic-evanFit` added. Compare against `skilled` (the depth-20 greedy benchmark that lasts 500 turns).
3. Write up findings as a Pass 3 section in [`studies/01-death-mechanism.md`](../studies/01-death-mechanism.md).

**A scheduled remote agent will check on this on 2026-05-05** (Tuesday 9am CDT). It will detect playlog availability and either offer to spin up PR-C or nudge Evan for more games. ID: `trig_01DjD6Ai4qKQK3sB3xPnk667` — manage at https://claude.ai/code/routines/trig_01DjD6Ai4qKQK3sB3xPnk667.

---

## Other open threads

### Design questions Evan flagged (not engineering tasks today)

- **Spawn preview.** Threes! shows 1, modern Tetris shows 5. Evan asked whether to surface upcoming spawn tiles. Reduces randomness side of the strategic-tension duality (saved as memory). Worth a written design treatment before any code.
- **Undo.** Free undo undermines the consequence model. Earned/limited undo (3 per game, or earned via badges, or 2-second window) preserves consequence as a safety net for ambitious plays. Same — design treatment needed first.

### Bot iterations worth trying (in [`studies/01-death-mechanism.md`](../studies/01-death-mechanism.md))

- Lower-depth `adaptive` (8 or 12 instead of 20).
- Non-escalating fallback in `adaptive`'s cleanup mode (currently falls back to greedy `resultValue`, which escalates).
- Trigger-aware free-play (cap result at next retirement threshold).

None obviously right. Don't pursue without Evan's go-ahead — the methodological lesson above suggests we're better served by playlog-fit weights than by more hand-tuned bots.

### Phase 1 friction question (still open)

Below the first retirement, all play styles survive — even random. Is that intended (gentle on-ramp) or a missed differentiation opportunity? Worth thinking about, low priority.

---

## Memories you should have loaded

The auto-memory at `~/.claude/projects/-Users-eluckey-Developer-2248/memory/MEMORY.md` is the source of truth. Key entries to re-read at session start:

- `project_lifecycle_framing.md` — Free Play → Friction → Cleanup → Conquest → Loop
- `project_strategic_tension_duality.md` — control vs randomness; the engine of skill expression
- `feedback_tools_only_as_good_as_design.md` — the Pass 2 lesson
- `feedback_phase_aware_not_enough.md` — *don't* just "make it phase-aware"
- `feedback_chain_length.md` — depth caps below 10 don't model real play

---

## Tools and commands (refreshed)

```bash
npm run dev          # vite — game playable in browser; recording is auto-on
npm run test         # vitest run
npm run lint
npm run typecheck
node scripts/check-boundaries.js

# Run the death-mechanism study (15-25 min at N=3 with all 8 archetypes including weightedHeuristic):
npx tsx scripts/studies/death-mechanism.ts --seed 1 --n 3 --max-turns 500 --out dist/run.json
```

---

## What this brief does NOT cover

- The UI changes from PRs #30, #31, #32. I don't have context on them. Read those PRs cold.
- The operating context documented in the 2026-05-01 brief (design lens, branch workflow, Evan-only-writes list, do-NOTs). That's the frame, not work — it isn't restated here because nothing about it changed and duplicating it would just bloat the docs.

---

## If you get stuck

- File a `design-question` GitHub issue per `CLAUDE.md`'s design-gap protocol.
- Or just ask Evan. He encourages reaching out and tends to be sharp on methodological points.
- Capture as memory anything you'd otherwise have to re-derive next session.
