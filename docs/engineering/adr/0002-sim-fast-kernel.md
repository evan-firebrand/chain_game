# ADR-0002: Sim-Fast Kernel Surface (Uint8Array)

**Status:** Proposed (pending Evan approval)
**Date:** 2026-04-29
**Deciders:** Evan Luckey, Architecture Agent

Supersedes nothing. Coexists with ADR-0001.

---

## Context

ADR-0001 established the pure functional `game-kernel` as the single source of truth for game logic. After Phase 1 of the perf plan, the kernel can run a 1000-game random-strategy sweep in **12.55 s** (mean, ±2.8% RME) — comfortably under the Phase 5 60-second gate.

Two forces still compress the headroom:

1. **Phase 5's gate is "1000 games <60s" but is also stated against the *real* strategies** (random, greedy, heuristic). Greedy and heuristic walk longer chains and produce longer games; expect 2-3× the per-game cost of the random walker. At 12.5 s for random, a 3× heuristic factor lands at ~37 s — still under 60 s, but with much less margin once configurable parameter sweeps are added on top.

2. **Phase 6+ work (parameter sweeps, Design Intent Solver) will run sweeps of sweeps**: hundreds or thousands of 1000-game sweeps. At 12.5 s × 1000 sweeps = ~3.5 hours per inverse-query session. That's a workflow blocker, not a UX wart.

The remaining cost in the kernel is structural, not a fixable hot spot:

- Every state mutation allocates a fresh `Tile[][]` board of frozen objects. We've trimmed the per-tile allocation but not the per-cell-array overhead.
- Each `Tile` is a `{value, retired}` object: 4-12 bytes of payload wrapped in a 32-48 byte JS object header.
- The pure functional contract (`(state, action) → newState`) requires returning new state, which requires copying.

A flat `Uint8Array(rows * cols)` representation, with one byte per cell encoding `log2(value)` (4 bits) + `retired` (1 bit), is roughly 50× denser, allocates zero per-cell objects, and supports in-place mutation between turns. The performance gap is large enough that no amount of incremental immutable-API tuning will close it.

---

## Decision

Add a parallel **sim-fast kernel surface** at `src/game-kernel/fast/` that:

1. **Stores board state in a flat `Uint8Array`.** Bit-packed encoding: 4 bits for `log2(value)` (0 = empty, 1..13 = `2^1` through `2^13` = 2..8192), 1 bit for `retired`, 3 bits reserved.
2. **Mutates in place.** `applyChainInPlace(state, chain)` mutates rather than returning new state. State carries pre-allocated scratch buffers reused across turns and across games.
3. **Skips `validateChain` on a trusted-move path.** Strategies are responsible for legality. A `DEBUG`-time validation wrapper exists for tests but is not in the hot path.
4. **Records no events by default.** Per-turn deltas are surfaced via out-params or a struct-of-arrays stats accumulator owned by the caller.
5. **Inlines the LCG** in hot loops; avoids function-call overhead for `lcgNext`/`lcgFloat`.

The pure immutable surface (`src/game-kernel/index.ts`) stays unchanged for `game-session`, `ui`, and `tuning-console`. After the equivalence property test (Phase 2.6 in the perf plan) passes, the pure `applyAction` will be reimplemented as a `pure → fast → freeze` adapter so there's a single source of truth for game rules going forward.

`sim-harness` imports the fast surface directly. The boundary check (`scripts/check-boundaries.js`) is unchanged: `fast/` is inside `game-kernel`.

---

## Options Considered

### Option A: Sim-fast surface (this decision)

Add a parallel high-throughput surface. Re-route the pure API to it once equivalence is proven.

Pros:
- 1000-game sweep targeted at <2 s, 25-30× faster than today.
- Single source of truth preserved (after the replumb).
- `game-session`/`ui` see no API change; existing tests, hooks, integrations untouched.
- Fast surface is correct by construction relative to the pure surface (equivalence property test gates the replumb).
- Heuristic strategies and parameter sweeps become tractable for the first time.

Cons:
- Largest single architectural addition since ADR-0001. Requires careful staging (encoding → state → primitives → integration → equivalence proof → replumb).
- Bit-packed encoding requires unit tests for round-trip correctness; mistakes here corrupt board state silently.
- Maintaining two implementations during the staged rollout is extra mental load until 2.7 lands.

### Option B: Continue tuning the pure immutable kernel

Apply more of the same Phase 1 patterns: more caching, more per-config precompute, smarter allocation reuse.

Pros:
- No new architecture.
- Lower review burden.

Cons:
- Diminishing returns. Phase 1 already chased the high-value patterns. The remaining cost is structural — per-turn allocation is fundamental to immutable functional state.
- Optimistically maybe another 1.5-2× from this approach. Not enough to make Phase 6+ workflows tractable.
- Doesn't unlock the much larger speedup that bit-packed mutable state allows.

### Option C: Web Workers / parallelism

Skip storage-layer work; throw cores at the problem.

Pros:
- Linear scaling with core count, free with worker_threads (Node) or Worker (browser).

Cons:
- Doesn't reduce single-thread cost — each worker still spends the same compute per game.
- IPC and serialization costs eat into the win for short games.
- Browser parallelism requires SharedArrayBuffer + COOP/COEP headers — complicates the tuning console.
- Can be added on top of Option A later (Phase 4 of the perf plan); Option A on its own already meets the targets.

### Option D: Replace the pure kernel outright with the fast surface

Skip the parallel-surface stage. Move directly to `Uint8Array` everywhere.

Pros:
- One implementation.

Cons:
- Highest-risk change in the project. No safety net during the migration.
- `ui` and `game-session` get an API churn unrelated to their actual feature work.
- Loses the ability to property-test the new implementation against the old.
- Public API tightening (immutable boundaries between turns) is harder to express on top of a mutable layer.

---

## Rationale

Option A is the path of lowest risk to the highest payoff:

- It preserves the public contract every external consumer relies on.
- It uses the existing immutable surface as the equivalence oracle for the new fast surface — the equivalence property test catches behavioral drift the way no unit test could.
- It contains the architectural change to a new subdirectory, leaving the rest of the kernel alone.
- The end state is one source of truth: the fast surface, with the pure surface as a thin adapter.

The "single source of truth" principle from ADR-0001 is preserved, just relocated. After 2.7 lands, all game logic still lives in `src/game-kernel/` and nowhere else; what changed is the storage representation that logic operates over.

---

## Consequences

**Easier:**
- 1000-game sweeps run in seconds, not tens of seconds.
- Heuristic strategies become tractable for serious sweeps (Phase 3).
- Parameter sweeps at scale are reasonable (Phase 6+).
- Memory pressure during sweeps drops by ~50× (Uint8Array vs. object-array).

**Harder:**
- Encoding correctness is now a load-bearing concern. Round-trip tests for `Tile ↔ packed byte` and `GameState ↔ FastState` are mandatory.
- The fast surface's per-primitive functions mutate. Anyone reading `fast/` code must internalize that — comments and naming (`...InPlace`) carry that load.
- Two implementations during 2.1-2.6, single implementation after 2.7.

**Off the table:**
- Public API on `src/game-kernel/index.ts` does NOT change as part of this ADR. Any change there still requires its own ADR.
- The fast surface is NOT a public export. Only `sim-harness` (and the pure-API adapter, post-2.7) import from `fast/`.
- We do NOT skip the equivalence property test. Step 2.6 is a hard gate before 2.7 lands.

---

## Enforcement

- Boundary rule (existing): `sim-harness` imports only from `game-kernel`. The fast surface lives inside `game-kernel`, so this rule needs no change.
- `tests/game-kernel/fast/equivalence.test.ts` (added in 2.6) is the gate before 2.7 (the pure-surface replumb) lands.
- The pure-API surface in `src/game-kernel/index.ts` remains the public contract; no consumer outside `sim-harness` and the pure-surface adapter touches `fast/` directly.

---

## Revisit Conditions

Revisit the encoding (1 byte/cell, 4-bit value, 1-bit retired, 3 reserved) when:
- A future spec change pushes max tile beyond 8192 (would need 5+ bits of value).
- A future feature needs additional per-cell state beyond `retired`.

Revisit the in-place-mutation choice when:
- A consumer outside `sim-harness` and the pure-API adapter needs the fast surface (none planned today).
- A profiling pass after Phase 3 reveals that allocation isn't actually the dominant cost (very unlikely).

Revisit the parallel-surface vs. unified-surface choice if:
- Step 2.7 (the pure → fast replumb) reveals an integration cost that isn't worth the single-source-of-truth benefit. Mitigation: keep the parallel surfaces and accept the dual-implementation maintenance cost.
