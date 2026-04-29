# Performance Baseline

**Status:** Architecture-Agent draft — pending Evan approval per CLAUDE.md (`docs/engineering/` is Architecture-Agent-writes-Evan-approves).

This document records the kernel performance baseline at the start of the optimization effort and gets re-recorded at each phase exit. Numbers are measured by `npm run bench` against the benches in `benches/`.

The Phase 5 gate (`docs/engineering/ARCHITECTURE.md`) is **1000 random-strategy games in <60s**. The `sweep-1000.bench.ts` bench is the permanent source of truth for that number.

---

## Reference machine

- vitest **1.6.1**
- node **v22.22.2**
- Linux x64
- Numbers will vary across machines; use the *ratios* between phases as the comparable signal, not absolute hz.

---

## Phase 0 baseline (pre-optimization)

Recorded **2026-04-29** on the reference machine.

### Phase 5 gate

| Bench | min | mean | max | RME |
|---|---|---|---|---|
| `sweep-1000` (1000 random-strategy games) | 40.83 s | 47.69 s | 56.54 s | ±41.89% |

We are inside the 60s gate today, but worst iteration is within 6% of the ceiling. Random-legal walker is not a real strategy — real strategies (greedy/heuristic) likely run longer games and erode the margin further. This is why we optimize.

### Per-turn / per-game

| Bench | hz | per-call |
|---|---|---|
| `applyAction` (single 2-chain commit on fresh board) | 108,158 hz | 9.25 µs |
| `playRandomGame` (single game, walker seed 1) | 112.86 hz | 8.86 ms |
| `playRandomGame` (single game, walker seed 2) | 68.36 hz | 14.63 ms |

The 1.65× spread between walker seeds is dominated by game-length variance plus the O(T²) events spread (`src/game-kernel/index.ts:384`).

### Primitives

| Bench | hz |
|---|---|
| `setTile` (full board, single replacement) | ~6.5M |
| `removeTiles` (2-cell chain) | ~6.4M |
| `applyGravity` (mid-game board with holes) | ~3.4M |
| `spawnTiles` (chain length 3 → 2 spawns) | 4.47M |
| `hasLegalChainStart` (full fresh board) | 7.61M |
| `validateChain` (2-cell chain) | 3.65M |
| `resolveChain` (2-cell chain) | 8.18M |
| `computeChainResult` (2-cell chain) | 8.51M |
| `getAdjacentCells` (interior cell, 7×6 board) | 7.25M |
| `createGame` (default config) | 85.36K |

`createGame` is two orders of magnitude slower than every other primitive. Phase 1.6 (replace the 100-attempt retry loop) targets this.

---

## Phase exit gates (to be recorded)

| Phase | Exit criterion | Recorded numbers |
|---|---|---|
| Phase 1 (Tier 1 wins) | `applyAction` ≥3× faster, `sweep-1000` ≥5× faster | _pending_ |
| Phase 2 (sim-fast surface) | `sweep-1000` < 2 s | _pending_ |
| Phase 3 (sim-harness) | Phase 5 gate hit; determinism green | _pending_ |

---

## How to reproduce

```sh
npm install
npm run bench                                              # full suite
npx vitest bench --run --config vitest.config.bench.ts \
  benches/sweep-1000.bench.ts                              # Phase 5 gate only
```

Each commit in the optimization effort records its bench delta in the commit message; this file captures the snapshot at each phase exit.
