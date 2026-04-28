# Architecture

## Module Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        game-kernel                          │
│  (pure TypeScript, zero dependencies, deterministic)        │
│                                                             │
│  types.ts    chain.ts    board.ts    rules.ts    retirement.ts │
│       └──────────────────────────────────────────┘          │
│                       index.ts (re-exports only)            │
└────────────────────────────┬────────────────────────────────┘
                             │ imported by
            ┌────────────────┴────────────────┐
            │                                 │
  ┌─────────▼──────────┐           ┌──────────▼──────────┐
  │    game-session     │           │     sim-harness     │
  │  session.ts         │           │  runner.ts          │
  │  events.ts          │           │  sweep.ts           │
  └─────────┬──────────┘           │  analyzer.ts        │
            │ imported by           │  strategies/        │
    ┌───────┴────────┐             └─────────────────────┘
    │                │
  ┌─▼──────┐  ┌──────▼──────────┐
  │   ui   │  │ tuning-console  │
  │ app.ts │  │ console.ts      │
  │board.ts│  │ controls.ts     │
  │input.ts│  │ config-export.ts│
  │ hud.ts │  └─────────────────┘
  └────────┘
```

## Module Ownership

| Module | Agent | Notes |
|---|---|---|
| `src/game-kernel/` | Game Logic Agent | Zero external imports. Architecture Agent reviews all API changes. |
| `src/game-session/` | Game Logic Agent | Thin wrapper. Architecture Agent reviews events.ts |
| `src/ui/` | UI Agent | Imports game-session only. |
| `src/tuning-console/` | UI Agent | Imports game-session only. |
| `src/sim-harness/` | Simulation Agent | Imports game-kernel only. |
| `tests/` | Test Agent | Imports only from the module under test. |
| `docs/engineering/` | Architecture Agent | Evan approves all. |
| `docs/` (top-level) | Evan only | Agents read; never write. |

---

## The Pure Kernel Constraint

See ADR-0001. This is the single most important architectural decision in this project.

`game-kernel` is a pure functional module:
- All functions take state and config as arguments and return new state.
- No side effects. No DOM. No network. No filesystem.
- No `Math.random()` — seeded PRNG is passed via `GameConfig`.
- No `Date.now()` — time is irrelevant to game logic.
- `GameState` is a plain JSON-serializable object: no class instances, no functions, no Dates.

This design makes it possible for `game-session` (playable game), `sim-harness` (headless batch runner), and any future tool to share identical, verified game logic.

---

## Event Instrumentation Architecture

`game-session` emits events after every state transition. Events are the integration surface between game logic and all consumers (UI rendering, Tuning Console parameter display, Simulation Harness data collection).

Every event includes:
- `type`: the event kind (chain-resolved, tile-spawned, retirement-fired, game-over, etc.)
- `state`: the full `GameState` snapshot after the transition
- `config`: the `GameConfig` in effect at the time
- `turn`: the turn number

This verbosity is intentional. The Simulation Harness needs full state snapshots per turn for statistical analysis. The Tuning Console needs config snapshots to display current parameter values.

---

## Phased Build Sequence

| Phase | Goal | Gate criteria |
|---|---|---|
| **0 — Foundation** | Contracts + scaffolding. No code. | CLAUDE.md, KERNEL_INTERFACE.md merged + approved; CI green |
| **1 — game-kernel** | Pure logic module, 100% tested | T1-T8b pass; 100% coverage; 1000 random games zero-crash |
| **2 — Playable v1** | Browser game, 30+ min Endless | Evan plays 30 min without crash; zero logic in UI |
| **3 — Tuning Console** | Live parameter adjustment | Tier 1 params work; JSON export/import round-trips |
| **4 — v1.5 Retirement** | Tile retirement active | First retirement at 512; emergent blocker verified |
| **5 — Sim Harness** | Batch runner + strategies | 1000 games in <60s; deterministic; schema approved |
| **6 — v2 Content** | Layer 2 special tiles | Design Agent spec → Evan approval → then engineering |
| **7 — v2.5 Juice** | Aesthetic identity | Animation, sound, visual identity |
| **8+ — Modes** | Levels, Ascension, Drift | One mode at a time; each gated by prior |

**Each phase is a gate.** Do not begin Phase N+1 until Phase N gate criteria are verified and filed in a `phase-gate` GitHub issue closed by Evan.

---

## Branch Strategy

```
main              ← protected; Evan-only merge; deploys to production
  └── develop     ← integration branch; all agent PRs target this
        ├── feat/kernel-phase1
        ├── feat/ui-phase2
        ├── feat/tests-phase1
        ├── feat/sim-harness
        └── fix/[issue-number]-[description]
```

Rules:
- All feature branches are cut from `develop`, never from another feature branch.
- Agents never push directly to `develop` or `main`.
- Every task lands in a PR. No direct commits.

---

## Testing Thresholds by Phase

| Phase | Coverage requirement |
|---|---|
| 1 (game-kernel) | 100% — no exceptions |
| 2 (game-session) | 90%+ |
| 3 (tuning-console) | 80%+ |
| 4 (retirement) | 100% of retirement.ts |
| 5 (sim-harness) | 80%+ |
| All UI code | Integration tests; unit coverage not enforced |

---

## CI Pipeline (all checks required to merge)

1. `tsc --noEmit` — zero TypeScript errors
2. ESLint strict — zero lint errors
3. `vitest run` — all tests pass
4. Coverage thresholds met
5. Dependency boundary check — import graph validates against module rules
6. Bundle size report (informational, not blocking)
