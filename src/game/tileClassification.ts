import { findDeadTiles, findFragileTiles } from "./rules";
import { canBeConsumed } from "./lookahead";
import { getMode } from "./modes";
import type { GameState } from "./types";

export type TileClassification = {
  dead: Set<number>;
  fragile: Set<number>;
  stranded: Set<number>;
  trophy: Set<number>;
};

type ClassifyOptions = {
  // Effective spawn floor (mode floor combined with ratchet floor). Pass the
  // result of resolveFloor() from engine.ts.
  floor: number | undefined;
  // Skip expensive classifications while an animation is playing — the grid
  // shown is transient and dead/fragile badges would flicker.
  isAnimating: boolean;
};

// Dead: K=1 flags tiles that have no in-pool value, no queue rescue, and no
// board partner. K=2 rescues any K=1 candidate that a 2-move plan can still
// consume (clear a blocker, then pair up). Only K=2 survivors are truly dead.
function classifyDead(state: GameState, options: ClassifyOptions): Set<number> {
  if (options.isAnimating) return new Set();
  const k1 = findDeadTiles(state.grid, options.floor, state.peak, state.spawnQueue);
  if (k1.size === 0) return k1;
  const survivors = new Set<number>();
  for (const id of k1) {
    if (!canBeConsumed(state, id, 2)) survivors.add(id);
  }
  return survivors;
}

// Fragile: tiles with value below the mode's NEXT floor rise. Only Rising
// Floor currently exposes nextFloor. Dead tiles take visual precedence.
function classifyFragile(state: GameState, options: ClassifyOptions): Set<number> {
  if (options.isAnimating) return new Set();
  const nextFloor = getMode(state.mode).nextFloor?.(state);
  if (nextFloor == null) return new Set();
  return findFragileTiles(state.grid, nextFloor);
}

// Stranded: tiles that just became unreachable after a Rising Floor rise.
// Transient — cleared on the next move (lastStrandedIds resets to undefined).
function classifyStranded(state: GameState): Set<number> {
  if (state.mode !== "risingFloor" || state.modeState.kind !== "risingFloor") {
    return new Set();
  }
  return new Set(state.modeState.lastStrandedIds ?? []);
}

// Peak-trophy: the tile matching state.peak is a trophy when it's the only
// tile on the board with that value. Stops being a trophy once a second
// peak-value tile appears (match found) or it's flagged dead.
function classifyTrophy(state: GameState, options: ClassifyOptions): Set<number> {
  const out = new Set<number>();
  if (!state.peak || options.isAnimating) return out;
  let winnerId: number | null = null;
  let count = 0;
  for (const row of state.grid) {
    for (const t of row) {
      if (t?.value === state.peak) {
        winnerId = t.id;
        count++;
        if (count > 1) return out;
      }
    }
  }
  if (count === 1 && winnerId !== null) out.add(winnerId);
  return out;
}

export function classifyTiles(state: GameState, options: ClassifyOptions): TileClassification {
  return {
    dead: classifyDead(state, options),
    fragile: classifyFragile(state, options),
    stranded: classifyStranded(state),
    trophy: classifyTrophy(state, options),
  };
}
