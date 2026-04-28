# ui

**Owner:** UI Agent
**Phase:** 2

Rendering and input only. Never computes game logic. All game rule queries go through `game-session`.

**Imports from:** `game-session` only. NEVER from `game-kernel` directly.

## Files

| File | Purpose | Phase |
|---|---|---|
| `app.ts` | Top-level wiring: creates session, mounts board + HUD, connects input | 2 |
| `board.ts` | Canvas-based board renderer | 2 |
| `input.ts` | Chain input handler (drag/tap path) — distinct module for swappability | 2 |
| `hud.ts` | Score, max tile, retirement milestone indicator | 2 |

## Key constraint

`input.ts` MUST be a distinct module. It handles the drag/tap path interaction and calls back into `app.ts`. This keeps mouse and touch handling swappable without touching board rendering.

Phase 2 uses placeholder visuals deliberately: numbered tiles on solid-color fills, no animation. Fake polish hides real problems.
