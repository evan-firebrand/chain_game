# Session Brief: Game Logic Agent — Phase 1 Kernel Implementation

**Date:** [fill when assigned]
**Agent role:** Game Logic Agent
**Assigned by:** Evan (after Phase 0 gate passes)
**Status:** PENDING — do not start until Evan closes the Phase 0 gate issue

---

## Context

Phase 0 is complete: contracts, scaffolding, and CI are in place. The folder skeleton exists. `KERNEL_INTERFACE.md` has been approved by Evan. The Test Agent is writing the T1-T8b spec test vectors in parallel in `tests/game-kernel/rules.test.ts` — those tests will be red until you implement the kernel.

Your job is to implement `src/game-kernel/` — the pure logic module that is the single source of truth for all game rules.

---

## Task

Implement the complete `src/game-kernel/` module matching the interface in `docs/engineering/KERNEL_INTERFACE.md`:

1. `types.ts` — all type definitions exactly as specified in `KERNEL_INTERFACE.md`
2. `rules.ts` — `computeResultValue` (Rule D k=2: `last × 2 × 2^⌊s/k⌋`)
3. `chain.ts` — `validateChainExtension`, `getAdjacentCells`, chain resolution
4. `board.ts` — `applyGravity`, `spawnTiles`, `setTile`, `removeTiles`
5. `retirement.ts` — **STUB ONLY** in Phase 1: export the correct function signatures but throw `new Error('NotImplemented: retirement — Phase 4')` in each body
6. `index.ts` — re-exports of public API only; zero logic in this file

---

## Acceptance criteria

1. All T1-T8b test vectors in `tests/game-kernel/rules.test.ts` pass
2. 100% line, function, and branch coverage in `src/game-kernel/` (excluding `retirement.ts`)
3. Property test passes: any chain of length ≥ 2 with valid extension rules always produces a power-of-2 result
4. Zero imports from outside `src/game-kernel/` (CI boundary check enforces this)
5. `retirement.ts` stubs exist with correct signatures, not empty files
6. `tsc --noEmit` passes with zero errors
7. `npm run lint` passes with zero errors
8. Evan reads the source and confirms it matches the spec

---

## Files to read first (in this order)

1. `CLAUDE.md`
2. `docs/engineering/KERNEL_INTERFACE.md` — **this is your spec. implement exactly this.**
3. `docs/Merge_Game_Specification.md` — game rules
4. `docs/Merge_Game_Design_Journal.md` — T1-T8b test vectors + result rule rationale
5. `docs/engineering/ARCHITECTURE.md` — phase context
6. `docs/engineering/adr/0001-pure-kernel-module.md` — why purity matters

---

## Files to write

- `src/game-kernel/types.ts`
- `src/game-kernel/rules.ts`
- `src/game-kernel/chain.ts`
- `src/game-kernel/board.ts`
- `src/game-kernel/retirement.ts` (stubs only)
- `src/game-kernel/index.ts`

---

## Do NOT

- Write any UI code
- Write any test files (Test Agent owns `tests/`)
- Modify `docs/` files
- Import from anywhere outside `src/game-kernel/`
- Use `Math.random()` — seeded PRNG lives in `GameConfig.prngSeed` and is passed through
- Add console.log() statements
- Use class instances — `GameState` is a plain object
- Implement `retirement.ts` fully — stubs only in Phase 1

---

## Open questions to file as design-question issues

If you encounter any of these, file a `design-question` issue and implement the conservative default:
- L=1 chain: L-1=0 spawns or minimum 1? (conservative: 0)
- Gravity column order (conservative: left-to-right)
- Board fill on new game (conservative: full 42 cells)
- Initial board guarantee of legal chain start (conservative: retry until valid)

---

## Suggested implementation order

1. `types.ts` first — get the types right before any logic
2. `rules.ts` + run T1-T8b tests — these are the heart of the game, validate immediately
3. `chain.ts` — validation and adjacency
4. `board.ts` — gravity, spawn
5. `retirement.ts` stubs
6. `index.ts` — wire up re-exports
