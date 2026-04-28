# Session Brief: Test Agent — Phase 1 Spec Test Vectors

**Date:** [fill when assigned — runs in parallel with Game Logic Agent]
**Agent role:** Test Agent
**Assigned by:** Evan (after Phase 0 gate passes)
**Status:** PENDING — can start in parallel with Game Logic Agent once Phase 0 gate passes

---

## Context

Phase 0 is complete. The Game Logic Agent is implementing `src/game-kernel/` in parallel. Your job is to write the test suite for `src/game-kernel/` — specifically the mandatory T1-T8b spec test vectors — BEFORE the implementation exists. These tests will be red until the Game Logic Agent's implementation lands. That is correct and expected.

The interface contracts you test against are in `docs/engineering/KERNEL_INTERFACE.md`.

---

## Task

Write the test suite for `src/game-kernel/`:

1. `tests/game-kernel/rules.test.ts` — T1-T8b mandatory spec vectors + additional Rule D coverage
2. `tests/game-kernel/chain.test.ts` — chain validation: valid starts, invalid starts, valid extensions, invalid extensions, adjacency
3. `tests/game-kernel/board.test.ts` — gravity, spawn (with known seed), setTile, removeTiles
4. `tests/game-kernel/retirement.test.ts` — retirement trigger detection, pool advancement (stubs for now; full tests in Phase 4)

---

## Acceptance criteria

1. All T1-T8b test cases exist in `rules.test.ts` with the exact expected values from the Design Journal
2. Tests import ONLY from `src/game-kernel/` (no cross-module imports)
3. Tests compile with `tsc --noEmit` even before the implementation exists (import the types; the functions may throw — that's fine)
4. Tests are clearly named so failures are self-describing
5. At least 3 property-based tests exist (generate random valid chains, assert result is always a power of 2)

---

## T1-T8b mandatory test vectors

Source: `docs/Merge_Game_Design_Journal.md`

| ID | Chain values | Expected result | Rule check |
|---|---|---|---|
| T1 | [2, 2] | 4 | last=2, s=0, k=2 → 2×2×1=4 |
| T2 | [2, 2, 2] | 4 | last=2, s=1, ⌊1/2⌋=0 → 2×2×1=4 |
| T3 | [2, 2, 2, 2] | 8 | last=2, s=2, ⌊2/2⌋=1 → 2×2×2=8 |
| T4 | [2, 2, 4, 8] | 16 | last=8, s=0, 2 doublings → 8×2×1=16 |
| T5 | [2, 2, 4, 4, 8] | 16 | last=8, s=1, ⌊1/2⌋=0 → 8×2×1=16 |
| T6 | [2, 2, 2, 2, 4, 4, 8] | 32 | last=8, s=3, ⌊3/2⌋=1 → 8×2×2=32 |
| T7 | [4, 4, 8] | 16 | last=8, s=0 (8 is doubling ext from 4, not same-value) → 8×2×1=16 |
| T8a | [2, 2, 2, 2, 2, 2] | 16 | last=2, s=4, ⌊4/2⌋=2 → 2×2×4=16 |
| T8b | [2, 2, 4, 4, 4, 4, 8] | 32 | last=8, s=3 (first 4 doubles the 2; next three 4s are same-value; 8 doubles the 4) → 8×2×2^1=32 |

All values confirmed. No open questions on these vectors.

---

## Files to read first

1. `CLAUDE.md`
2. `docs/engineering/KERNEL_INTERFACE.md` — the interface you're testing against
3. `docs/Merge_Game_Design_Journal.md` — **the source of T1-T8b** — read the exact chain examples section
4. `docs/engineering/session-briefs/NEXT-game-logic-phase1-kernel.md` — coordinate with Game Logic Agent brief

---

## Files to write

- `tests/game-kernel/rules.test.ts`
- `tests/game-kernel/chain.test.ts`
- `tests/game-kernel/board.test.ts`
- `tests/game-kernel/retirement.test.ts` (stubs for now — full tests in Phase 4)

---

## Do NOT

- Modify any `src/` files
- Write tests for `game-session`, `ui`, or any other module (that is out of scope for this session)
- Invent test values — derive them from the spec or file a design-question issue
- Make tests pass by hardcoding returns in the kernel (that is Game Logic Agent territory)
