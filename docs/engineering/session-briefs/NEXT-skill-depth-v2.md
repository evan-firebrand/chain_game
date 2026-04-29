# Session Brief: Simulation Agent — Skill-Depth Study v2

**Date:** 2026-04-29
**Agent role:** Simulation
**Assigned by:** Evan

## Context

Phases 0–3 are complete: pure kernel, fast kernel surface, and sim-harness scaffolding (runner, analyzer, sweep, strategies, schema) all shipped. The kernel supports chains of any length; the fast surface (`applyChainInPlace`) accepts arbitrary chain length. `retirement.ts` is a stub that throws `NotImplemented`.

The skill-depth study (sequence A.1–A.6) is being rebuilt as **v2**. v2 requires three foundation pieces to be built before any new measurements run.

## Open decisions (BLOCKED on Evan)

These must be answered before code starts. All of them affect the kernel/strategy contract.

**D1. Retirement trigger rule.** When does pool advancement fire?
- Option A: when `maxTileEver ≥ 2 × spawnPoolMax` (max tile is two tiers above the spawn ceiling)
- Option B: when `maxTileEver ≥ N × spawnPoolMin` for some fixed N
- Option C: fixed turn-count cadence (every K turns)
- Option D: something else (specify)

**D2. Retirement effect on board.** When retirement fires:
- Tiles of the retiring tier on the board: **auto-dissolve** (becomes empty cells, gravity applies). This is the v2 baseline. Bricking variants are out of scope.
- Confirm or adjust.

**D3. Spawn weight parameterization.** The weight function must produce a shape independent of pool ceiling.
- Option A: discrete templates `{flat, mild, steep, extreme}` — fixed proportions applied identically across pool sizes (e.g. flat = uniform; steep = `[0.7, 0.2, 0.06, 0.03, …]` regardless of how many tiers exist)
- Option B: continuous parameter — `P(tile_i) ∝ exp(−α · tier_from_top)` with α controllable
- Option C: explicit per-template normalization to a target distribution (e.g. always 50% mass on lowest tier regardless of pool size)
- Pick one.

**D4. Strategy chain-length cap.** The new chain-builder strategy needs a max chain length.
- Option A: 12 (covers human-realistic play)
- Option B: 24 (very generous, may slow strategies)
- Option C: unbounded (limited only by board size)
- Pick one. This is a tunable; later studies can sweep it as an axis.

**D5. Strategy ladder for v2.** Which strategies should the v2 grid run?
- Required: random (any chain length), `chainBuilder({maxLen: <D4>})` as primary skill bot
- Optional: search-d1 / search-d3 (existing) for backwards-comparison; deprecate if not needed
- Optional: an adversarial bot (plays badly on purpose) to bound the lower envelope
- Pick the ladder.

**D6. Per-game turn cap.** Default for v2:
- Option A: 50 (matches v1; bounds compute predictably)
- Option B: 100 (more late-game data)
- Option C: 200 (very late-game data, expensive)
- Option D: no cap, run until natural end (variable cost)
- Pick one.

**D7. v2 axes.** Which knobs varied, at which values:
- ruleK: probably {1, 2, 3} but reconsider given chainBuilder will produce long chains
- Board sizes: probably {6×5, 7×6, 9×8, 10×8, 12×10}
- Weight shape (per D3): values
- spawnPoolMax: values
- Retirement: {on, off} (axis = is retirement active)
- Pick the cells; expect 50–100 cells total.

---

## Task

Build v2 of the skill-depth study. Three foundation pieces, then the study run.

### Phase F1 — Longer-chain strategy

1. Add `extendByN(state, chain, maxLen)` to the kernel fast surface. Recursively enumerates legal chains up to length N starting from a given pair. The kernel's chain validation handles arbitrary length already.
2. Add `src/sim-harness/strategies/chain-builder.ts` exporting `chainBuilderStrategy({ maxLen })`. The strategy enumerates legal chains up to `maxLen` from every legal starting pair, scores each (`resolveChainInPlace().resultValue`), and picks the highest-scoring chain.
3. Add `'chain-builder'` to `StrategyName` and register it in the runner. The strategy is parameterized — register specific instances (e.g. `chain-builder-12`) per the ladder chosen in D5.
4. Tests: legality, determinism, chain-length distribution shows lengths > 3.

### Phase F2 — Spawn weight reparameterization

1. Replace `makeWeights(min, max, shape)` (currently in the study runner) with a kernel-level `makeSpawnWeights(shape, poolMin, poolMax)` that produces a `Partial<Record<TileValue, number>>` whose *shape* is determined by `shape` and is independent of pool size.
2. Implement per the parameterization in D3.
3. Tests: shape templates produce identical relative proportions at pool=8 and pool=12 (within rounding); summing all weights equals a fixed total (or normalized form).

### Phase F3 — Neutral retirement

1. Implement `checkRetirement(maxTileEver, currentSpawnPoolMax) → TileValue | null` per the rule in D1.
2. Implement `advanceSpawnPool(config, retiredTier) → Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'>`. Bumps min and max up by one tier; regenerates weights via the new function from F2 with the same shape parameter.
3. Wire retirement firing into `applyChainInPlace` (or wherever `maxTileEver` is updated): after a chain commit, check; if firing, update spawn pool config AND clear all tiles of the retiring tier from the board (set to empty), then apply gravity, then the next-spawn step.
4. Emit a `RetirementEvent` (extend `GameEvent` types) so the schema can record retirement firings per game.
5. Tests: trigger fires at the correct condition (per D1); pool config updates correctly; tiles of retiring tier are cleared from the board; weights regenerate with the same shape; game can run multiple retirements.

### Phase F4 — v2 study runner

1. New script `scripts/study-skill-depth-v2.ts`. Mirrors the v1 modes (calibration → grid → selective drill-down) but with the v2 strategy ladder, v2 weight parameterization, and a retirement-on/off axis.
2. New schema fields if needed: `retirementCount` per game, `retirementsByTurn` array. Update `SIM_HARNESS_SCHEMA.md`.
3. Output: `docs/engineering/studies/02-skill-depth-v2.md`. Same structure as v1 (baseline, grid, synthesis) but with the new axes.

## Acceptance criteria

1. `chainBuilderStrategy({ maxLen: 12 })` produces chains of length > 3 in at least 50% of turns on the default config (verify via `chainLengthHistogram`).
2. Spawn weights with `shape='steep'` produce the same relative proportions at pool=8 and pool=12 (largest weight / smallest weight ratio differs by <5%).
3. Retirement fires correctly under the chosen trigger rule; integration test confirms multi-retirement games complete normally.
4. v2 study doc reports baseline + grid + synthesis with the new ladder; chainLengthHistogram is included in the analysis (mean and distribution per strategy per cell).
5. All existing tests still pass; full coverage on new kernel code.
6. CI boundary check passes; lint and typecheck clean.

## Files to read first (ordered)

1. `CLAUDE.md`
2. `docs/Merge_Game_Specification.md`
3. `docs/Merge_Game_Design_Journal.md`
4. `docs/engineering/KERNEL_INTERFACE.md`
5. `docs/engineering/SIM_HARNESS_SCHEMA.md`
6. `src/game-kernel/index.ts`
7. `src/game-kernel/fast/index.ts`
8. `src/sim-harness/types.ts`
9. `src/sim-harness/runner.ts`
10. `src/sim-harness/strategies/random.ts` (template for new strategy)

## Files to write/modify

- `src/game-kernel/retirement.ts` (implement)
- `src/game-kernel/_internal.ts` or new file (add `makeSpawnWeights`)
- `src/game-kernel/fast/board.ts` (add `extendByN` or equivalent)
- `src/sim-harness/strategies/chain-builder.ts` (new)
- `src/sim-harness/types.ts` (`StrategyName` additions; new schema fields)
- `src/sim-harness/runner.ts` (register new strategy)
- `src/sim-harness/analyzer.ts` (chain length histogram aggregation)
- `scripts/study-skill-depth-v2.ts` (new)
- `docs/engineering/studies/02-skill-depth-v2.md` (new)
- `docs/engineering/SIM_HARNESS_SCHEMA.md` (update for new fields)
- Tests: `tests/game-kernel/retirement.test.ts`, `tests/game-kernel/fast/extend-by-n.test.ts`, `tests/sim-harness/strategies-chain-builder.test.ts`

## Do NOT

- Implement bricking-retirement. Out of scope for v2; lives in a future variant study.
- Implement board-aware spawning. Out of scope for v2; lives in a separate design exploration.
- Modify `DEFAULT_CONFIG` without Evan approval. New parameters get Evan-approved defaults via ADR.
- Reuse `makeWeights` from the v1 study runner. It conflates shape with pool ceiling; the new function lives in kernel and is independent.
- Reuse `extendBy1` for chain enumeration. Use `extendByN` for the new strategy.
- Read `docs/engineering/studies/01-skill-depth-spread.md` as input. v2 is a fresh study; v1 is historical reference only.

## Open questions to file if encountered

- If the kernel's `Row`/`Col` literal types in `types.ts` block board sizes > 9×8, file a `design-question` issue: are those literal types meant to be removed or generalized? (They're cast at runtime today.)
- If retirement needs to fire mid-chain (e.g. resolving a chain pushes max tile past the trigger): clarify with Evan whether the new max tile fires retirement before or after the spawn step. Default conservative: after spawn, between turns.
- If `chainBuilder` performance at maxLen=12 is too slow for the grid budget: reduce maxLen or add a width-cap; do not reduce sample size before flagging.
