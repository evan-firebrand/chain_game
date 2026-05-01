# Substrate Audit — Simulation Harness Correctness

**Branch:** `feature/difficulty-curve-develop`  
**Date:** 2026-04-30  
**Status:** Findings confirmed. No production code changes.

---

## Findings

| # | Finding | Severity | Confirmed by | Fix |
|---|---|---|---|---|
| 1 | **Bot chain depth cap** | P0 | `probe-chain-depth.ts` | Raised `DEFAULT_MAX_CHAIN_LENGTH` 5 → 10 in `runner.ts` |
| 2 | **Spawn pool concentration at late game** | P1 | `probe-spawn-weights.ts` | No fix needed — expected behavior; document as design note |
| 3 | **Rule D bonus invisible at depth ≤ 5** | P1 | `probe-score-curve.ts` | Covered by P0 fix; new tests in `rule-d-long-chains.test.ts` |
| 4 | **No regression tests for chain scoring** | P1 | — | Added `tests/game-kernel/rule-d-long-chains.test.ts` (12 tests) |
| 5 | **No archetype strategies** | P1 | — | Added `src/sim-harness/strategies/archetypes.ts` (4 strategies) |
| 6 | **No tests for archetype depth behavior** | P2 | — | Added `tests/sim-harness/depth-cap.test.ts` (6 tests) |

---

## Finding Details

### 1 — Bot chain depth cap (P0)

`DEFAULT_MAX_CHAIN_LENGTH = 5` in `src/sim-harness/runner.ts` capped all simulation chains at 5 tiles. On a 7×6 board chains up to 42 tiles are topologically possible.

**Probe output:**
```
casual   (depth 5):  0% of chains exceed 5 tiles
skilled  (depth 20): 21% of chains exceed 5 tiles
```

**Impact:** All simulation metrics produced before this fix under-represent chain length by design. The Rule D bonus first doubles at chain length 6 (`sameExtensions=4`, `bonus=2`); the depth-5 cap silently excluded the entire region where the scoring nonlinearity begins.

**Fix:** `DEFAULT_MAX_CHAIN_LENGTH` raised to 10. For depths 12–20 the archetypes use `findBestDeepChain` (DFS, O(depth) memory) instead of `enumerateCandidateChains` (stores all candidates, OOM-unsafe above depth ~15).

---

### 2 — Spawn pool concentration (P1)

As retirement advances `spawnPoolMin`, the power-law weights produce a narrower distribution concentrated toward the max tier.

**Probe output:**
```
start   (2-256):    256-tile = 0.39% of spawns
6th ret (128-256):  256-tile = 33.3% of spawns (85x amplification)
```

**Assessment:** Not a bug. This is expected behavior from the weight table `{2:128, 4:64, 8:32, 16:16, 32:8, 64:4, 128:2, 256:1}`. The late game feels different from early game by design. Worth verifying the experience is intentional. No code fix needed.

---

### 3 — Rule D bonus invisible at depth ≤ 5 (P1)

**Probe output (all-2s chains):**
```
len 4: sameExt=2, bonus=1, result=8
len 5: sameExt=3, bonus=1, result=8   ← old cap hit here
len 6: sameExt=4, bonus=2, result=16  ← 2x jump, never seen at depth 5
len 8: sameExt=6, bonus=3, result=32
```

Greedy strategies that maximize `resultValue` WILL prefer longer same-value chains — the scoring correctly incentivizes chain building. The cap prevented discovery of this incentive.

**Fix:** Covered by the depth cap fix (#1) + spec tests (#4).

---

### 4 — New tests

| File | Tests | What they cover |
|---|---|---|
| `tests/game-kernel/rule-d-long-chains.test.ts` | 12 | Rule D formula at lengths 5–15, crossing the depth-5 boundary |
| `tests/sim-harness/depth-cap.test.ts` | 6 | Archetypes find chains > 5 when available; casual stays ≤ 5 |

All 165 tests pass.

---

### 5 — Archetype strategies

`src/sim-harness/strategies/archetypes.ts` adds four player skill profiles:

| Strategy | Depth | Scorer | Models |
|---|---|---|---|
| `casual` | 5 | `resultValue` | Player who doesn't look ahead |
| `engaged` | 12 | `resultValue` | Player who thinks ahead |
| `skilled` | 20 | `resultValue` | Player who finds the best chain |
| `speedrunner` | 20 | `resultValue²/length` | Player who prefers high-value short chains |

All use `findBestDeepChain` — safe at any depth, O(depth) memory.

---

## Probe Commands

```sh
npx tsx scripts/probe-chain-depth.ts    # confirms depth cap finding
npx tsx scripts/probe-spawn-weights.ts  # spawn pool distribution
npx tsx scripts/probe-score-curve.ts    # Rule D score curve at lengths 2-14
```
