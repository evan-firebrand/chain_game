import type { ModifierBehavior } from "./types";

// Anchor: tile ignores gravity. Chains and merges work normally; the tile just
// stays put when the column collapses around it.
export const anchor: ModifierBehavior = {
  kind: "anchor",
  ignoresGravity: () => true,
  classify: () => "anchored",
};
