# ADR-0002: GameSession.updateConfig — Tier 1 Live, Tier 2 Restart

**Status:** PROPOSED — Evan approval required.
**Date:** 2026-04-28
**Deciders:** Evan Luckey, UI Agent (author), Game Logic Agent (co-reviewer).

---

## Context

Phase 3 introduces the Tuning Console. The console must adjust live tunables (`ruleK`, `spawnWeights`) without restarting the game, and adjust restart-required tunables (`gridRows`, `gridCols`, `prngSeed`, `spawnPoolMin/Max`) only via a fresh game.

`GameConfig` is `readonly` throughout (see `src/game-kernel/types.ts:32-43`). `GameState.config` is also `readonly`. The kernel reads config fresh on every chain commit and every spawn — there is no cached/derived state that depends on config values:

- `computeResultValue` reads `config.ruleK` per call (`src/game-kernel/rules.ts:14-22`).
- `pickTileValue` reads `config.spawnWeights`, `spawnPoolMin`, `spawnPoolMax` per call (`src/game-kernel/board.ts:82-117`).
- `applyAction` always passes `state.config` into `resolveChain` and `spawnTiles` (`src/game-kernel/index.ts:304-329`).

So replacing `state.config` between dispatches automatically routes the new values into the next commit. No kernel changes are required.

What's missing is a session-level entry point: today there is no way for the UI to push a new config into a live session except by dispatching `new-game` (which restarts).

---

## Decision

Add ONE method to `GameSession`:

```ts
updateConfig(patch: Partial<GameConfig>): void
```

Behavior:
1. **Tier 2 keys** (`gridRows`, `gridCols`, `spawnPoolMin`, `spawnPoolMax`, `prngSeed`) — throw `Error("Config key \"<key>\" is Tier 2; dispatch a 'new-game' action instead")`. State unchanged.
2. **Tier 1 keys** (`ruleK`, `spawnWeights`) — merge into `state.config` (shallow), produce a new `GameState` with the new config, emit `state-changed` (existing event type — `SessionEvent.config` carries the new snapshot).
3. Empty patch — no-op merge but still emits a `state-changed` (cheap, predictable).
4. Unknown keys — ignored (treated as Tier 1 pass-through). The `Partial<GameConfig>` type prevents this at compile time; runtime additions would have to be cast.

The Tier 1/2 split is sourced from `docs/engineering/PARAMETER_TIERS.md` (ADR 0002 cites it; PARAMETER_TIERS.md is the single source of truth for tier assignments).

---

## Options Considered

### Option A: `updateConfig(patch)` with Tier 2 rejection (this decision)

Single method, single source of truth (PARAMETER_TIERS.md), kernel untouched.

**Pros:** smallest API surface; immutability preserved (state is replaced, not mutated); existing `state-changed` event already carries the config snapshot, so UI re-renders for free.

**Cons:** runtime check (Tier 2 thrown) instead of compile-time. Acceptable: the type system can't easily express "subset of keys is allowed" without restructuring `GameConfig`.

### Option B: Two methods — `setLiveConfig(patch)` and `restartWithConfig(config)`

**Pros:** separates intent at the call site.

**Cons:** doubles API surface. `restartWithConfig` is a thin wrapper around `dispatch({kind:'new-game', config})` which already exists — adding a second path duplicates intent. Rejected.

### Option C: Separate `LiveConfig` type with only Tier 1 fields

**Pros:** compile-time safety.

**Cons:** forces the kernel to consume two config types (or merge them internally). Cascades through `GameConfig` users. Rejected as scope creep for Phase 3.

### Option D: Mutate `state.config` in place

**Pros:** simplest implementation.

**Cons:** breaks the kernel invariant that `GameState` is immutable (ADR 0001). Rejected categorically.

---

## Rationale

Option A respects every existing invariant:
- Kernel stays untouched (ADR 0001 holds).
- `GameState` immutability holds (we replace, not mutate).
- The Tier 1/2 boundary is enforced exactly once, at the only entry point that can produce divergence.
- Future tier changes (e.g. promoting a Tier 2 key to Tier 1 after kernel audit) are a one-line edit in `session.ts` plus a PARAMETER_TIERS.md / ADR update.

The Tier 2 rejection is THROW rather than silent ignore because silently dropping a "set gridRows" call would surprise both the user (slider didn't take effect) and the test author (no error to catch). Throw makes the contract explicit.

---

## Implementation sketch

```ts
// src/game-session/session.ts
export class GameSession {
  // ... existing members ...

  private static readonly TIER2_KEYS: readonly (keyof GameConfig)[] = [
    'gridRows', 'gridCols', 'spawnPoolMin', 'spawnPoolMax', 'prngSeed',
  ];

  updateConfig(patch: Partial<GameConfig>): void {
    for (const key of Object.keys(patch)) {
      if (GameSession.TIER2_KEYS.includes(key as keyof GameConfig)) {
        throw new Error(
          `Config key "${key}" is Tier 2; dispatch a 'new-game' action instead`
        );
      }
    }
    const newConfig: GameConfig = { ...this.state.config, ...patch };
    this.state = { ...this.state, config: newConfig };
    this._emit([]);
  }
}
```

No change to `events.ts` — the existing `state-changed` event already carries `config` in its payload (`src/game-session/events.ts:1-9`).

---

## Consequences

**Easier:**
- Tuning Console can wire any Tier 1 slider directly: `slider.onChange(v => session.updateConfig({ ruleK: v }))`.
- UI re-renders automatically via the existing `session.on(...)` listener.
- Sim harness unaffected (does not use `GameSession`).

**Harder:**
- Session unit tests must cover both Tier 1 acceptance and Tier 2 rejection.
- Any future config field MUST be classified in PARAMETER_TIERS.md AND added to `TIER2_KEYS` in session.ts (or explicitly left out as Tier 1).

**Off the table:**
- Mutating `GameState` or `GameConfig` directly.
- Bypassing the tier check from outside the session.

---

## Enforcement

- TypeScript: `Partial<GameConfig>` bounds the patch to known config keys.
- Runtime: `TIER2_KEYS` constant in `session.ts` is the single point of truth for the tier check.
- Tests: `tests/game-session/session-update-config.test.ts` verifies acceptance (k change visible in next chain math; spawn-weight change visible in next spawn) and rejection (Tier 2 keys throw).
- CI boundary check unaffected — no new imports.

---

## Revisit Conditions

- A new `GameConfig` field is added → classify in PARAMETER_TIERS.md, update `TIER2_KEYS`, ADR amendment if the addition changes the live/restart split materially.
- A Tier 2 key is promoted to Tier 1 (e.g. after kernel audit shows it's safe) → audit PR + ADR amendment + remove from `TIER2_KEYS`.
- The session needs to expose live changes to non-config state (e.g. retirement parameters in Phase 4) → may need a parallel `updateRuntimeParams` method; revisit then.
