# Sim-Harness Capabilities & Next-Phase Ramp

**Status:** Refreshed 2026-04-29 after the skill-depth study (A.1–A.6). Pending Evan approval per CLAUDE.md.

This document is a companion to:

- `PERF_BASELINE.md` — the numeric record of what each phase achieved
- `SIM_HARNESS_SCHEMA.md` — the data shape the harness produces
- `ARCHITECTURE.md` — the module diagram and phase gate criteria
- `adr/0002-sim-fast-kernel.md` — the storage-layer decision

It exists because "Phase 5 gate met" doesn't tell you *what kinds of analyses are now tractable*. This doc does.

---

## TL;DR

The look-ahead gap is closed. `cloneFast(state)` and `searchStrategy({depth, width})` shipped (A.1, A.2); `search-d1`, `search-d2`, `search-d3` are now first-class strategies in the runner. The skill-depth study (A.4-A.6) used them to characterize Gap B (random → d3) and Gap C (d1 → d3) across 54 scoped configs in ~7.4 minutes total — the harness can now answer the kind of design questions the original ramp was built for.

**The remaining limit is statistical resolution and parameter coverage, not engine performance.** See `studies/01-skill-depth-spread.md` for the first end-to-end use of the harness.

---

## What we can analyze today

| Question | Time on the reference machine | Confidence |
|---|---|---|
| Run 1000 games at one config (any strategy) | 5.7–18.3 s for random/greedy/heuristic; ~130 s for `search-d3` | high (RME 0.5–3%) |
| Vary `prngSeed` / `ruleK` / `gridRows` / `gridCols` / `spawnPoolMin` / `spawnPoolMax` across N values | ~5–18 s × N | high |
| Compare random + d1 + d3 with paired seeds on the same config | ~30 s for 100 paired games | high; A.4 baseline established |
| **Full Cartesian-product sweep over 4 axes × 3 values each (3⁴ = 81 cells)** | ~7 min for 50 paired games × {random, d1, d3} | demonstrated in A.5d (54-cell variant) |
| Get distributions: game length p10/p50/p90, max tile, chain length & result histograms, death cause | included in `AggregateResult` | schema-stable |
| Per-game: chains-per-level, avg chain length, ended-by-cap flag, per-turn metric trends, turn-30 board snapshot | A.3 schema additions | schema-revised, pending Evan lock |
| Paired-seed difference statistics (95% CI on per-cell d1−random, d3−random, d3−d1) | helper functions in `scripts/study-skill-depth.ts` | A.4–A.5 demonstrated |
| Reproduce any specific game from `(config, strategy, strategySeed)` | byte-identical | property-tested |
| 10×10 two-axis matrix sweep × 1000 games (random) | ~10 min | works via 10 sweep calls (no `MatrixSweepResult` schema yet) |

A typical playtest loop — *"does ruleK=2 vs 3 with greedy strategy meaningfully change median game length?"* — is now ~30 s. That kind of question used to require either no real data (developer intuition) or hours of waiting (the original Phase 0 sweep had ±42% variance, so any difference under ~50% was undetectable).

---

## What we can't analyze today, and why

| Question | Blocker | Effort to unblock |
|---|---|---|
| **"How does N-move look-ahead change max tile?"** | ~~No strategy clones state and looks ahead.~~ **Unblocked (A.1, A.2).** `cloneFast` ships; `searchStrategy({depth, width})` ships with `search-d1/d2/d3` registered. | — |
| **"What's the spread between monkey play and skilled play?"** | ~~No paired-seed framework.~~ **Demonstrated in A.4–A.5d.** `scripts/study-skill-depth.ts` runs the full ladder. | — |
| **Sweep `spawnWeights` shape** | `SweepableConfigKey` is single-axis only. The grid sweep in `study-skill-depth.ts` builds custom configs at script level (flat / default / steep) but the canonical `SweepResult`/`MatrixSweepResult` schema doesn't model weight shapes. | Extend the schema with `WeightSweepResult` and a `weightSweep()` runner. **3–4 hours.** |
| **Cross-axis (matrix) sweeps in one call** | Only one-axis is wired today. `study-skill-depth.ts` does its own Cartesian iteration. `MatrixSweepResult` is sketched but not built. | **1–2 hours** for the 2-axis case; trivial generalization. |
| **Look beyond depth 3** | `searchStrategy` accepts arbitrary depth, but the cost grows ~5× per ply at width=5 — d6 would be ~600 ms × 5³ = several seconds/game on default config. Per Evan's playtest read, no human looks past d3, so we cap there. | Out of scope until a design reason emerges. |
| **Browser-side sweeps from the tuning console** | No worker, no UI. Sim runs Node-side only today. | Phase 4 territory: worker pool + IPC. **2–3 days** including SharedArrayBuffer / COOP-COEP setup. |
| **Inverse queries** (*"what config produces a max tile of 1024 in 80% of games?"*) | Schema supports it but no solver UI. | Data is queryable today via plain JS scans. A friendly Design Intent Solver UI is its own multi-day project. |

---

## The new ceiling

In order of how soon each bites:

**1. Strategy compute, not kernel compute.** A 7×6 board has ~30 legal 2-chain starts mid-game. A bounded DFS exploring extensions to depth 6 (≈8⁴ branches per start) is ~120K branches/turn. At today's per-turn rate that's seconds per turn — minutes per game — hours per sweep. Long-chain strategies need aggressive pruning (beam search, alpha-beta-style cutoffs), not just more compute.

**2. Statistical resolution.** 1000 games gives ~3% confidence intervals on means. Detecting a 1% game-length difference between two configs needs ~10× the sample size, i.e., 10,000 games. That's still ~1 minute on random, ~3 minutes on heuristic. Tractable but no longer instant — and matrix sweeps multiply through.

**3. Single-thread.** Everything runs on one core. A 50×50 matrix sweep (2,500 cells × 1,000 games × 18ms heuristic) = ~12 hours. Workers (Phase 4) push that to ~1.5 hours on 8 cores. Beyond ~3D parameter spaces you genuinely need parallelism.

**4. JS-level allocation walls.** Most allocation has been driven out of the kernel hot path; remaining costs are in strategy enumerators (`enumerateLegalPairsFast` allocates per turn) and the per-game `fromPure(createGame(...))` startup. Eliminating those gets ~2× per game. Beyond that, V8 itself is the floor — WASM would push further but is a much bigger project.

**5. Memory at sweep scale.** A `GameResult` is ~600 bytes (mostly histograms). 10,000 games × 100 sweep cells = 600 MB if you keep raw results; the analyzer aggregates them away by default, but inverse queries that want raw per-game data hit RAM walls.

---

## What was overcome vs. what remains

| Was a blocker | Status |
|---|---|
| 1000-game sweep took 47 s with ±42% variance | **Solved.** 5.7 s with ±0.5% variance. |
| O(T²) cumulative event log accumulating per turn | **Solved.** `recordEvents: false` opt-in; sim path skips it entirely. |
| Per-cell `{value, retired}` allocations on every state mutation | **Solved.** `Uint8Array` board, in-place mutation. |
| `createGame` could spend 4200 setTile calls on adversarial seeds | **Solved.** Single fill + deterministic injection. |
| String-keyed `Set`s for cell membership | **Solved.** `Set<number>` with packed integer keys. |
| Pure↔fast surface drift risk | **Tested.** 30-game equivalence + 50-seed createGame comparison; can be regressed any time. |
| Strategies that produce long chains | **Solved.** `searchStrategy` enumerates length-2 and length-3 chains; deeper-search variants pick chains based on look-ahead. |
| Look-ahead / multi-ply search | **Solved (A.1, A.2).** `cloneFast` + `searchStrategy({depth, width})` + `search-d1/d2/d3` registered. |
| Per-game schema fields for skill-depth analysis | **Solved (A.3).** `chainsPerLevel`, `avgChainLength`, `endedByTurnCap`, `metricsByTurn`, `boardSnapshotTurn30` shipped; aggregate gains `meanChainsPerLevel`, `meanChainLength`, `pctEndedByCap`. |
| Paired-seed comparison runner | **Solved.** `scripts/study-skill-depth.ts` runs paired-seed `random + d1 + d3` across arbitrary cell grids and emits markdown reports with 95% CIs. |
| **`spawnWeights` as a sweep axis** | **Workaround in scripts/.** `study-skill-depth.ts` builds {flat, default, steep} weight maps directly. Canonical `WeightSweepResult` schema still TODO. |
| **Cross-axis sweeps in one canonical call** | **Workaround in scripts/.** `study-skill-depth.ts` iterates Cartesian products. Canonical `MatrixSweepResult` schema still TODO. |
| **Worker parallelism** | **Deferred (Phase 4).** Single-threaded today. The skill-depth study used 7.4 min single-threaded for the 54-cell × 50-game × 3-strategy grid; workers would push that to ~1 min. |
| **Pure↔fast unified surface** | **Deferred (Phase 2.7).** Two implementations until then. |

---

## Next-phase ramp

Sorted by ROI for getting more realistic data. Numbers are wall-clock estimates assuming one focused engineer.

| # | Work | Cost | Status |
|---|---|---|---|
| 1 | `cloneFast(state)` helper — `Uint8Array.slice` + scalar copy | ½ day | **DONE (A.1)** |
| 2 | Beam-search look-ahead strategy `searchStrategy({depth, width})` | 1 day | **DONE (A.2)** |
| 3 | Schema fields for skill-depth analysis (chainsPerLevel, avgChainLength, endedByTurnCap, metricsByTurn, boardSnapshotTurn30) | ½ day | **DONE (A.3)** |
| 4 | Skill-depth study runner + reports | 1 day | **DONE (A.4–A.6)**; see `studies/01-skill-depth-spread.md` |
| 5 | `MatrixSweepResult` for 2-axis sweeps (canonical, vs. script-level) | ½ day | TODO — script-level workaround in place |
| 6 | `WeightSweepResult` for spawn-weights | ½ day | TODO — script-level workaround in place |
| 7 | Phase 2.7 — replumb pure on top of fast | 1 day | TODO — architectural cleanup |
| 8 | Phase 4 — worker parallelism | 2–3 days | TODO — only when matrix-sweep volumes demand it |
| 9 | Phase 1.5 follow-ups from study (cap-extension experiment, ruleK-collapse investigation, tighter CIs on top-spread cells) | ~2 hr CPU + ½ day code | **NEXT** — see `studies/01-skill-depth-spread.md` §"Phase 1.5 plan" |

**Recommended next sprint: item 9 (Phase 1.5 follow-ups).** ~2 CPU-hours plus a half-day of script extension. Resolves the "is the 50-turn cap masking depth?" and "is ruleK k=2 vs k=3 actually different?" open questions surfaced by A.5d.

---

## Open dependencies on Evan

The capabilities above land contingent on these approvals (all currently Proposed):

- **ADR-0002** (sim-fast surface) — `docs/engineering/adr/0002-sim-fast-kernel.md`
- **`SIM_HARNESS_SCHEMA.md`** — schema lock before any new schema-shaped types ship
- **Heuristic weights** (`TIER_WEIGHT=1.0`, `LENGTH_WEIGHT=0.25`) — per `strategies/README.md`
- **`PERF_BASELINE.md`** — Architecture-Agent path

Items 1–5 in the ramp are safe to start without these approvals — they don't touch the public API or the schema. Items 3 and 4 (`MatrixSweepResult`, `WeightSweepResult`) DO need a follow-up schema amendment, so save those for after schema lock.

---

## Revisit conditions

This document gets refreshed when:
- A new strategy is added (long-chain, look-ahead) — its capability/limit row joins the table
- A schema extension lands (`MatrixSweepResult`, `WeightSweepResult`) — moves the corresponding row from "can't" to "can"
- Phase 4 (workers) lands — collapses the single-thread row in the ceiling section
- The reference machine changes — every wall-clock number above is reference-machine specific
