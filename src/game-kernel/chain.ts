import type { Cell, Tile, Board, GameConfig, Row, Col } from './types.js';
import { computeResultValue } from './rules.js';

/**
 * Returns all cells within 1 step in 8 directions that are in bounds.
 */
export function getAdjacentCells(cell: Cell, rows: number, cols: number): Cell[] {
  const result: Cell[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = cell.row + dr;
      const c = cell.col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        result.push({ row: r as Row, col: c as Col });
      }
    }
  }
  return result;
}

/**
 * Validates whether candidateTile can extend a chain whose current end is currentTile.
 * - 'same': candidateTile.value === currentTile.value
 * - 'double': candidateTile.value === currentTile.value * 2
 * - 'invalid': neither
 */
export function validateChainExtension(
  currentTile: Tile,
  candidateTile: Tile
): { valid: boolean; extensionType: 'same' | 'double' | 'invalid' } {
  if (candidateTile.value === currentTile.value) {
    return { valid: true, extensionType: 'same' };
  }
  if (candidateTile.value === currentTile.value * 2) {
    return { valid: true, extensionType: 'double' };
  }
  return { valid: false, extensionType: 'invalid' };
}

/**
 * Given an ordered chain of cells, resolves the chain result.
 * Returns { resultValue, sameExtensions, doublingExtensions }.
 *
 * sameExtensions: number of extensions (beyond initial pair, index >= 2) where extensionType === 'same'
 * doublingExtensions: extensions where extensionType === 'double'
 * resultValue: computeResultValue(lastTile.value, sameExtensions, config)
 */
export function resolveChain(
  board: Board,
  chain: ReadonlyArray<Cell>,
  config: Pick<GameConfig, 'ruleK'>
): { resultValue: ReturnType<typeof computeResultValue>; sameExtensions: number; doublingExtensions: number } {
  let sameExtensions = 0;
  let doublingExtensions = 0;

  // Extensions start from index 1 (each tile after the first).
  // But per spec: "same-value extensions beyond the initial pair" — the pair itself (index 0→1)
  // is the chain start (same-value required). Extensions beyond that start at index 2.
  // However, we also need to track: index 1 tile establishes the "pair" but isn't an "extension".
  // Extensions counted from index 2 onward.

  for (let i = 2; i < chain.length; i++) {
    const cell = chain[i];
    const prevCell = chain[i - 1];
    if (cell === undefined || prevCell === undefined) continue;
    const currentTile = board[prevCell.row]?.[prevCell.col];
    const candidateTile = board[cell.row]?.[cell.col];
    if (currentTile === undefined || candidateTile === undefined) continue;

    const { extensionType } = validateChainExtension(currentTile, candidateTile);
    if (extensionType === 'same') {
      sameExtensions++;
    } else if (extensionType === 'double') {
      doublingExtensions++;
    }
  }

  const lastCell = chain[chain.length - 1];
  if (lastCell === undefined) {
    throw new Error('resolveChain: empty chain');
  }
  const lastTile = board[lastCell.row]?.[lastCell.col];
  if (lastTile === undefined) {
    throw new Error('resolveChain: last cell out of bounds');
  }

  const resultValue = computeResultValue(lastTile.value, sameExtensions, config);
  return { resultValue, sameExtensions, doublingExtensions };
}
