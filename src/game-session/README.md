# game-session

**Owner:** Game Logic Agent
**Phase:** 2

Thin stateful wrapper around `game-kernel`. Creates and manages game sessions, calls `applyAction`, emits events after every state transition. The event stream is the integration surface consumed by UI and Tuning Console.

**Imports from:** `game-kernel` only.

## Files

| File | Purpose | Phase |
|---|---|---|
| `session.ts` | Session manager | 2 |
| `events.ts` | Session-level event type definitions | 2 |

## Event contract

Every event emitted by `session.ts` includes:
- `type` — the event kind
- `state` — full `GameState` snapshot after transition
- `config` — `GameConfig` in effect at the time
- `turn` — turn number

This verbosity is intentional: the Tuning Console and Sim Harness both consume these events.
