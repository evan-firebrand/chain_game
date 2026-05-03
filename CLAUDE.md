# Chain Game — Agent Orientation

**Read this file at the start of every session. It is the source of truth for how this project works.**

---

## Project in One Sentence

Chain Game is a browser-based 2D number-merging puzzle game with a path-chain mechanic; the design is complete and the engineering team is now building it in phases, starting with the pure game-logic kernel.

**Current phase:** Phase 3 (Tuning Console) — kernel and playable v1 are complete, Tuning Console is next.

---

## Game Loop (canonical mental model)

The game is a **lifecycle**, not a single arc:

```
Free Play → Friction (retirement fires) → Cleanup (clear retired tiles) → Conquest 🎉
     ↑                                                                          │
     └──────────────────── Loop at higher tier ────────────────────────────────┘
```

- **Conquest** = all retired tiles of a tier cleared before any got stranded. This is the milestone.
- **Failure** = retired tiles became isolated → permanent dead weight on the board. Tier "lost."
- Retirement is the **pressure source**, not a milestone. Triggering it is normal; conquering the resulting cleanup is the achievement.
- Studies of player behavior must allow **adaptive strategies** that switch between Free Play and Cleanup mode. Single-strategy bots cannot represent this loop.

---

## The Prime Directive

> **All game logic lives in `src/game-kernel/` and nowhere else.**

Chain validation, chain resolution, Rule D k=2 math, gravity, spawn tile selection, retirement trigger detection, loss condition detection — every rule of the game is implemented as a pure function inside `game-kernel`. Any pull request that computes game logic outside `game-kernel` is automatically rejected, no exceptions.

---

## Folder Map

```
chain-game/
├── CLAUDE.md                             ← you are here (read every session)
├── index.html                            ← browser entry point
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
│
├── docs/
│   ├── Game_Design_Concepts.md           ← EVAN-ONLY WRITES (design vocabulary)
│   ├── Merge_Game_Specification.md       ← EVAN-ONLY WRITES (current game contract)
│   ├── Merge_Game_Design_Journal.md      ← EVAN-ONLY WRITES (decision log)
│   ├── Merge_Game_Tooling_Specification.md ← EVAN-ONLY WRITES
│   ├── Merge_Game_Tooling_Journal.md     ← EVAN-ONLY WRITES
│   ├── swarm_framework.md                ← EVAN-ONLY WRITES (multi-agent ideation)
│   ├── swarm_prompts.md                  ← EVAN-ONLY WRITES (agent prompt templates)
│   └── engineering/                      ← Architecture Agent writes; Evan approves
│       ├── ARCHITECTURE.md               ← module diagram + dependency rules
│       ├── KERNEL_INTERFACE.md           ← TypeScript interface contracts (load-bearing)
│       ├── FOLDER_STRUCTURE.md           ← canonical path map with ownership
│       ├── PARAMETER_TIERS.md            ← which parameters are Tier 1/2/3
│       ├── SIM_HARNESS_SCHEMA.md         ← simulation output schema
│       ├── RETIREMENT_DESIGN_NOTES.md    ← created when Phase 4 lands
│       ├── session-briefs/               ← per-agent task context files
│       ├── playtests/                    ← Evan's playtest notes
│       └── adr/                          ← Architecture Decision Records
│           ├── 0000-tech-stack.md
│           └── 0001-pure-kernel-module.md
│
├── src/
│   ├── game-kernel/          ← Game Logic Agent owns
│   │   ├── index.ts          ← PUBLIC API ONLY (re-exports, no logic here)
│   │   ├── types.ts          ← ALL GameState / Action / Config types
│   │   ├── chain.ts          ← chain validation + resolution
│   │   ├── board.ts          ← grid ops, gravity, tile spawn
│   │   ├── rules.ts          ← Rule D k=2 implementation
│   │   └── retirement.ts     ← stub in Phase 1; fully implemented in Phase 4
│   │
│   ├── game-session/         ← Game Logic Agent owns
│   │   ├── session.ts        ← wraps kernel calls, maintains session state, emits events
│   │   └── events.ts         ← event type definitions
│   │
│   ├── ui/                   ← UI Agent owns
│   │   ├── app.ts
│   │   ├── board.ts
│   │   ├── input.ts          ← MUST be a distinct module (swappable mouse/touch)
│   │   └── hud.ts
│   │
│   ├── tuning-console/       ← UI Agent owns
│   │   ├── console.ts
│   │   ├── controls.ts
│   │   └── config-export.ts
│   │
│   └── sim-harness/          ← Simulation Agent owns
│       ├── runner.ts
│       ├── sweep.ts
│       ├── analyzer.ts
│       ├── types.ts
│       └── strategies/
│           ├── random.ts
│           ├── greedy.ts
│           └── heuristic.ts
│
└── tests/                    ← Test Agent owns
    ├── game-kernel/
    ├── game-session/
    └── sim-harness/
```

---

## Module Dependency Rules (enforced by CI)

```
sim-harness ──→ game-kernel ←── game-session ←── ui
                                              ←── tuning-console
```

**DO:**
- `game-session` imports from `game-kernel`
- `ui` imports from `game-session`
- `tuning-console` imports from `game-session`
- `sim-harness` imports from `game-kernel`

**DO NOT:**
- `game-kernel` imports from anywhere in `src/` — it is self-contained
- `ui` imports from `game-kernel` directly — always go through `game-session`
- `sim-harness` imports from `game-session` or `ui`
- Tests cross module boundaries (each test file imports only from its own module)

CI runs a dependency boundary check on every push. Violations are build failures.

---

## Where the Game Spec Lives

| What you need | Where to find it |
|---|---|
| Game rules (chain mechanic, result formula, retirement) | `docs/Merge_Game_Specification.md` |
| Design decisions and rationale | `docs/Merge_Game_Design_Journal.md` |
| T1-T8b mandatory test vectors | `docs/Merge_Game_Design_Journal.md` §chain examples |
| TypeScript interface contracts | `docs/engineering/KERNEL_INTERFACE.md` |
| Module diagram and ownership | `docs/engineering/ARCHITECTURE.md` |
| Parameter tier assignments | `docs/engineering/PARAMETER_TIERS.md` |
| Sim harness output schema | `docs/engineering/SIM_HARNESS_SCHEMA.md` |

---

## Branch Workflow

See `docs/engineering/ARCHITECTURE.md` §Branch Strategy for the full rules. Short version: cut from `develop`, PR back to `develop`, never push directly to `develop` or `main`. Evan promotes `develop → main`.

**Branch naming:** always use `feat/<slug>` or `fix/<slug>` cut from `origin/develop`. **Never work on the auto-generated `claude/<...>` worktree branch** — that is just a scratch worktree; cut a real feature branch from it immediately before doing any work.

**Off-limits branches — do not read or use as context:**
- `archive/v1` — abandoned prototype, different codebase entirely

---

## What Requires Evan's Approval (do not proceed without it)

1. Any edit to files in top-level `docs/` (the 7 design docs)
2. Any change to `game-kernel/index.ts` public API
3. Adding a Tier 1 parameter to the Tuning Console
4. Any merge to `main`
5. Any new Architecture Decision Record (ADR)
6. The sim harness output schema (`SIM_HARNESS_SCHEMA.md`)
7. Any new dependency in `package.json`

---

## Design Gap Protocol

When you hit an ambiguity not covered by the spec:

1. **Stop. Do not invent a resolution and proceed.**
2. File a GitHub issue labeled `design-question` with: file/line location, the ambiguity, 2-3 options with tradeoffs.
3. If blocked and Evan is unavailable: implement the most conservative option (closest to what the spec already says) and add a `// TODO(design-question: #NNN)` comment.
4. When Evan answers: update the code, file an ADR if the decision affects module boundaries or APIs.

**All Phase 1 design gaps are resolved.** No open questions remain before kernel implementation.

---

## Current Phase and Gate Status

**Phase 0 — Project Foundation** ✅ COMPLETE

**Phase 1 — game-kernel** ✅ COMPLETE (2026-04-28)
- All T1-T8b test vectors pass
- ≥93% line/100% function coverage on `src/game-kernel/`
- Property tests: valid chain always returns power-of-2
- Kernel source confirmed by Evan
- Zero imports outside `src/game-kernel/`

**Phase 2 — Playable v1** ✅ COMPLETE (2026-04-28)
- UAT passed by Evan
- Chain start/extension/resolution match spec
- Gravity and L-1 spawn verified
- Game-over detection and restart work
- Zero game logic in UI layer (CI boundary check passes)

**Phase 3 — Tuning Console** ✅ COMPLETE (2026-04-28, UAT passed)

- [x] All Tier 1 parameters exposed (k, spawn weights per tier)
- [x] Changing k mid-game produces correct results on next chain
- [x] Config exportable as JSON
- [x] Evan UAT passed

Also delivered:
- `docs/engineering/PARAMETER_TIERS.md`
- ADR 0002 — `GameSession.updateConfig` Tier 1/2 contract
- Backfilled `tests/game-session/` Phase 2 deferred suite (18 tests, 100% coverage)

See `docs/engineering/ARCHITECTURE.md` for full phase sequence.

---

## Recent ADRs

| # | Title | Status | Date |
|---|---|---|---|
| 0000 | Tech Stack | Accepted | 2026-04-28 |
| 0001 | Pure Kernel Module | Accepted | 2026-04-28 |
| 0002 | GameSession.updateConfig contract | PROPOSED (Evan approval pending) | 2026-04-28 |

---

## Code Rules (summary — full detail in `docs/engineering/ARCHITECTURE.md`)

- TypeScript `strict: true`. No `any`. All exported functions have explicit return types.
- `game-kernel` functions are pure: no side effects, no `Math.random()`, no `Date.now()`, no `console.log()`. All randomness via seeded PRNG passed in config.
- `GameState` is an immutable value object. Functions return new state; they never mutate.
- Comments only when WHY is non-obvious. Never explain what the code does.
- Commit format: `<type>(<scope>): <description>` — types: `feat fix test docs refactor arch` — scopes: `kernel session ui console harness tests docs ci`
