import type { ModifierBehavior } from "./types";

// Wildcard: matches any value when extending a chain. Like Wilds-mode `wild`,
// but driven via the modifier framework so it composes with other modifiers.
export const wildcard: ModifierBehavior = {
  kind: "wildcard",
  canChainStart: () => true,
  canChainThrough: () => true,
  effectiveValue: (_tile, { prev, next }) => {
    if (prev) return prev.value;
    if (next) return next.value;
    return 2;
  },
};
