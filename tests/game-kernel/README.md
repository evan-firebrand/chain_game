# tests/game-kernel

**Owner:** Test Agent
**Coverage requirement:** 100% (lines, functions, branches, statements)

Test files for `src/game-kernel/`. Tests are written against the public API in `KERNEL_INTERFACE.md`, not the implementation. In Phase 1, the Test Agent writes these tests IN PARALLEL with the Game Logic Agent's implementation.

## Files

| File | Tests | T1-T8b? |
|---|---|---|
| `rules.test.ts` | Rule D k=2 — `computeResultValue` | YES — mandatory |
| `chain.test.ts` | Chain validation: start rule, extension rule, adjacency | No |
| `board.test.ts` | `applyGravity`, `spawnTiles`, `setTile`, `removeTiles` | No |
| `retirement.test.ts` | Retirement trigger detection, pool advancement | No |
| `integration.test.ts` | Full game loop: `createGame` → `applyAction` cycles | No |

## T1-T8b spec vectors (mandatory)

These must pass before Phase 1 gate. Source: `docs/Merge_Game_Design_Journal.md`.

Write them in `rules.test.ts` on Day 4 of Week 1 — before implementation exists (they will be red until the kernel is built).
