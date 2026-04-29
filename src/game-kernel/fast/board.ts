import type { Cell } from '../types.js';
import { PACKED_EMPTY } from './encoding.js';
import type { FastState } from './state.js';

// In-place board primitives. Every function here mutates `fast.board` and
// returns void — no allocation per call. Callers (sim-harness, the post-2.7
// pure-surface adapter) are responsible for owning the FastState lifetime.

/** Write a single packed byte at (row, col). */
export function setTileInPlace(
  fast: FastState,
  row: number,
  col: number,
  byte: number,
): void {
  fast.board[row * fast.cols + col] = byte;
}

/**
 * Clear every cell named in `cells`. No-op for cells outside the board
 * (defensive — chain validation should have caught those upstream).
 */
export function removeTilesInPlace(
  fast: FastState,
  cells: readonly Cell[],
): void {
  const cols = fast.cols;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    /* v8 ignore next 1 */
    if (cell === undefined) continue;
    fast.board[cell.row * cols + cell.col] = PACKED_EMPTY;
  }
}

/**
 * Apply gravity in place. Tiles fall DOWN to fill empty cells in each column;
 * tiles maintain relative order; empty cells accumulate at the top.
 *
 * Per-column algorithm: walk bottom-up with a write index that starts at the
 * bottom and only decreases. wr ≥ r always, so we never read from a cell
 * we've previously written. After the bottom-up scan, clear the remaining
 * top cells (rows 0..wr).
 */
export function applyGravityInPlace(fast: FastState): void {
  const { rows, cols, board } = fast;

  for (let c = 0; c < cols; c++) {
    let wr = rows - 1;
    for (let r = rows - 1; r >= 0; r--) {
      const byte = board[r * cols + c];
      if (byte !== PACKED_EMPTY && byte !== undefined) {
        if (r !== wr) {
          board[wr * cols + c] = byte;
        }
        wr--;
      }
    }
    // Clear the remaining top slots (rows 0..wr inclusive).
    for (let r = wr; r >= 0; r--) {
      board[r * cols + c] = PACKED_EMPTY;
    }
  }
}
