import type { GameConfig, TileValue } from './types.js';

// Internal helpers shared by board.ts and index.ts. Not part of the public API.

/**
 * Simple seeded LCG (Linear Congruential Generator).
 * Returns the next state.
 */
export function lcgNext(state: number): number {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

/**
 * Convert LCG state to [0, 1) float.
 */
export function lcgFloat(state: number): number {
  return state / 0x100000000;
}

/**
 * Pick a tile value from the spawn pool using weighted random selection.
 */
export function pickTileValue(
  config: Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'>,
  rand: number,
): TileValue {
  const entries: [TileValue, number][] = [];
  let totalWeight = 0;

  let v = config.spawnPoolMin;
  while (v <= config.spawnPoolMax) {
    /* v8 ignore next 1 */
    const weight = config.spawnWeights[v] ?? 0;
    if (weight > 0) {
      entries.push([v, weight]);
      totalWeight += weight;
    }
    v = (v * 2) as TileValue;
  }

  /* v8 ignore next 3 */
  if (totalWeight === 0 || entries.length === 0) {
    return config.spawnPoolMin;
  }

  let threshold = rand * totalWeight;
  for (const [val, weight] of entries) {
    threshold -= weight;
    if (threshold <= 0) {
      return val;
    }
    /* v8 ignore next 1 */
  }
  /* v8 ignore next 2 */
  const last = entries[entries.length - 1];
  return last !== undefined ? last[0] : config.spawnPoolMin;
}
