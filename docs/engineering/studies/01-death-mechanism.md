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

## Pass 1 proposal — adaptiveStrategy (now built and tested; see Pass 2 below)

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

Hypothesis: if `adaptive` regularly conquers multiple tiers per game, the design works as intended. If it can't conquer the first tier, we have a real cleanup-window problem — or the bot is wrong.

---

## Pass 2 — Adaptive bot results (2026-05-01)

**Surprise: the adaptive bot died fastest of any archetype.** Not a wash, not within noise — by a large margin.

Same study, seed=1, N=3, 8 archetypes including `adaptive`:

| archetype | final turn (med) | recovery | peak isolated retired |
|---|---|---|---|
| casual (depth 5 greedy) | 500 (capped 2/3) | 3/3 | 22 |
| skilled (depth 20 greedy) | 500 [74, 500] | 3/3 | 23 |
| speedrunner (depth 20 result²/length) | 500 (capped 3/3) | 1/3 | 16 |
| engaged (depth 12 greedy) | 199 | 2/3 | 23 |
| retirementAvoider | 228 | 0/3 | 38 |
| sweeper | 113 | 0/3 | 38 |
| cleanupPrioritizer (known-bad) | 58 | 0/3 | 38 |
| **`adaptive`** | **41 [37, 53]** | **0/3** | **27** |

Adaptive's CI is tight ([37, 53]) — this isn't variance, it's consistent. All 3 games died naturally by turn ~50.

### What's going on

Two contributing failure modes are visible in the data:

**1. Free-play phase advances spawn pool too aggressively.** Adaptive's free-play is depth-20 greedy by `resultValue` — same as `skilled`. But when retirement first fires for adaptive, the trigger value is high enough that the cleanup workload is multi-tier-cascaded. Adaptive's pre-death spawn pool is 2^52 (consistent with cascading retirements eating through tiers fast).

**2. Cleanup-mode fallback escalates.** When no chain includes retired tiles AND stays ≤ maxOnBoard, adaptive falls back to greedy `resultValue` — which escalates. Each fallback turn potentially triggers the next retirement before the current tier is cleaned. This is the same spiral that kills `cleanupPrioritizer` — which is why adaptive only beats cleanup by ~17 turns, not by an order of magnitude.

**3. Phase separation is actively harmful at depth 20.** The `skilled` bot — pure depth-20 greedy throughout — survives to turn 500 with 3/3 recovery. It picks chains that *incidentally* include retired cells because depth-20 search finds them everywhere. Adaptive's "I'll only play preferred-tier chains" forces it onto a narrower set of moves than `skilled`'s greedy was already finding for free. Splitting into phases removes signal rather than adding it.

### What this does NOT mean

This does NOT mean the design is broken. Evan manually conquered the first tier easily. The bot represents a strategy that is wrong for this game, not the game being wrong for adaptive players.

Specifically: a real player triggers retirement at a *low* tile (e.g., max=512 → 1024 created → 512s retire) because they don't have depth-20 lookahead. The cleanup workload at low tiers is tractable. The adaptive bot triggers retirement at a *high* tile (because depth-20 finds huge chains pre-retirement) and then can't cleanup-recover at that scale.

### What to try next (deferred — not in this PR)

Three modifications worth exploring:

- **Lower-depth adaptive** (e.g., depth 8 or 12). Limits free-play aggressiveness; closer to human play.
- **Non-escalating fallback in cleanup mode.** Instead of "byResultValue" when no preferred chain exists, fall back to "byResultValue ≤ ceiling" — refuse to escalate even if no cleanup is available. Forces the bot to make smaller moves rather than spiral up.
- **Trigger-aware free-play.** In free-play, score by `resultValue` BUT cap at the next retirement threshold. So the bot pushes hard up to the threshold, then stops voluntarily. Lets the player choose when to advance.

None of these are obviously right. The lesson is the methodological one: **single-knob "adapt by phase" is not enough. The shape of the strategy in each phase matters more than the switch.**

---

## What got built in this study

| File | Purpose |
|---|---|
| `src/sim-harness/strategies/common.ts` | Added `maxTileOnBoard`, `tilesByTier`, `isolatedTilesByTier`, `largestAvailableChain` |
| `src/sim-harness/strategies/archetypes.ts` | Added 4 archetypes: `retirementAvoider`, `sweeper`, `cleanupPrioritizer`, `adaptive` |
| `scripts/studies/death-mechanism.ts` | Reusable study script with trajectories + per-archetype summary + postmortem; emits JSON manifest |
| `tests/sim-harness/board-analysis.test.ts` + `research-archetypes.test.ts` | Tests covering helpers and probes |

The `cleanupPrioritizer` and `adaptive` archetypes are preserved in the codebase as known-bad probes — useful for future studies that want to compare against the next iteration.

---

## Design observations (cautious — descriptive, not prescriptive)

These came out of the conversation that produced this lifecycle framing. Worth thinking about, not yet decisions:

- **Phase 1 currently has no skill differentiation.** Below the first retirement, any play style works — even random play survives. If the design wants skill to matter early too, Phase 1 may need its own friction.
- **The cleanup window may be too tight for unskilled players.** An adaptive bot can be tested. A real player who doesn't recognize they're in Cleanup phase will play wrong. UX should make the phase shift visible.
- **Conquest deserves celebration.** Right now nothing in the UI marks "you cleared a tier." Adding a celebration moment (visual, audio, score milestone) reinforces the lifecycle as the core game loop.
- **The bot-design lesson:** future studies need adaptive strategies. Single-scorer bots cannot model lifecycle play. Saved as memory for cross-session recall.

---

## Caveats

- **N=3, single seed.** Patterns are exploratory. Specific numbers in the JSON manifests are not authoritative.
- **The lifecycle framing comes from Evan, articulated 2026-05-01.** It is the canonical design intent and is saved in cross-session memory.
- **Pass 2 result is a counterexample to "adaptive = good", not a verdict on the design.** Evan's manual play conquered the first tier; the bot's failure indicates strategy shape, not design failure. Future iterations of the bot are worth trying before drawing design conclusions.
