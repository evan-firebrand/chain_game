import type { Tile } from "../types";
import type { ModifierBehavior } from "./types";

// Lock: cannot start or extend a chain. Each chain merge that resolves
// adjacent to the lock decrements `clearsRemaining`; at 0 the modifier is
// stripped and the tile returns to normal play.
export const lock: ModifierBehavior = {
  kind: "lock",
  canChainStart: () => false,
  canChainThrough: () => false,
  onAdjacentMerge: (tile: Tile): Tile => {
    if (tile.modifier?.kind !== "lock") return tile;
    const next = tile.modifier.clearsRemaining - 1;
    if (next <= 0) {
      const { modifier: _m, ...rest } = tile;
      return rest as Tile;
    }
    return { ...tile, modifier: { kind: "lock", clearsRemaining: next } };
  },
  classify: () => "locked",
};
