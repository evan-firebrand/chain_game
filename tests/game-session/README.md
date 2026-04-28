# tests/game-session

**Owner:** Test Agent
**Coverage requirement:** 90%+

Integration tests for `src/game-session/`. Tests cover the full game loop driven through the session manager, verifying that kernel calls produce correct state transitions and events are emitted correctly.

## What to test

- Session creation produces a valid initial board with at least one legal chain start
- `commitChain` with a valid chain produces the correct result tile and events
- `commitChain` with an invalid chain throws or returns an error (not silently ignored)
- Events include full state snapshots, correct config, and correct turn number
- Game-over event fires when `hasLegalChainStart` returns false
- Retirement events fire at the correct milestones
