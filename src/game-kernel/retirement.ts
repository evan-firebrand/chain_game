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

  /* v8 ignore next 7 - nextTileValue only returns null past safe-integer range */
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
      tile.value === retiredTier ? { ...tile, retired: true, critical: false } : tile
    )
  ) as Board;
}

/**
 * Iterative fixed-point: mark retired tiles that can never be cleared as critical.
 *
 * A retired tile is critical if no non-critical matching partner exists in col-1, col,
 * or col+1 that is reachable without passing through another critical tile in the same
 * column. Repeats until stable — handles cascading cases where a partner becoming
 * critical makes its own dependent tiles critical.
 */
export function computeCriticalTiles(board: Board): Board {
  let current = board;
  let changed = true;

  while (changed) {
    changed = false;
    const rows = current.length;
    /* v8 ignore next 1 - board is always non-empty when this runs */
    const cols = current[0]?.length ?? 0;

    const next = current.map((row, r) =>
      row.map((tile, c) => {
        if (!tile.retired || tile.critical) return tile;
        if (!canReachPartner(current, r, c, tile.value, rows, cols)) {
          changed = true;
          return { ...tile, critical: true };
        }
        return tile;
      })
    ) as Board;

    current = next;
  }

  return current;
}

function canReachPartner(
  board: Board,
  row: number,
  col: number,
  value: TileValue,
  rows: number,
  cols: number,
): boolean {
  for (let dc = -1; dc <= 1; dc++) {
    const tc = col + dc;
    if (tc < 0 || tc >= cols) continue;

    for (let tr = 0; tr < rows; tr++) {
      if (dc === 0 && tr === row) continue;
      const candidate = board[tr]?.[tc];
      /* v8 ignore next 1 - tr and tc are always in-bounds on a complete board */
      if (candidate === undefined) continue;
      if (candidate.value !== value || candidate.critical) continue;

      if (dc === 0) {
        // Same column: blocked if any critical tile sits between row and tr
        const minR = Math.min(row, tr);
        const maxR = Math.max(row, tr);
        let blocked = false;
        for (let br = minR + 1; br < maxR; br++) {
          const between = board[br]?.[tc];
          /* v8 ignore next 1 - br and tc are always in-bounds */
          if (between === undefined) continue;
          if (between.critical) { blocked = true; break; }
        }
        if (!blocked) return true;
      } else {
        // Adjacent column: non-critical partner exists — consider reachable
        return true;
      }
    }
  }
  return false;
}
