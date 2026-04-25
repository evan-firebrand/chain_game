import type { ModifierBehavior } from "./types";

// Bomb: when this tile is the chain endpoint, clears a radius x radius
// neighborhood around the landing cell. Bomb's own value contributes to the
// merge sum normally; cleared collateral does not score.
export const bomb: ModifierBehavior = {
  kind: "bomb",
  canChainStart: () => true,
  canChainThrough: () => true,
  onMergeAsEndpoint: (tile, landing, state) => {
    if (tile.modifier?.kind !== "bomb") return {};
    const radius = tile.modifier.radius;
    const grid = state.grid.map((row) => row.slice());
    for (let dr = -radius; dr <= radius; dr++) {
      for (let dc = -radius; dc <= radius; dc++) {
        const nr = landing.r + dr;
        const nc = landing.c + dc;
        if (nr < 0 || nc < 0) continue;
        if (nr >= grid.length || nc >= grid[0].length) continue;
        if (nr === landing.r && nc === landing.c) continue;
        grid[nr][nc] = null;
      }
    }
    return { grid };
  },
  classify: () => "bomb",
};
