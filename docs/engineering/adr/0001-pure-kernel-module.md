# ADR-0001: Pure Kernel Module

**Status:** Accepted
**Date:** 2026-04-28
**Deciders:** Evan Luckey, Architecture Agent

---

## Context

This project will have three consumers of game logic:
1. **Playable game** (browser UI)
2. **Tuning Console** (live parameter adjustment during play)
3. **Simulation Harness** (headless batch runner for statistical analysis)
4. **Design Intent Solver** (inverse query tool, built on the harness)

Without deliberate architectural separation, each consumer will accumulate its own copy of game logic. This causes:
- Divergence: a bug fix in one copy isn't applied to others
- Testing difficulty: game logic buried inside UI event handlers is hard to unit test
- Simulation drift: the harness produces results that don't match the real game because it re-implemented the rules

This pattern (logic duplicated across consumers, causing drift) is the dominant failure mode for game simulation tools. The design doc (`Merge_Game_Tooling_Specification.md` §1) explicitly names "single source of truth" as the primary tooling requirement.

---

## Decision

All game logic lives in `src/game-kernel/` and nowhere else.

`game-kernel` is a pure functional module:
- Functions are of the form `(state, action) → newState` or `(state, query) → result`
- No side effects of any kind
- No imports from outside `src/game-kernel/`
- No `Math.random()` — all randomness is seeded PRNG passed via `GameConfig`
- No `Date.now()`, no `window`, no `document`, no DOM
- `GameState` is a plain JSON-serializable object: no class instances, no methods, no closures

All three consumers (game-session, ui, sim-harness) import from `game-kernel` (directly or transitively). None of them re-implement any game rule.

CI enforces this via a dependency boundary check: any import that crosses the boundary is a build failure.

---

## Options Considered

### Option A: Pure kernel module (this decision)

Strict separation. All logic in one module. Consumers are thin wrappers.

Pros:
- Single place to fix bugs
- Kernel can be 100% unit-tested without any browser environment
- Simulation harness is guaranteed to produce results matching the real game
- New tools can be added without re-implementing game rules
- Seeded PRNG enables deterministic, reproducible simulation runs

Cons:
- More initial design work (must write the interface contract before implementation)
- Thin wrapper boilerplate in game-session

### Option B: Logic in game-session; UI and harness both import from it

Game-session becomes the source of truth. Harness imports from it.

Pros:
- Less abstraction in v1

Cons:
- game-session has side effects (event emission) — logic mixed with effects
- Harness then depends on the event-emitting session layer, which is harder to run headlessly
- Test environment must simulate session events just to test game rules
- Harder to add new consumers later

### Option C: Duplicate logic per consumer

Each consumer implements the rules independently.

Pros:
- Maximum independence

Cons:
- Guaranteed divergence over time
- Simulation drift makes the harness useless
- Catastrophically wrong for this project

---

## Rationale

Option A is the only design that keeps simulation trustworthy. The entire point of the Simulation Harness and Design Intent Solver is to answer questions like "does this parameter change make games shorter or longer?" Those answers are only meaningful if the simulation runs identical rules to the playable game.

The seeded PRNG requirement follows from the same principle: reproducibility. If the harness can't reproduce a specific game outcome given a seed, the inverse query tool cannot work.

The upfront cost is writing `KERNEL_INTERFACE.md` before Phase 1 starts. This is non-optional. It is the contract that all downstream code depends on.

---

## Consequences

**Easier:**
- Unit testing game rules (no DOM, no browser APIs, just function calls)
- Adding new tools that consume game logic (new consumer just imports kernel)
- Debugging: any behavioral question about the game can be answered by reading kernel code
- Simulation trust: harness results are provably identical to real game results

**Harder:**
- Phase 0 requires writing the interface contract before any code
- Any change to the kernel's public API requires Evan approval and an ADR update
- Agents must internalize the "no logic outside kernel" rule or CI will reject their work

**Off the table:**
- Game logic in UI event handlers
- Game logic in simulation strategies
- Any form of game rule duplication

---

## Enforcement

This decision is enforced by CI at every push. The boundary check script reads all import statements and fails the build if any file outside `src/game-kernel/` imports a game-rule function that should be in the kernel. Additionally, all PRs touching `src/game-kernel/index.ts` require Evan's approval — changes to the public API are the highest-stakes changes in this codebase.

---

## Revisit Conditions

Never revisit the principle. It is the load-bearing architectural decision.

Revisit the implementation (specific function signatures) when:
- Phase 2 playtest reveals a missing kernel function needed by the session manager
- Phase 4 retirement implementation requires a new event type
- Phase 5 sim harness requires additional state fields for statistical analysis

In all cases: update `KERNEL_INTERFACE.md`, file an ADR for the API change, get Evan approval, then update the implementation.
