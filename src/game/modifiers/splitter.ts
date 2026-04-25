import type { ModifierBehavior } from "./types";

// Splitter: when in a chain, the merge result is halved (floor at 2). The
// missing half is queued by leaving an adjacent column's spawn lower-valued —
// for now, simply halving the result is the visible effect; spatial side-effect
// will land with spawn-pipeline coupling in a follow-up.
export const splitter: ModifierBehavior = {
  kind: "splitter",
  canChainStart: () => true,
  canChainThrough: () => true,
  transformResult: (tile, resultValue) => {
    if (tile.modifier?.kind !== "splitter") return { resultValue };
    const halved = Math.max(2, Math.floor(resultValue / 2));
    return { resultValue: halved };
  },
};
