import type { TileValue, GameConfig } from './types.js';

/**
 * Check whether a retirement should fire given the current max tile ever reached.
 * Returns the retiring tier value, or null if no retirement fires.
 *
 * STUB — Phase 4 implementation pending.
 */
export function checkRetirement(
  _maxTileEver: TileValue,
  _currentSpawnPoolMax: TileValue
): TileValue | null {
  throw new Error('NotImplemented: retirement — implement in Phase 4');
}

/**
 * Advance the spawn pool window by one tier.
 *
 * STUB — Phase 4 implementation pending.
 */
export function advanceSpawnPool(
  _config: GameConfig,
  _retiredTier: TileValue
): Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'> {
  throw new Error('NotImplemented: retirement — implement in Phase 4');
}
