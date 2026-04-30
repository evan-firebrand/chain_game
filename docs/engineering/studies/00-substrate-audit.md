# Substrate Audit

Branch: `feature/difficulty-curve` — 2026-04-30

| # | Finding | Sev | Evidence | D1 row |
|---|---|---|---|---|
| 1 | **Bot chain depth capped at 5** — `MAX_DEPTH=5` in `bot.ts:22` means no bot ever considers chains > 5 tiles. Real play involves chains well above 5. Bot captures only 44.9% of available score; chains up to 25 exist on real boards. All bot metrics are invalid until this is fixed. | **P0** | `scripts/probe-bot-chain-depth.ts` | Bot Depth |
| 2 | **Spawn weight collapse at large pool sizes** — `spawnWeights(size)` geometric decay causes top-tier P to drop from 10% (pool=4) to 0.5% (pool=12). At pool ≥ 10, `spawnPool` also duplicates value `2` in multiple slots (values below 2 are clamped), so `2` accounts for 74%+ of spawns. Pool size > 8 is functionally identical from the player's perspective. | **P1** | `scripts/probe-spawn-weight-shape.ts` | Pool Size |
| 3 | **Greedy score curve favours long chains it cannot find** — `mergeValue × length` grows super-linearly with chain length (depth-15 alternating chain scores 96× more than depth-5). Greedy *wants* long chains but MAX_DEPTH=5 prevents finding them. All greedy-policy data is doubly skewed: wrong depth cap AND score understated. | **P1** | `scripts/probe-greedy-score-curve.ts` | Bot Depth / Chain Scoring |
| 4 | **No test infrastructure** — no `tests/` directory existed before this substrate pass. Chain-scoring math was unverified at the chain lengths that matter (10–20 tiles). | **P1** | `tests/game-kernel/chain-scoring.test.ts` (new, 13 tests, all green) | — |
| 5 | **No game specification doc** — `docs/Merge_Game_Specification.md` does not exist. Chain rules (`isValidAppend`), merge formula, and mode semantics are documented only in code. | **P2** | — | Missing Documentation |

## Follow-on work (ordered by dependency)

1. Fix `MAX_DEPTH` (P0 prerequisite for all metric work)
2. Fix `spawnPool` clamping so large pools add distinct values, not duplicate 2s
3. Implement bot archetypes (casual / engaged / skilled / speedrunner) per D1 spec
4. Re-run baseline with calibrated bots to establish valid Layer 2 metrics
5. Write `docs/Merge_Game_Specification.md`
