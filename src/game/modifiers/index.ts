import type { Tile, TileModifier } from "../types";
import type { ModifierBehavior } from "./types";
import { wildcard } from "./wildcard";
import { lock } from "./lock";
import { bomb } from "./bomb";
import { ice } from "./ice";
import { anchor } from "./anchor";
import { splitter } from "./splitter";
import { multiplier } from "./multiplier";

const REGISTRY = new Map<TileModifier["kind"], ModifierBehavior>();

export function registerModifier(behavior: ModifierBehavior): void {
  REGISTRY.set(behavior.kind, behavior);
}

for (const m of [wildcard, lock, bomb, ice, anchor, splitter, multiplier]) {
  registerModifier(m);
}

export function getModifier(tile: Tile | null | undefined): ModifierBehavior | null {
  if (!tile?.modifier) return null;
  return REGISTRY.get(tile.modifier.kind) ?? null;
}

// Aggregate chainScoreMultiplier across all tiles in a chain. Defaults to 1.
export function chainModifierScore(chain: Tile[]): number {
  let m = 1;
  for (const t of chain) {
    const b = getModifier(t);
    if (b?.chainScoreMultiplier) m *= b.chainScoreMultiplier(t, chain);
  }
  return m;
}

export type { ModifierBehavior } from "./types";
