# Folder Structure

Canonical path map with ownership and purpose. Every path listed here is intentional.

---

## Root

| Path | Owner | Purpose |
|---|---|---|
| `CLAUDE.md` | Architecture Agent (Evan approves) | Agent orientation; read first every session |
| `index.html` | UI Agent | Browser entry point |
| `package.json` | Architecture Agent | Dependencies + scripts |
| `tsconfig.json` | Architecture Agent | TypeScript config (strict) |
| `vitest.config.ts` | Architecture Agent | Test runner config |
| `.eslintrc.json` | Architecture Agent | Lint rules |
| `.gitignore` | Evan | Already exists |

---

## `docs/` — Design Documents (Evan-owned)

Agents read these files. Agents never write to them.

| File | Purpose |
|---|---|
| `Game_Design_Concepts.md` | Design vocabulary, frameworks, rejected ideas |
| `Merge_Game_Specification.md` | **Current settled game contract** — the game rules |
| `Merge_Game_Design_Journal.md` | Decision log; includes T1-T8b mandatory test vectors |
| `Merge_Game_Tooling_Specification.md` | Tooling spec (Tuning Console, Sim Harness, Intent Solver) |
| `Merge_Game_Tooling_Journal.md` | Tooling decision log |
| `swarm_framework.md` | Multi-agent ideation framework for design phases |
| `swarm_prompts.md` | Copy-paste prompt templates for design swarm agents |

---

## `docs/engineering/` — Engineering Documents (Architecture Agent, Evan approves)

| File | Purpose |
|---|---|
| `ARCHITECTURE.md` | Module diagram, ownership, phase sequence, CI pipeline |
| `KERNEL_INTERFACE.md` | **Load-bearing TypeScript contracts** — approve before Phase 1 |
| `FOLDER_STRUCTURE.md` | This file |
| `PARAMETER_TIERS.md` | Tier 1/2/3 parameter assignments for Tuning Console (Phase 3) |
| `SIM_HARNESS_SCHEMA.md` | Simulation output schema (Evan-approved; design before Phase 5 runner) |
| `RETIREMENT_DESIGN_NOTES.md` | Phase 4 retirement implementation notes; spec deviations noted here |
| `PHASE_5_5_REQUIREMENTS.md` | Phase 5.5 design-lab scope and acceptance criteria |
| `PHASE_5_5_FINDINGS.md` | Phase 5.5 smoke results and follow-up actions |

### `docs/engineering/session-briefs/`

Per-agent session context files. Naming: `YYYY-MM-DD-[role]-[task].md`
Created by Architecture Agent or the previous agent handing off work.
Every agent session starts with the relevant brief from this directory.

### `docs/engineering/playtests/`

Evan's playtest notes. Naming: `YYYY-MM-DD-v[version].md`
Created after every play session. Informs design gap protocols and ADR revisit triggers.

### `docs/engineering/puzzles/`

Canned board scenarios used as regression fixtures and study seeds.

### `docs/engineering/studies/`

Multi-pass design investigations (e.g. substrate audit, death-mechanism). Each study has its own writeup; results may feed PHASE_*_FINDINGS or future ADRs.

### `docs/engineering/adr/`

Architecture Decision Records. Naming: `NNNN-short-title.md` (zero-padded 4 digits).

| File | Status | Date |
|---|---|---|
| `0000-tech-stack.md` | Accepted | 2026-04-28 |
| `0001-pure-kernel-module.md` | Accepted | 2026-04-28 |
| `0002-session-update-config.md` | Proposed (Evan approval pending) | 2026-04-28 |

---

## `src/` — Source Code

### `src/game-kernel/` — Game Logic Agent

The single source of truth for all game rules.

| File | Purpose |
|---|---|
| `index.ts` | Public API — re-exports + `applyAction` orchestration |
| `types.ts` | ALL `GameState`, `Action`, `Config`, `Event` types |
| `chain.ts` | Chain validation (start rule, extension rule, adjacency) + chain resolution |
| `board.ts` | Grid operations: `applyGravity`, `spawnTiles`, `setTile`, `removeTiles` |
| `rules.ts` | Rule D k=2: `computeResultValue` |
| `retirement.ts` | Retirement trigger detection and spawn pool advancement (Phase 4) |
| `values.ts` | TileValue helpers: `nextTileValue`, `previousTileValue`, range iteration |

Constraints:
- Zero imports from anywhere in `src/` — self-contained.
- All functions are pure (see ADR-0001).

### `src/game-session/` — Game Logic Agent

Thin stateful wrapper around the kernel.

| File | Purpose |
|---|---|
| `index.ts` | Public re-exports |
| `session.ts` | Creates and manages a game session; calls `applyAction`; emits events |
| `events.ts` | Session-level event type definitions (extends kernel events) |
| `playlog.ts` | Per-turn playlog recorder — feeds `fit-weights` and replay flows |

Constraints:
- Imports from `game-kernel` only.
- Session events include: `{ type, state, config, turn }` — full snapshots, verbose by design.

### `src/ui/` — UI Agent

Rendering and input only. Never computes game logic.

| File | Purpose |
|---|---|
| `app.ts` | Top-level wiring: creates session, mounts board + HUD, handles input |
| `board.ts` | Canvas-based board renderer |
| `input.ts` | Chain input handler (mouse drag / touch path) — MUST be a distinct module |
| `hud.ts` | Score display, tile max, retirement milestone indicator |
| `effects.ts` | Screen pulse, merge burst, conquest celebration animations |
| `geometry.ts` | Canvas grid math (cell-to-pixel and hit testing) |
| `playlog-controls.ts` | UI for downloading the per-turn playlog |
| `theme.ts` | Color tokens for tile tiers and lifecycle phases |

Constraints:
- Imports from `game-session` only.
- `input.ts` is a distinct module so mouse/touch can be swapped without touching rendering.
- All "is this a valid chain extension?" checks call `validateChain` from the kernel via session.

### `src/tuning-console/` — UI Agent

Live parameter adjustment panel. Phase 3.

| File | Purpose |
|---|---|
| `console.ts` | Console panel component; show/hide without affecting game state |
| `controls.ts` | Slider, number input, dropdown widgets for each Tier 1 parameter |
| `config-export.ts` | JSON export/import for current parameter config |

Constraints:
- Imports from `game-session` only.
- Config changes propagate to session via `GameConfig` update events.

### `src/sim-harness/` — Simulation Agent

Headless batch runner. Phase 5 + Phase 5.5 design lab.

| File | Purpose |
|---|---|
| `index.ts` | Public re-exports |
| `runner.ts` | Single-config runner: plays N games, returns results array |
| `sweep.ts` | Parameter sweep: varies one config key across a range |
| `batch.ts` | Matrix runner over named experiment profiles |
| `profiles.ts` | Named experiment configs (`baselinePowerLaw`, `flat`, etc.) |
| `scoring.ts` | Target-distance scoring + candidate labels (`promising`, `too-forgiving`, …) |
| `analyzer.ts` | Statistics extraction from event logs |
| `types.ts` | Output schema types — Evan-approved before runner code is written |
| `strategies/random.ts` | Random-move strategy |
| `strategies/greedy.ts` | Greedy strategy (highest immediate result) |
| `strategies/heuristic.ts` | Heuristic strategy (designed-intent play) |
| `strategies/weighted-heuristic.ts` | Heuristic with tunable feature weights (fit-weights output) |
| `strategies/long-chain.ts` | Constructive long-chain strategies (`longRandomWalk`, `longGreedyWalk`, `milestonePush`) |
| `strategies/archetypes.ts` | `strategicHumanLike` mode-switching strategy + research archetypes |
| `strategies/common.ts` | Shared candidate enumeration and scoring helpers |

Constraints:
- Imports from `game-kernel` only.
- No game logic re-implemented — 100% kernel re-use.
- Results are deterministic given same seed + same config.
- `types.ts` schema is designed to support Design Intent Solver (Stage E) inverse queries.

---

## `tests/` — Test Agent

| Directory | Covers | Coverage requirement |
|---|---|---|
| `tests/game-kernel/` | All `src/game-kernel/` modules | **100%** (gate enforced in CI) |
| `tests/game-session/` | `src/game-session/` | 90%+ |
| `tests/sim-harness/` | `src/sim-harness/` | 80%+ |
| `tests/tuning-console/` | `src/tuning-console/` | covers config-export round-trips |

Test file naming: `[source-file-name].test.ts`

Constraints:
- Tests import only from the module under test.
- No cross-module test imports.
- The T1-T8b test vectors in `tests/game-kernel/rules.test.ts` are written before the implementation (Phase 1 parallel stream B).

---

## `.github/`

| Path | Purpose |
|---|---|
| `workflows/ci.yml` | Required CI checks on every push to `main` and on PRs targeting `main` |
| `ISSUE_TEMPLATE/design-question.md` | For spec gaps hit during implementation |
| `ISSUE_TEMPLATE/bug.md` | For behavior that differs from spec |
| `ISSUE_TEMPLATE/phase-gate.md` | For requesting Evan's phase gate review |
| `pull_request_template.md` | Required PR checklist |
