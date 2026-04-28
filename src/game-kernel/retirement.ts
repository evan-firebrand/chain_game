import type { Board, GameConfig, TileValue } from './types.js';
import { nextTileValue, tileValueStepsBelow } from './values.js';

/**
 * Check whether a retirement should fire given the current max tile ever reached.
 * Returns the retiring tier value, or null if no retirement fires.
 */
export function checkRetirement(
  maxTileEver: TileValue,
  currentSpawnPoolMax: TileValue
): TileValue | null {
  const triggerTier = nextTileValue(currentSpawnPoolMax);
  if (triggerTier === null || maxTileEver < triggerTier) {
    return null;
  }
  return tileValueStepsBelow(currentSpawnPoolMax, 7);
}

/**
 * Advance the spawn pool window by one tier.
 */
export function advanceSpawnPool(
  config: GameConfig,
  retiredTier: TileValue
): Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'> {
  const spawnPoolMin = nextTileValue(retiredTier);
  const spawnPoolMax = nextTileValue(config.spawnPoolMax);

  if (spawnPoolMin === null || spawnPoolMax === null) {
    return {
      spawnPoolMin: config.spawnPoolMin,
      spawnPoolMax: config.spawnPoolMax,
      spawnWeights: config.spawnWeights,
    };
  }

  const spawnWeights: Partial<Record<TileValue, number>> = { ...config.spawnWeights };
  if (spawnWeights[spawnPoolMax] === undefined) {
    spawnWeights[spawnPoolMax] = (spawnWeights[config.spawnPoolMax] ?? 1) / 2;
  }

  return { spawnPoolMin, spawnPoolMax, spawnWeights };
}

export function markRetiredTiles(board: Board, retiredTier: TileValue): Board {
  return board.map(row =>
    row.map(tile =>
      tile.value === retiredTier ? { ...tile, retired: true } : tile
    )
  ) as Board;
}
