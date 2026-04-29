import type { Cell, Row, Col } from '../types.js';
import { lcgFloat, lcgNext, pickTileValue } from '../_internal.js';
import { PACKED_EMPTY, packTile } from './encoding.js';
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

/**
 * Spawn exactly `count` tiles. Walks columns left-to-right, top-to-bottom
 * in each column, placing one tile per empty cell until count is met or
 * the board is full. Advances fast.prngState in place.
 *
 * Spawn order matches the pure surface (board.ts findEmptyCells + spawnTiles)
 * so determinism is preserved across pure ↔ fast.
 */
export function spawnTilesInPlace(fast: FastState, count: number): void {
  if (count <= 0) return;
  const { rows, cols, board, config } = fast;
  let placed = 0;
  let prng = fast.prngState;
  for (let c = 0; c < cols && placed < count; c++) {
    for (let r = 0; r < rows && placed < count; r++) {
      const idx = r * cols + c;
      if (board[idx] === PACKED_EMPTY) {
        prng = lcgNext(prng);
        const rand = lcgFloat(prng);
        const value = pickTileValue(config, rand);
        board[idx] = packTile(value, false);
        placed++;
      }
    }
  }
  fast.prngState = prng;
}

/**
 * Returns true if any pair of adjacent same-value (non-empty) cells exists.
 * Compares the low-nibble (value) bits of packed bytes directly to skip
 * the unpackValue call in the hot inner loop.
 */
export function hasLegalChainStartFast(fast: FastState): boolean {
  const { rows, cols, board } = fast;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const byte = board[r * cols + c] ?? 0;
      const valueBits = byte & 0x0f;
      if (valueBits === 0) continue;
      // Check 8 neighbors. Inlined bounds check + same-value comparison.
      for (let dr = -1; dr <= 1; dr++) {
        const nr = r + dr;
        if (nr < 0 || nr >= rows) continue;
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = c + dc;
          if (nc < 0 || nc >= cols) continue;
          const nByte = board[nr * cols + nc] ?? 0;
          if ((nByte & 0x0f) === valueBits) return true;
        }
      }
    }
  }
  return false;
}

/**
 * Enumerate every legal 2-cell chain start as ordered Cell pairs.
 * Returns a flat array; each pair occupies two consecutive entries.
 *
 * Used by the random-walker strategy. Allocates one array per call —
 * future strategies that need to enumerate moves frequently can build
 * a scratch buffer-based variant.
 */
export function enumerateLegalPairsFast(fast: FastState): Cell[] {
  const { rows, cols, board } = fast;
  const out: Cell[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const byte = board[r * cols + c] ?? 0;
      const valueBits = byte & 0x0f;
      if (valueBits === 0) continue;
      // Forward neighbors only (down/right/down-left/down-right) — the
      // reverse pairs would be duplicates.
      for (const [dr, dc] of [
        [0, 1],
        [1, -1],
        [1, 0],
        [1, 1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
        const nByte = board[nr * cols + nc] ?? 0;
        if ((nByte & 0x0f) === valueBits) {
          out.push({ row: r as Row, col: c as Col });
          out.push({ row: nr as Row, col: nc as Col });
        }
      }
    }
  }
  return out;
}
