import type { Board, Cell, Tile, TileValue, GameConfig, Row, Col } from './types.js';
import { EMPTY_TILE, lcgFloat, lcgNext, pickTileValue } from './_internal.js';

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
export function removeTiles(board: Board, cells: readonly Cell[]): Board {
  const cols = board[0]?.length ?? 0;
  const cellSet = new Set<number>();
  for (const c of cells) {
    cellSet.add(c.row * cols + c.col);
  }
  return board.map((rowArr, r) =>
    rowArr.map((tile, c) =>
      cellSet.has(r * cols + c) ? EMPTY_TILE : tile
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
  /* v8 ignore next 2 */
  if (rows === 0) return board;
  const cols = board[0]?.length ?? 0;

  // Build new board as mutable array. Pre-fill every cell with the shared
  // EMPTY_TILE; columns that have non-empty tiles will overwrite the
  // bottom slots in the loop below.
  const newBoard: Tile[][] = Array.from({ length: rows }, () => {
    const row: Tile[] = new Array(cols);
    for (let i = 0; i < cols; i++) row[i] = EMPTY_TILE;
    return row;
  });

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
 * Find empty cells starting from top of each column, left-to-right.
 * Returns cells in order: col 0 top-to-bottom, then col 1, etc.
 */
function findEmptyCells(board: Board): Cell[] {
  const rows = board.length;
  /* v8 ignore next 1 */
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
): { board: Board; prngState: number; spawned: { cell: Cell; value: TileValue }[] } {
  const spawnCount = chainLength - 1;
  /* v8 ignore next 3 */
  if (spawnCount <= 0) {
    return { board, prngState, spawned: [] };
  }

  const emptyCells = findEmptyCells(board);
  const spawned: { cell: Cell; value: TileValue }[] = [];
  let currentBoard = board;
  let currentPrng = prngState;

  for (let i = 0; i < spawnCount && i < emptyCells.length; i++) {
    const cell = emptyCells[i];
    /* v8 ignore next 1 */
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
