import type { Board, Cell, Tile, TileValue, GameConfig, Row, Col } from './types.js';

/**
 * Simple seeded LCG (Linear Congruential Generator).
 * Returns the next state.
 */
function lcgNext(state: number): number {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}

/**
 * Convert LCG state to [0, 1) float.
 */
function lcgFloat(state: number): number {
  return state / 0x100000000;
}

/**
 * Place a tile at a cell, returning a new board.
 */
export function setTile(board: Board, cell: Cell, tile: Tile): Board {
  return board.map((rowArr, r) =>
    r === cell.row
      ? rowArr.map((t, c) => (c === cell.col ? tile : t))
      : rowArr
  ) as Board;
}

/**
 * Remove tiles at the given cells, returning a new board with those cells empty.
 */
export function removeTiles(board: Board, cells: ReadonlyArray<Cell>): Board {
  const cellSet = new Set(cells.map(c => `${c.row},${c.col}`));
  return board.map((rowArr, r) =>
    rowArr.map((tile, c) =>
      cellSet.has(`${r},${c}`) ? { value: 0 as TileValue, retired: false } : tile
    )
  ) as Board;
}

/**
 * Apply gravity: tiles fall DOWN to fill empty cells in each column.
 * Process each column independently. Tiles maintain relative order.
 * Empty cells accumulate at the top.
 */
export function applyGravity(board: Board): Board {
  const rows = board.length;
  if (rows === 0) return board;
  const cols = board[0]?.length ?? 0;

  // Build new board as mutable array
  const newBoard: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
  );

  for (let c = 0; c < cols; c++) {
    // Collect non-empty tiles from top to bottom
    const nonEmpty: Tile[] = [];
    for (let r = 0; r < rows; r++) {
      const tile = board[r]?.[c];
      if (tile !== undefined && tile.value !== 0) {
        nonEmpty.push(tile);
      }
    }
    // Place non-empty tiles at the BOTTOM, empties at top
    const emptyCount = rows - nonEmpty.length;
    for (let i = 0; i < nonEmpty.length; i++) {
      const tile = nonEmpty[i];
      if (tile !== undefined && newBoard[emptyCount + i] !== undefined) {
        (newBoard[emptyCount + i] as Tile[])[c] = tile;
      }
    }
  }

  return newBoard as Board;
}

/**
 * Pick a tile value from spawn pool using weighted random selection.
 */
function pickTileValue(
  config: Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'>,
  rand: number
): TileValue {
  // Build list of (value, weight) pairs for values in [spawnPoolMin, spawnPoolMax]
  const entries: Array<[TileValue, number]> = [];
  let totalWeight = 0;

  let v = config.spawnPoolMin;
  while (v <= config.spawnPoolMax) {
    const weight = config.spawnWeights[v] ?? 0;
    if (weight > 0) {
      entries.push([v, weight]);
      totalWeight += weight;
    }
    v = (v * 2) as TileValue;
  }

  if (totalWeight === 0 || entries.length === 0) {
    // Fallback: return spawnPoolMin
    return config.spawnPoolMin;
  }

  let threshold = rand * totalWeight;
  for (const [val, weight] of entries) {
    threshold -= weight;
    if (threshold <= 0) {
      return val;
    }
  }

  // Fallback: last entry
  const last = entries[entries.length - 1];
  return last !== undefined ? last[0] : config.spawnPoolMin;
}

/**
 * Find empty cells starting from top of each column, left-to-right.
 * Returns cells in order: col 0 top-to-bottom, then col 1, etc.
 */
function findEmptyCells(board: Board): Cell[] {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;
  const empties: Cell[] = [];

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const tile = board[r]?.[c];
      if (tile !== undefined && tile.value === 0) {
        empties.push({ row: r as Row, col: c as Col });
      }
    }
  }
  return empties;
}

/**
 * Spawn exactly chainLength - 1 tiles.
 * Finds empty cells starting from top of each column left-to-right.
 * Uses seeded PRNG to pick tile values from spawn pool weighted by spawnWeights.
 */
export function spawnTiles(
  board: Board,
  chainLength: number,
  config: GameConfig,
  prngState: number
): { board: Board; prngState: number; spawned: Array<{ cell: Cell; value: TileValue }> } {
  const spawnCount = chainLength - 1;
  if (spawnCount <= 0) {
    return { board, prngState, spawned: [] };
  }

  const emptyCells = findEmptyCells(board);
  const spawned: Array<{ cell: Cell; value: TileValue }> = [];
  let currentBoard = board;
  let currentPrng = prngState;

  for (let i = 0; i < spawnCount && i < emptyCells.length; i++) {
    const cell = emptyCells[i];
    if (cell === undefined) break;

    // Advance PRNG
    currentPrng = lcgNext(currentPrng);
    const rand = lcgFloat(currentPrng);
    const value = pickTileValue(config, rand);

    currentBoard = setTile(currentBoard, cell, { value, retired: false });
    spawned.push({ cell, value });
  }

  return { board: currentBoard, prngState: currentPrng, spawned };
}
