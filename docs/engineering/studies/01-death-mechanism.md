# Death Mechanism Study — What We Learned (And What We Got Wrong)

**Date:** 2026-05-01
**Status:** First-pass exploratory study. Initial framing was wrong; corrected through play-testing and design conversation.

---

## The corrected framing

The game is a **lifecycle**, not a single-arc challenge:

```
Free Play  →  Friction (retirement fires)  →  Cleanup (clear retired tiles)  →  Conquest 🎉
     ↑                                                                              │
     └──────────────────────── Loop at higher tier ────────────────────────────────┘
```

| Phase | What's happening | Player behavior |
|---|---|---|
| **Free Play** | No retired tiles on board | Play any style — building toward next retirement trigger |
| **Friction event** | Retirement fires (e.g., max tile reaches 512) | Game has shifted phase |
| **Cleanup mode** | Retired tiles are liabilities — gravity will strand them | Target chains that include retired cells |
| **Conquest** | All retired tiles of tier V cleared | Celebrate — tier V is conquered |
| **Loop** | Spawn pool advanced one tier; back to Free Play | Push toward next milestone |

**Conquest is the milestone.** Not retirement firing. Removing every retired tile of a tier before any get stranded = a "level" cleared.

The failure mode is also a real end-state: if retired tiles get isolated and become permanent dead weight, that tier is *lost*, not conquered. Lost tiers accumulate as permanent obstacles.

---

## What we got wrong in the first analysis

The first version of this doc (and the bots that produced it) framed retirement as either a *milestone* (something you cross into a new phase) or a *runaway* (uncontrollable cascade). Both were wrong.

The bots all played a single fixed strategy — "pick chains by some scorer." None of them adapted between Free Play and Cleanup mode. So they all eventually died, and the doc concluded the design "punished effort."

When Evan played the game manually, he triggered retirement once and recovered easily — clearing every retired 2 before any got stranded. **The recovery was trivial for a human and impossible for the bots.** That proves the bots, not the design, were the problem.

The 7 bots I tested all fail in the same way: they apply Free-Play strategy during Cleanup mode (or Cleanup strategy during Free Play). They're the wrong shape for this game.

---

## The pilot data, re-interpreted

Same data, lifecycle lens applied:

| Bot | Strategy | Lifecycle interpretation |
|---|---|---|
| casual | Greedy at depth 5 | Free-play strategy applied throughout. Triggers retirement slowly. Doesn't switch to cleanup. |
| engaged | Greedy at depth 12 | Free-play strategy applied throughout, but at higher depth → triggers retirement faster. Doesn't switch to cleanup. |
| skilled | Greedy at depth 20 | Free-play strategy at maximum depth. Lucky long chains incidentally include retired cells, hence its better recovery (3/3) — but that's accidental, not strategic. |
| speedrunner | Greedy at depth 20 (resultValue² / length) | Free-play, biased to short high-value chains. Long survival here is misleading — bot caps out without exploring. |
| retirementAvoider | Refuses to escalate | Sort of an inverse-friction strategy — tries to stay in Free Play forever. Modestly delays retirement; can't avoid it. |
| sweeper | Targets bottom tier | Cleanup strategy applied in Free Play. Wrong phase — clears tiles that aren't retired yet, leaves real retired tiles alone after retirement fires. |
| cleanupPrioritizer | Targets retired cells, prefers big chains | Aggressive cleanup but escalates. Each big "cleanup sweep" produces a tile big enough to trigger the next retirement. **Worst archetype.** |

**The real pattern:** every bot mismatches phase to behavior. None of them does what a human does — switch.

---

## What we still don't know

- **Does an adaptive bot succeed?** A bot that plays free-play during Phase 1 and cleanup during Phase 3 hasn't been tested yet. This is the actual test of "does the design work?"
- **Specifically: can an adaptive bot achieve conquest?** Clear all retired tiles of a tier before any get stranded. If yes, the design is validated. If no, the cleanup window may be too tight even for a good strategy.
- **How many tiers can an adaptive bot conquer in a single game?** One? Ten? This calibrates how much the cycle actually loops in normal play.
- **What's the failure mode when conquest fails?** Did it strand a retired cell? Did a cleanup chain accidentally trigger the next retirement before the current one was finished?

---

## Suggested next experiment

**Build `adaptiveStrategy`:**

```ts
chooseAction(state):
  if (any tile on board is retired):
    // Cleanup phase: prefer chains with retired cells AND non-escalating result
    score = (chain) =>
      retiredCount(chain) > 0 && resultValue(chain) <= maxOnBoard(state.board)
        ? offset + retiredCount(chain) * 1000 + chain.length
        : resultValue(chain)
  else:
    // Free play: pick by resultValue (greedy)
    score = resultValue
```

Then re-run the same study with this 8th archetype. Track in particular:
- Conquest events: how many times each game does the bot fully clear a tier?
- Failure events: how many tiles get stranded?
- Time spent in each phase.

If `adaptiveStrategy` regularly conquers multiple tiers per game, the design works as intended. If it can't even conquer the first tier, we have a real cleanup-window problem.

---

## What got built in this study (still useful regardless)

| File | Purpose |
|---|---|
| `src/sim-harness/strategies/common.ts` | Added `maxTileOnBoard`, `tilesByTier`, `isolatedTilesByTier`, `largestAvailableChain` (post-hoc board analysis) |
| `src/sim-harness/strategies/archetypes.ts` | Added 3 research probes: `retirementAvoider`, `sweeper`, `cleanupPrioritizer` |
| `scripts/studies/death-mechanism.ts` | Reusable study script with trajectory + per-archetype summary + postmortem; emits JSON manifest under `dist/` |
| `tests/sim-harness/board-analysis.test.ts` + `research-archetypes.test.ts` | 22 tests covering helpers and probes |

All 193 + 22 = 215 tests pass. Lint and typecheck clean.

The `cleanupPrioritizer` archetype is preserved in the codebase as a known-bad probe — useful for future studies that want to compare adaptive strategies against pure-cleanup strategies.

---

## Design observations (cautious — descriptive, not prescriptive)

These came out of the conversation that produced this lifecycle framing. Worth thinking about, not yet decisions:

- **Phase 1 currently has no skill differentiation.** Below the first retirement, any play style works — even random play survives. If the design wants skill to matter early too, Phase 1 may need its own friction.
- **The cleanup window may be too tight for unskilled players.** An adaptive bot can be tested. A real player who doesn't recognize they're in Cleanup phase will play wrong. UX should make the phase shift visible.
- **Conquest deserves celebration.** Right now nothing in the UI marks "you cleared a tier." Adding a celebration moment (visual, audio, score milestone) reinforces the lifecycle as the core game loop.
- **The bot-design lesson:** future studies need adaptive strategies. Single-scorer bots cannot model lifecycle play. Saved as memory for cross-session recall.

---

## Caveats

- **N=3, single seed.** Patterns are exploratory. Specific numbers in the JSON manifest are not authoritative.
- **The `adaptiveStrategy` proposed above hasn't been tested yet.** This doc is a course-correction, not a final answer.
- **The lifecycle framing comes from Evan, articulated 2026-05-01.** It is the canonical design intent and is saved in cross-session memory.
