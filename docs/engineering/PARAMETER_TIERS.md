# Parameter Tiers

## The Four-Layer Lens

Every knob in the game can be assessed independently on four questions — each can fail while the others are correct:

| # | Question | What can go wrong |
|---|---|---|
| 1 | **Parameter** — is this the right knob conceptually? | Knob exists but controls the wrong thing |
| 2 | **Algorithm** — does the implementation match the intent? | Right knob, wrong formula |
| 3 | **Values** — are the specific numbers right? | Right knob + algorithm, wrong magnitude |
| 4 | **Intent** — does the experience match the design goal? | Right everything, wrong question |

This document covers layers 1 and 2 only. Layers 3 and 4 require playtest data and calibrated bots — both of which depend on the P0 fix below.

---

## Board Parameters

| Name | Default | Design intent | Algorithm | Open decision |
|---|---|---|---|---|
| `ROWS` | 7 | Vertical board size; controls density and chain opportunity | ✓ mutable via `configureBoard()` | What row count maximises chain-length variance? |
| `COLS` | 5 | Horizontal board size; controls spawn column choice | ✓ mutable | — |
| `POOL_SIZE` | 4 | How many distinct tile values can spawn | ⚠ See below | What pool size creates interesting difficulty progression? |

**`POOL_SIZE` note:** `spawnPool` now caps at available distinct values (2 through peak/2) so large `size` requests never produce duplicate entries. With peak=512, the max distinct pool is 8 values. Pool sizes > 8 are functionally identical. The weight collapse (top tier drops from 10% at pool=4 to 2% at pool=8) remains as a follow-on tuning concern. See `probe-spawn-weight-shape.ts`.

---

## Spawn Algorithm Parameters

| Name | Default | Design intent | Algorithm | Open decision |
|---|---|---|---|---|
| `algo` | `"weighted"` | Route through which spawning algorithm | ✓ enum-dispatched correctly | — |
| `strength` (antiPair) | 2.5 | Multiplier on board-awareness bias | ✓ linear boost to singleton tiles | What strength creates "noticeably harder but not punishing"? |
| `softness` (adversarial) | 0.5 | How often adversarial reverts to random | ✓ probability guard: `roll < softness → weighted` | Calibrated by algo-audit (2026-04-25). ≥ 0.5 = playable. |
| `pairingStrength` | level-scaled | Boosts spawns of values that have isolated tiles | ✓ scales 2.0 → 0 over first N levels | What level ramp produces a smooth early difficulty curve? |

**`weighted` algo:** uses `[0.4, 0.3, 0.2, 0.1]` for pool ≤ 4, extends with 0.7× geometric decay then renormalises for larger pools. Top-tier spawn rates: pool=4 → 10%, pool=8 → 2%, pool=12 → 0.5%. The collapse is intentional ("weight curves are intentionally a follow-up tuning concern") but the P1 duplicate-value clamping above compounds it. See `probe-spawn-weight-shape.ts`.

---

## Chain Scoring

| Name | Default | Design intent | Algorithm | Open decision |
|---|---|---|---|---|
| `mergeValue(chain)` | smallest 2^n ≥ sum | Merge produces the next power of 2 above the summed inputs | ✓ exact | — |
| Bot score | `mergeValue × chainLength` | Greedy picks the highest-scoring chain | ✓ correct formula | — |

**Score curve:** the function `mergeValue(values) × length` is non-monotonic with power-of-2 jumps. An alternating chain of length 15 scores 96× more than a depth-5 greedy chain; length 20 scores 512×. Greedy *wants* long chains — it just can't find them. See `probe-greedy-score-curve.ts`.

---

## Bot Depth (P0)

| Name | Default | Design intent | Algorithm | Open decision |
|---|---|---|---|---|
| `MAX_DEPTH` | 5 (`bot.ts:22`) | Limit DFS depth during chain enumeration | 🚫 **Wrong** — bots never explore chains > 5 tiles | What depth correctly models "casual" vs "skilled" play? |

**This is the P0 finding.** Real play involves chains well above 5 tiles. Probe results (N=10 games, 30 moves each):
- Bot max chain length: **5** (hard cap)
- Max available chain on real boards: **25**
- Bot score as % of uncapped-best: **44.9%**
- Boards where chains >5 exist: **76.3%**

All bot metrics collected at MAX_DEPTH=5 are measuring an artificially constrained agent, not a player proxy. Every layer-2 metric (skill curve, difficulty curve, mode comparisons) is invalid until this is fixed. See `probe-bot-chain-depth.ts`.

**Fix options:**
1. Raise `MAX_DEPTH` to 20+ (computationally cheap for the game's value constraints; `isValidAppend` prunes aggressively)
2. Replace DFS with a directed `chainBuilder` that constructs representative long chains without exhaustive enumeration
3. For player-archetype bots: spec a target chain-length distribution per archetype and implement a goal-directed policy

---

## Level Goals / Progression

| Name | Default | Design intent | Algorithm | Open decision |
|---|---|---|---|---|
| `INITIAL_TARGET` | 512 | Score threshold for clearing level 1 | ✓ calibrated (raised from 128 per harness data) | — |
| `TARGET_PROGRESSION` | `[512,768,1024,...]` | How targets scale per level | ✓ defined in `types.ts:182` | Does the progression match actual bot/human level-clear rates? |
| `levelGoal` | chain-length or produce-value | Secondary challenge per level | ✓ implemented and displayed | What goal distribution produces a good skill-signal? |
| `ratchetEnabled` | false | Rising floor as a difficulty dial | ✓ functional | Should casual mode enable this? |
| `ratchetInterval` | 1 | How often the floor rises (moves) | ✓ interval=1 confirmed correct by harness study | — |

---

## Bot Archetypes (Spec — No Code Yet)

Before any metric work, four player archetypes need to be defined. These specs are the prerequisite for every study that compares "player types." Once the MAX_DEPTH fix lands, implement them.

| Archetype | Target chain-length distribution | Score incentive |
|---|---|---|
| **Casual** | mostly 2–5, occasional 6–8 | Takes the first valid chain seen; does not plan |
| **Engaged** | 5–12 average, peaks at 10–15 | Greedy with depth 15; prioritises clearing tiles |
| **Skilled** | 10–18 average, targets doubling chains | Lookahead or heuristic with depth 20 |
| **Speedrunner** | Optimises chain-score-per-move; variable length | Score-per-move maximiser |

The current `greedy` policy at MAX_DEPTH=5 doesn't correspond to any of these archetypes — it's an artificial artifact of the depth cap, not a player model.

---

## Missing Documentation

- No `docs/Merge_Game_Specification.md` exists. The chain-scoring rules (`isValidAppend`: equal or double previous), the merge formula, and mode-specific semantics are documented only in code. A spec doc would be the authoritative reference for all the "design intent" cells above.
