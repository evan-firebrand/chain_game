# game-kernel

**Owner:** Game Logic Agent
**Phase:** 1

The single source of truth for all game rules. A pure functional TypeScript module — no side effects, no DOM, no randomness except through seeded PRNG.

**Interface contracts:** See `docs/engineering/KERNEL_INTERFACE.md` — read this before writing any code here.

**Zero imports from outside this directory.** Violations are a CI build failure.

## Files

| File | Purpose | Phase |
|---|---|---|
| `index.ts` | Public API — re-exports only, no logic | 1 |
| `types.ts` | ALL GameState, Action, Config, Event types | 1 |
| `chain.ts` | Chain validation + resolution | 1 |
| `board.ts` | Grid ops: applyGravity, spawnTiles, setTile, removeTiles | 1 |
| `rules.ts` | Rule D k=2: computeResultValue | 1 |
| `retirement.ts` | Tile retirement (stub in Phase 1, full in Phase 4) | 1/4 |
