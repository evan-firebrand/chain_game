# Sim-Harness Capabilities & Next-Phase Ramp

**Status:** Architecture-Agent draft — captures the post-Phase-3 capability snapshot and the prioritized work list for the next phase of harness/strategy development. Pending Evan approval per CLAUDE.md.

This document is a companion to:

- `PERF_BASELINE.md` — the numeric record of what each phase achieved
- `SIM_HARNESS_SCHEMA.md` — the data shape the harness produces
- `ARCHITECTURE.md` — the module diagram and phase gate criteria
- `adr/0002-sim-fast-kernel.md` — the storage-layer decision

It exists because "Phase 5 gate met" doesn't tell you *what kinds of analyses are now tractable*. This doc does.

---

## TL;DR

We can now run real sweeps on every numeric config knob. The kernel and harness are no longer the bottleneck. **The remaining gap to "real-world playtest analysis" is in the strategies, not the engine.** All three current strategies cap chains at length 2–3 and none look ahead. ~4–6 days of focused work bridges the gap.

---

## What we can analyze today

| Question | Time on the reference machine | Confidence |
|---|---|---|
| Run 1000 games at one config (any strategy) | 5.7–18.3 s | high (RME 0.5–3%) |
| Vary `prngSeed` / `ruleK` / `gridRows` / `gridCols` / `spawnPoolMin` / `spawnPoolMax` across N values | ~5–18 s × N | high |
| Compare three strategies on the same config | ~40 s | high |
| Get distributions: game length p10/p50/p90, max tile, chain length & result histograms, death cause | included in `AggregateResult` | schema-stable |
| Reproduce any specific game from `(config, strategy, strategySeed)` | byte-identical | property-tested |
| 10×10 two-axis matrix sweep × 1000 games (random) | ~10 min | works via 10 sweep calls (no `MatrixSweepResult` schema yet) |

A typical playtest loop — *"does ruleK=2 vs 3 with greedy strategy meaningfully change median game length?"* — is now ~30 s. That kind of question used to require either no real data (developer intuition) or hours of waiting (the original Phase 0 sweep had ±42% variance, so any difference under ~50% was undetectable).

---

## What we can't analyze today, and why

| Question | Blocker | Effort to unblock |
|---|---|---|
| **"How do long chains affect outcomes?"** | All three strategies cap chain length at 2–3. The kernel handles chains up to 42 cells; no strategy emits them. | New strategy. **1–2 days** for beam-search "long-chain" with bounded width+depth. Bench cost likely 5–20× current heuristic; still well under the 60s gate for 1000 games. |
| **"How does N-move look-ahead change max tile?"** | No strategy clones state and looks ahead. `FastState` has no cheap clone yet. | `cloneFast(state)` is one `Uint8Array.slice` + scalar copy — **½ day**. 1-ply look-ahead strategy: **1 day**. 2-ply: **2–3 days** + perf work to stay under the gate. |
| **Sweep `spawnWeights` (the whole map)** | `SweepableConfigKey` excludes it; it's an object, not a number. SIM_HARNESS_SCHEMA flags this as out-of-scope for v1. | Extend the schema with `WeightSweepResult` + `weightSweep()` runner. **3–4 hours.** |
| **Cross-axis (matrix) sweeps in one call** | Only one-axis is wired today. `MatrixSweepResult` is sketched but not built. | **1–2 hours** for the 2-axis case; trivial generalization. |
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
| **Strategies that produce long chains** | **Still a limit.** All three cap at length 3. |
| **Look-ahead / multi-ply search** | **Still a limit.** No strategy clones state. |
| **`spawnWeights` as a sweep axis** | **Still a limit.** Schema excludes it; needs separate type. |
| **Cross-axis sweeps in one call** | **Still a limit.** One-axis only today. |
| **Worker parallelism** | **Deferred (Phase 4).** Single-threaded today. |
| **Pure↔fast unified surface** | **Deferred (Phase 2.7).** Two implementations until then. |

---

## Next-phase ramp

Sorted by ROI for getting more realistic data. Numbers are wall-clock estimates assuming one focused engineer.

| # | Work | Cost | Unlocks |
|---|---|---|---|
| 1 | `cloneFast(state)` helper — `Uint8Array.slice` + scalar copy | **½ day** | Foundation for everything below. Required for look-ahead, beam search, branch exploration. |
| 2 | Long-chain strategy — beam search width 8, depth 6 | **1–2 days** | Single biggest "real-world" gap. Without it, every stat we report is "what 2–3 chain strategies do". |
| 3 | `MatrixSweepResult` for 2-axis sweeps | **½ day** | Unblocks "how does ruleK × spawnPoolMax interact" questions. |
| 4 | `WeightSweepResult` for spawn-weights | **½ day** | Unblocks the most game-design-interesting axis. |
| 5 | 1-ply look-ahead strategy (after `cloneFast`) | **1 day** | Different game shape than greedy/heuristic; useful baseline for "does any look-ahead matter". |
| 6 | Phase 2.7 — replumb pure on top of fast | **1 day** | Architectural cleanup, not perf. Worth doing before adding more strategies because every strategy uses both surfaces during testing. |
| 7 | Phase 4 — worker parallelism | **2–3 days** | Only when matrix-sweep volumes demand it. Overkill today. |

**Recommended next sprint: items 1 + 2 + 3.** Three days of work. That's the difference between *"we benchmarked the kernel"* and *"we can run real playtests"*.

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
