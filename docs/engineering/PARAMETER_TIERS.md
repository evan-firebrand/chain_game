# Parameter Tiers

**Status:** PROPOSED — Evan approval required (per CLAUDE.md "What Requires Evan's Approval" #3).
**Owner:** Architecture Agent · **Phase introduced:** 3 (Tuning Console).

## Purpose

Defines which `GameConfig` knobs Evan can turn, when each takes effect, and the enforcement boundary between them. The Tuning Console (`src/tuning-console/`) wires sliders to Tier 1 only; Tier 2 changes apply via `[New Game]`; Tier 3 is code-only.

## Tier table

| Tier | Effect of change | Surfaced in | Enforced by |
|---|---|---|---|
| **1 — Live** | Applies on next chain commit / next spawn | Tuning Console live sliders | `GameSession.updateConfig` accepts these keys |
| **2 — Restart** | Requires a new game; mid-session change rejected | Tuning Console "advanced" group + `[New Game with these settings]` button | `GameSession.updateConfig` THROWS on these keys; only `dispatch({kind:'new-game', config})` applies them |
| **3 — Code** | Editing source only | Not exposed | Not in `GameConfig` |

## Tier 1 — Live tunables

Mid-game change is safe because `rules.ts` reads `config.ruleK` per chain commit (`src/game-kernel/rules.ts:14-22`) and `board.ts` / `index.ts` read `config.spawnWeights` per spawn — no cached/derived state.

| Key | Type | Range | Step | Default | Notes |
|---|---|---|---|---|---|
| `ruleK` | int | 0 – 8 | 1 | 2 | Rule D divisor: `result = lastValue × 2 × 2^⌊sameExt/k⌋`. k=0 is a degenerate edge — the slider permits it for experimentation; the kernel handles it via integer floor (test before shipping). |
| `spawnWeights[2]`   | number | 0 – 256 | 1 | 128 | Raw weight for tier 2 |
| `spawnWeights[4]`   | number | 0 – 256 | 1 | 64  | |
| `spawnWeights[8]`   | number | 0 – 256 | 1 | 32  | |
| `spawnWeights[16]`  | number | 0 – 256 | 1 | 16  | |
| `spawnWeights[32]`  | number | 0 – 256 | 1 | 8   | |
| `spawnWeights[64]`  | number | 0 – 256 | 1 | 4   | |
| `spawnWeights[128]` | number | 0 – 256 | 1 | 2   | |
| `spawnWeights[256]` | number | 0 – 256 | 1 | 1   | |

**Spawn weight semantics:** raw, NOT normalized. `pickTileValue` (`src/game-kernel/board.ts:82-117`) sums weights and draws via cumulative threshold — any non-negative scale works. Console shows derived `≈ %` per slider for UX only.

**All-zero edge case:** if every weight is 0, `pickTileValue` returns `spawnPoolMin` (kernel guard at `board.ts:101-104`). Console warns visually but does not block.

## Tier 2 — Restart tunables

Apply via `dispatch({kind:'new-game', config})`. `GameSession.updateConfig` rejects these keys with a thrown Error.

| Key | Type | Range | Step | Default | Notes |
|---|---|---|---|---|---|
| `gridRows` | int | 4 – 9 | 1 | 7 | Board height; `Row` literal type currently caps at 6 (`src/game-kernel/types.ts:6`) — exposing >7 requires widening that type in a follow-up. Console caps at 7 for now. |
| `gridCols` | int | 4 – 9 | 1 | 6 | Board width; `Col` literal type caps at 5 — same caveat as above. Console caps at 6 for now. |
| `prngSeed` | int | any finite | 1 | 0 | Seed for the LCG. `[Randomize]` button writes `Math.floor(Math.random() * 2^31)`. Identical seed + identical config = identical playthrough. |
| `spawnPoolMin` | TileValue | 2 – 256 (powers of 2) | × 2 | 2 | Lowest tier in the spawn pool. Must be ≤ `spawnPoolMax`. Not exposed in Phase 3 UI (deferred — the existing pool is fine for v1 design). |
| `spawnPoolMax` | TileValue | 2 – 256 (powers of 2) | × 2 | 256 | Highest tier in the spawn pool. Same as above. |

**Phase 3 UI exposure:** `gridRows`, `gridCols`, `prngSeed` are surfaced behind a `[Show advanced]` toggle. `spawnPoolMin/Max` remain in the JSON export schema but no slider — adjust via `[Apply from textarea]` only.

**Row/Col type caveat:** `Row` and `Col` are union literal types (`src/game-kernel/types.ts:6-7`). The console caps `gridRows` at 7 and `gridCols` at 6 to avoid creating out-of-type cells. Widening is a separate kernel-typed task (file as design-question if needed in Phase 4+).

## Tier 3 — Code-only constants

Settled design commitments. Not in `GameConfig`. Changing requires editing kernel source + ADR.

| Constant | Where | Why fixed |
|---|---|---|
| Adjacency model: 8-way (king moves) | `src/game-kernel/chain.ts:7-20` (`getAdjacentCells`) | Foundational to chain mechanic; design locked. |
| Chain-start rule: same-value adjacent pair | `src/game-kernel/index.ts:197-219` (in `validateChain`) | Spec invariant — see `docs/Merge_Game_Specification.md`. |
| Extension rule: same OR doubling | `src/game-kernel/chain.ts:28-39` (`validateChainExtension`) | Spec invariant. |
| Result formula structure: `lastValue × 2 × 2^⌊s/k⌋` | `src/game-kernel/rules.ts:14-22` | Only `k` is tunable; the formula shape is fixed. |
| PRNG: LCG (1664525, 1013904223) | `src/game-kernel/board.ts:7-9` and `index.ts:48-50` | Deterministic, reproducible. Seed is Tier 2; algorithm is Tier 3. |

## Enforcement

1. `GameSession.updateConfig(patch)` (Phase 3+): merges Tier 1 keys into `state.config`; throws on any Tier 2 key. ADR 0002 records this contract.
2. `GameSession.dispatch({kind:'new-game', config})` is the ONLY path to apply Tier 2 changes — restarts the game cleanly.
3. Tier 3 constants are not in `GameConfig` and have no runtime path to mutation.

## JSON export schema

`exportConfig(config)` returns `JSON.stringify(config, null, 2)`. Schema mirrors `GameConfig`:

```json
{
  "gridRows": 7,
  "gridCols": 6,
  "ruleK": 2,
  "spawnPoolMin": 2,
  "spawnPoolMax": 256,
  "spawnWeights": {
    "2": 128, "4": 64, "8": 32, "16": 16,
    "32": 8, "64": 4, "128": 2, "256": 1
  },
  "prngSeed": 0
}
```

`importConfig(json)` validates each field per the ranges in this document. Out-of-range values throw with a `field` property identifying the offending key.

## Change protocol

Adding a new Tier 1 parameter requires Evan approval (CLAUDE.md). Promoting a Tier 2 → Tier 1 (or demoting) requires an ADR — the kernel must be re-audited for cached/derived state before promotion.
