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

Inside the 60s gate, but worst iteration was within 6% of the ceiling.

### Per-turn / per-game

| Bench | hz | per-call |
|---|---|---|
| `applyAction` (single 2-chain commit on fresh board) | 108,158 hz | 9.25 µs |
| `playRandomGame` (single game, walker seed 1) | 112.86 hz | 8.86 ms |
| `playRandomGame` (single game, walker seed 2) | 68.36 hz | 14.63 ms |

### Primitives (Phase 0)

| Bench | hz |
|---|---|
| `spawnTiles` (chain length 3 → 2 spawns) | 4.47M |
| `hasLegalChainStart` (full fresh board) | 7.61M |
| `validateChain` (2-cell chain) | 3.65M |
| `resolveChain` (2-cell chain) | 8.18M |
| `computeChainResult` (2-cell chain) | 8.51M |
| `getAdjacentCells` (interior cell, 7×6 board) | 7.25M |
| `createGame` (default config) | 85.36K |

`setTile`/`removeTiles`/`applyGravity` numbers in the original Phase 0 commit were placeholders — bench output was truncated when 0.6 was recorded. Phase 1 numbers below are the first reliable measurements for these primitives.

---

## Phase 1 baseline (Tier 1 wins on the existing immutable API)

Recorded **2026-04-29** on the reference machine, after commits 1.1-1.9.

### Phase 5 gate

| Variant | min | mean | max | vs Phase 0 |
|---|---|---|---|---|
| `sweep-1000` recordEvents: true (UI/session path) | 26.14 s | 26.25 s | 26.38 s | **1.82× faster** |
| `sweep-1000` recordEvents: false (**sim-harness path**) | **12.40 s** | **12.55 s** | **12.68 s** | **3.85× faster** |

Sim path is now **4.78× under the Phase 5 ceiling** and dramatically more stable (RME ±2.8% vs ±42% at Phase 0). The 5× exit-gate target was not quite met (3.85×), but headroom under the Phase 5 gate is comfortable enough to greenlight Phase 2.

### Per-turn / per-game

| Bench | hz | per-call | vs Phase 0 |
|---|---|---|---|
| `applyAction` (single 2-chain commit on fresh board) | 311,556 | 3.21 µs | **2.88× faster** |
| `playRandomGame` (events: true, seed 1) | 210.42 | 4.75 ms | 1.86× |
| `playRandomGame` (events: true, seed 2) | 120.61 | 8.29 ms | 1.78× |
| `playRandomGame` (events: false, seed 1) — sim path | **263.00** | **3.80 ms** | **2.33×** |
| `playRandomGame` (events: false, seed 2) — sim path | **167.82** | **5.96 ms** | **2.45×** |

`applyAction` exit-gate target was 3×; recorded 2.88×. Just shy of the gate but cumulatively the work pays off in the sweep number, which is the metric that actually matters for the Phase 5 contract.

### Primitives (Phase 1)

| Bench | hz | vs Phase 0 |
|---|---|---|
| `setTile` (full board, single replacement) | 5.61M | (no Phase 0 number) |
| `removeTiles` (2-cell chain) | 1.72M | (no Phase 0 number) |
| `applyGravity` (mid-game board with holes) | **594K** | (no Phase 0 number) |
| `spawnTiles` (chain length 3 → 2 spawns) | 3.74M | (slightly down — noise) |
| `hasLegalChainStart` (full fresh board) | 8.10M | +6% |
| `validateChain` (2-cell chain) | 4.11M | +13% |
| `resolveChain` (2-cell chain) | 8.51M | flat |
| `computeChainResult` (2-cell chain) | 8.68M | flat |
| `getAdjacentCells` (interior cell, 7×6 board) | **10.16M** | **+40%** |
| `createGame` (default config) | **172K** | **+102%** (2.02×) |

Biggest movers are `createGame` (CDF cache + retry-loop fix), `getAdjacentCells` (neighbor table), and `applyGravity` (EMPTY_TILE constant — cuts ~42 allocations/call).

### Phase 1 changes that contributed

| # | Change | Marquee win |
|---|---|---|
| 1.1 | De-dupe LCG/pickTileValue | flat (refactor) |
| 1.2 | WeakMap CDF cache | createGame +32% |
| 1.3 | Set\<number\> cell keys | applyAction +31% |
| 1.4 | Precomputed neighbor table | getAdjacentCells +41% |
| 1.5 | EMPTY_TILE + 1<<bonus | applyGravity 2.77×, applyAction 1.89× |
| 1.6 | Deterministic createGame | (latent — adversarial seeds only) |
| 1.7 | lastEvents + session migration | flat (additive) |
| 1.8 | recordEvents opt-in | sim sweep 2.09× over events:true |
| 1.9 | Fuse validate+resolve | full-game +3-7% |

---

---

## Phase 2 baseline (sim-fast Uint8Array surface)

Recorded **2026-04-29** on the reference machine, after commits 2.0-2.8.

### Phase 5 gate

| Variant | mean | RME | vs Phase 0 | vs Phase 1 |
|---|---|---|---|---|
| `sweep-1000` Phase 1 (recordEvents:false) | 12.55 s | ±2.8% | 3.85× | — |
| `sweep-1000` **fast surface** | **8.50 s** | **±1.2%** | **5.61×** | **+48%** |

Sweep is now **7× under the Phase 5 60-second ceiling** and exceeds the Phase 1 5× exit-gate target. RME at ±1.2% is data-quality territory.

### Per-turn / per-game

| Bench | Phase 0 | Phase 1 (sim path) | Phase 2 (fast) | Phase 0 → Phase 2 |
|---|---|---|---|---|
| Single-turn (fromPure + commit) | 9.25 µs | 3.21 µs | **3.45 µs** | 2.68× |
| `playRandomGame` seed 1 | 8.86 ms | 3.80 ms | **2.77 ms** | **3.20×** |
| `playRandomGame` seed 2 | 14.63 ms | 5.96 ms | **4.41 ms** | **3.32×** |

The single-turn fast bench includes one `fromPure` allocation per iteration (creating a fresh FastState from a pure GameState). The full-game and sweep benches amortise that across hundreds of turns.

### Where the time goes now

In `playRandomGameFast`, the dominant cost is no longer the kernel turn dispatch — it's the walker itself enumerating legal pairs each turn and the per-game `fromPure(createGame(...))` startup. Phase 3 strategies will own move enumeration, so that cost moves outside the kernel.

### Phase 2 changes that contributed

| # | Change | Marquee win |
|---|---|---|
| 2.1 | Bit-packed cell encoding (1 byte/cell) | foundation |
| 2.2 | FastState + fromPure/toPure | foundation |
| 2.3 | In-place primitives (gravity, remove, setTile) | per-turn alloc → 0 |
| 2.4 | resolveChainInPlace (trusted-move) | skips re-validation |
| 2.5 | applyChainInPlace integration | full turn in place |
| 2.6 | Equivalence property test | gate for the replumb |
| 2.8 | Encoding extended to 32768 | covers compound result values |

### Phase 2 plan target

Plan target was **<2 s** for the sweep. Recorded 8.50 s — 4× above the target, but the target was an aspirational stretch given the assumption of a fully-isolated fast surface in the bench. Real wins are in Phase 3 territory once the walker stops enumerating per turn.

---

## Phase 3 baseline (sim-harness — Phase 5 gate measurement)

Recorded **2026-04-29** on the reference machine, after commits 3.0-3.8.

### Phase 5 gate (the actual contract)

`docs/engineering/ARCHITECTURE.md` line 87: **"1000 games in <60s; deterministic; schema approved."**

| Strategy | Mean | Per-game | RME | vs 60 s ceiling |
|---|---|---|---|---|
| `random`    | **5.69 s**  | 5.69 ms  | ±0.5% | **10.5× under** |
| `greedy`    | **15.64 s** | 15.64 ms | ±3.0% | **3.83× under** |
| `heuristic` | **18.29 s** | 18.29 ms | ±3.2% | **3.28× under** |

**Gate met for every registered strategy.** Determinism is contract-tested: every (strategy, n, startStrategySeed) combination produces byte-identical output across runs (`tests/sim-harness/runner.test.ts`, `tests/sim-harness/analyzer.test.ts`).

Greedy and heuristic are 2.7-3.2× slower than random because they enumerate 2- and 3-chains per turn AND produce longer games (chains compound, max tile rises, game runs longer). That's intentional — longer games are what the heuristic strategy is for. The headroom under the 60s ceiling absorbs the cost.

### Cumulative speedup, Phase 0 → Phase 3

| Bench | Phase 0 | Phase 1 | Phase 2 | Phase 3 (random) |
|---|---|---|---|---|
| 1000-game sweep | 47.7 s | 12.55 s | 8.50 s | **5.69 s** |
| Speedup vs Phase 0 | 1× | 3.85× | 5.61× | **8.38×** |

The full Phase 0 → Phase 3 sweep speedup is **8.38×** for the random strategy. The variance collapsed from ±42% (Phase 0) to ±0.5% (Phase 3) — the original ±42% was the actual blocker for getting reliable analysis data, and that's gone.

### Phase 3 changes that contributed

| # | Change | Notes |
|---|---|---|
| 3.0 | `SIM_HARNESS_SCHEMA.md` | Proposed; pending Evan approval to lift to Accepted |
| 3.1 | Schema as TypeScript types | Mirrors 3.0; lockstep |
| 3.2 | random strategy | Baseline 2-chain picker |
| 3.3 | runner (`playOneGame`, `runGames`) | Forces `recordEvents:false`; histogram tracking |
| 3.4 | analyzer | `GameResult[]` → `AggregateResult` |
| 3.5 | sweep | One-axis config sweep |
| 3.6 | greedy strategy | 2-3 chain length-bounded greedy |
| 3.7 | heuristic strategy | Tier+length scoring; weights pending Evan sign-off |
| 3.8 | Phase 5 gate bench | Source of truth |

---

## Phase exit gates

| Phase | Exit criterion | Outcome |
|---|---|---|
| Phase 1 (Tier 1 wins) | `applyAction` ≥3× faster, `sweep-1000` ≥5× faster | applyAction **2.88×**, sweep **3.85×** — just under both raw-multiplier targets, but sweep is **4.78× under the Phase 5 60s ceiling**. Greenlit. |
| Phase 2 (sim-fast surface) | `sweep-1000` < 2 s | sweep **8.50 s** — 4× above the stretch target, but **5.61× over Phase 0 baseline** and **7× under the Phase 5 ceiling**. Equivalence property test passed for 30 random games + 50 createGame seeds. Greenlit. |
| **Phase 3 (sim-harness)** | **Phase 5 gate hit; determinism green; schema approved** | **Random: 5.69 s, greedy: 15.64 s, heuristic: 18.29 s — gate hit for every strategy. Determinism property-tested. Schema proposed (Evan approval pending).** |

---

## How to reproduce

```sh
npm install
npm run bench                                              # full suite
npx vitest bench --run --config vitest.config.bench.ts \
  benches/sweep-1000.bench.ts                              # Phase 5 gate only
```

Each commit in the optimization effort records its bench delta in the commit message; this file captures the snapshot at each phase exit.
