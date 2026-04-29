import type { GameConfig, Tile, TileValue } from './types.js';

// Internal helpers shared by board.ts and index.ts. Not part of the public API.

/**
 * A shared, frozen empty-tile object. Reused everywhere a cell is cleared
 * (removeTiles, applyGravity initial fill, createEmptyBoard) so we don't
 * allocate a fresh `{value: 0, retired: false}` per cell.
 *
 * Frozen so accidental mutation throws in strict mode.
 */
export const EMPTY_TILE: Tile = Object.freeze({
  value: 0 as TileValue,
  retired: false,
});

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

// ─── Spawn-weight CDF cache ──────────────────────────────────────────────────
// Each call to pickTileValue used to rebuild the (value, weight) table from
// scratch. The table is fully determined by (spawnPoolMin, spawnPoolMax,
// spawnWeights) which is constant within a game, so we cache it per-config
// in a WeakMap. Cache lifetime tracks the config object — when callers
// release the config, the GC reclaims the table automatically.

interface CdfTable {
  /** Tile values in spawn order (min → max), only those with weight > 0. */
  readonly values: readonly TileValue[];
  /** Running sum of weights, parallel to `values`. */
  readonly cumulative: readonly number[];
  /** Last entry of `cumulative`, cached for O(1) access. */
  readonly total: number;
}

type SpawnConfig = Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'>;

const cdfCache: WeakMap<SpawnConfig, CdfTable> = new WeakMap();

function buildCdf(config: SpawnConfig): CdfTable {
  const values: TileValue[] = [];
  const cumulative: number[] = [];
  let total = 0;

  let v = config.spawnPoolMin;
  while (v <= config.spawnPoolMax) {
    /* v8 ignore next 1 */
    const weight = config.spawnWeights[v] ?? 0;
    if (weight > 0) {
      values.push(v);
      total += weight;
      cumulative.push(total);
    }
    v = (v * 2) as TileValue;
  }

  return { values, cumulative, total };
}

function getCdf(config: SpawnConfig): CdfTable {
  let table = cdfCache.get(config);
  if (table === undefined) {
    table = buildCdf(config);
    cdfCache.set(config, table);
  }
  return table;
}

/**
 * Pick a tile value from the spawn pool using weighted random selection.
 * Uses a cached cumulative-weight table; cache key is the config object.
 */
export function pickTileValue(config: SpawnConfig, rand: number): TileValue {
  const table = getCdf(config);

  /* v8 ignore next 3 */
  if (table.total === 0 || table.values.length === 0) {
    return config.spawnPoolMin;
  }

  // Match the original's `threshold -= weight; if (threshold <= 0)` semantic
  // exactly — i.e., return at the first bucket whose cumulative weight is
  // >= rand*total. Using strict `<` here would diverge at exact-boundary
  // rand values that the original would resolve into the earlier bucket.
  const threshold = rand * table.total;
  for (let i = 0; i < table.values.length; i++) {
    if (threshold <= (table.cumulative[i] as number)) {
      return table.values[i] as TileValue;
    }
  }

  /* v8 ignore next 2 */
  const last = table.values[table.values.length - 1];
  return last !== undefined ? last : config.spawnPoolMin;
}
