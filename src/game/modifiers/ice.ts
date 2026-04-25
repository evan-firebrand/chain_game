import type { Tile } from "../types";
import type { ModifierBehavior } from "./types";

// Ice: frozen — cannot participate in chains until thawed. Each move ticks the
// counter. Adjacent merges thaw immediately. At 0, the modifier is stripped.
export const ice: ModifierBehavior = {
  kind: "ice",
  canChainStart: () => false,
  canChainThrough: () => false,
  onMoveTick: (tile: Tile): Tile => {
    if (tile.modifier?.kind !== "ice") return tile;
    const next = tile.modifier.thawIn - 1;
    if (next <= 0) {
      const { modifier: _m, ...rest } = tile;
      return rest as Tile;
    }
    return { ...tile, modifier: { kind: "ice", thawIn: next } };
  },
  onAdjacentMerge: (tile: Tile): Tile => {
    if (tile.modifier?.kind !== "ice") return tile;
    const { modifier: _m, ...rest } = tile;
    return rest as Tile;
  },
  classify: () => "frozen",
};
