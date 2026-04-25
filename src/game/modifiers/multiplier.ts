import type { ModifierBehavior } from "./types";

// Multiplier: stationary bonus tile. Cannot be chained. When a chain endpoint
// lands adjacent, the chain's score is multiplied by `factor`. The multiplier
// tile itself is consumed (modifier stripped) after one trigger.
export const multiplier: ModifierBehavior = {
  kind: "multiplier",
  canChainStart: () => false,
  canChainThrough: () => false,
  chainScoreMultiplier: (tile) => {
    if (tile.modifier?.kind !== "multiplier") return 1;
    return tile.modifier.factor;
  },
};
