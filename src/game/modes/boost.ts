import { rngStep } from "../rng";
import type { Grid, Tile } from "../types";
import type { ModeBehavior } from "./types";

export const BOOST_PROB = 0.07;
export const BOOST_EXPIRY = 15;
const PER_BOOST_MULTIPLIER = 2;
const MAX_MULTIPLIER = 4;
const MIN_CHAIN_FOR_BOOST = 3;

export const boost: ModeBehavior = {
  id: "boost",
  label: "Boost Tiles",
  initState: () => ({ kind: "boost" }),
  decorateSpawn: (_state, ctx) => {
    const roll = rngStep(ctx.rngState);
    if (roll.value < BOOST_PROB) {
      return { flags: { boost: true, expiresIn: BOOST_EXPIRY }, rngState: roll.state };
    }
    return { flags: {}, rngState: roll.state };
  },
  chainMultiplier: (chain: Tile[]) => {
    if (chain.length < MIN_CHAIN_FOR_BOOST) return 1;
    const count = chain.filter((t) => t.boost).length;
    if (count === 0) return 1;
    return Math.min(MAX_MULTIPLIER, PER_BOOST_MULTIPLIER ** count);
  },
  onMoveComplete: (state) => {
    // Tick boost expiry. When a tile hits 0, drop the boost flag — it becomes
    // a regular tile at its current value.
    let changed = false;
    const newGrid: Grid = state.grid.map((row) =>
      row.map((t) => {
        if (!t || !t.boost) return t;
        const next = (t.expiresIn ?? BOOST_EXPIRY) - 1;
        if (next <= 0) {
          changed = true;
          const { boost: _b, expiresIn: _e, ...rest } = t;
          return rest as Tile;
        }
        if (next !== t.expiresIn) {
          changed = true;
          return { ...t, expiresIn: next };
        }
        return t;
      })
    );
    return changed ? { grid: newGrid } : {};
  },
  hudLabel: (state) => {
    let count = 0;
    for (const row of state.grid) {
      for (const t of row) if (t?.boost) count++;
    }
    return `Boosts on board: ${count} · chain 3+ to activate`;
  },
};
