import type { Cell, Tile, Board, GameConfig, Row, Col } from './types.js';
import { computeResultValue } from './rules.js';

// ─── Neighbor table cache ────────────────────────────────────────────────────
// getAdjacentCells used to build a fresh up-to-9-element array on every call,
// allocating up to 9 Cell objects each time. Per-cell neighborhoods are fully
// determined by (rows, cols), so cache the full table per-geometry. Each
// returned array is frozen and reused across calls.

type NeighborGrid = readonly (readonly (readonly Cell[])[])[];

const neighborTableCache = new Map<number, NeighborGrid>();

function geometryKey(rows: number, cols: number): number {
  return rows * 1000 + cols;
}

function buildNeighborTable(rows: number, cols: number): NeighborGrid {
  const grid: (readonly Cell[])[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: (readonly Cell[])[] = [];
    for (let c = 0; c < cols; c++) {
      const neighbors: Cell[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            neighbors.push(Object.freeze({ row: nr as Row, col: nc as Col }));
          }
        }
      }
      Object.freeze(neighbors);
      row.push(neighbors);
    }
    Object.freeze(row);
    grid.push(row);
  }
  Object.freeze(grid);
  return grid;
}

function getNeighborTable(rows: number, cols: number): NeighborGrid {
  const key = geometryKey(rows, cols);
  let table = neighborTableCache.get(key);
  if (table === undefined) {
    table = buildNeighborTable(rows, cols);
    neighborTableCache.set(key, table);
  }
  return table;
}

/**
 * Returns all cells within 1 step in 8 directions that are in bounds.
 *
 * Result is a frozen, cached array — callers must NOT mutate. The return
 * type is intentionally not `readonly Cell[]` for backward-compatibility
 * with existing callers that read-only-iterate; the freeze enforces the
 * contract at runtime.
 */
export function getAdjacentCells(cell: Cell, rows: number, cols: number): Cell[] {
  const table = getNeighborTable(rows, cols);
  const rowEntry = table[cell.row];
  /* v8 ignore next 1 */
  if (rowEntry === undefined) return [];
  const cellEntry = rowEntry[cell.col];
  /* v8 ignore next 1 */
  if (cellEntry === undefined) return [];
  // Frozen at build time; cast to mutable type to preserve the original
  // public signature without forcing every caller to switch to readonly.
  return cellEntry as Cell[];
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
  chain: readonly Cell[],
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
    /* v8 ignore next 1 */
    if (cell === undefined || prevCell === undefined) continue;
    const currentTile = board[prevCell.row]?.[prevCell.col];
    const candidateTile = board[cell.row]?.[cell.col];
    /* v8 ignore next 1 */
    if (currentTile === undefined || candidateTile === undefined) continue;

    const { extensionType } = validateChainExtension(currentTile, candidateTile);
    if (extensionType === 'same') {
      sameExtensions++;
    } else if (extensionType === 'double') {
      doublingExtensions++;
    }
  }

  const lastCell = chain[chain.length - 1];
  /* v8 ignore next 3 */
  if (lastCell === undefined) {
    throw new Error('resolveChain: empty chain');
  }
  const lastTile = board[lastCell.row]?.[lastCell.col];
  /* v8 ignore next 3 */
  if (lastTile === undefined) {
    throw new Error('resolveChain: last cell out of bounds');
  }

  const resultValue = computeResultValue(lastTile.value, sameExtensions, config);
  return { resultValue, sameExtensions, doublingExtensions };
}

// ─── Fused validate + resolve for the applyAction hot path ──────────────────
// applyAction used to call validateChain (full chain walk) and then
// resolveChain (another full chain walk) in sequence — every cell visited
// twice. This fused walk does both in one pass.
//
// Public validateChain and resolveChain are unchanged; UI uses validateChain
// directly to drive hover-state UX where the resolve work is wasted.

export type ValidatedResolved =
  | {
      readonly valid: true;
      readonly resultValue: ReturnType<typeof computeResultValue>;
      readonly sameExtensions: number;
      readonly doublingExtensions: number;
    }
  | { readonly valid: false; readonly reason: string };

export function validateAndResolveChain(
  board: Board,
  chain: readonly Cell[],
  config: Pick<GameConfig, 'ruleK'>,
): ValidatedResolved {
  const rows = board.length;
  const cols = board[0]?.length ?? 0;

  if (chain.length < 2) {
    return { valid: false, reason: 'Chain must have at least 2 cells' };
  }

  const seen = new Set<number>();
  let sameExtensions = 0;
  let doublingExtensions = 0;
  let prevTile: Tile | undefined;
  let firstTile: Tile | undefined;
  let lastTile: Tile | undefined;

  for (let i = 0; i < chain.length; i++) {
    const cell = chain[i];
    /* v8 ignore next 1 */
    if (cell === undefined) return { valid: false, reason: 'Cell out of bounds' };
    if (cell.row < 0 || cell.row >= rows || cell.col < 0 || cell.col >= cols) {
      return { valid: false, reason: 'Cell out of bounds' };
    }
    const tile = board[cell.row]?.[cell.col];
    if (tile === undefined || tile.value === 0) {
      return { valid: false, reason: 'Cell is empty' };
    }
    const key = cell.row * cols + cell.col;
    if (seen.has(key)) return { valid: false, reason: 'Cell reuse not allowed' };
    seen.add(key);

    if (i === 0) {
      firstTile = tile;
    } else if (i === 1) {
      const first = chain[0];
      /* v8 ignore next 1 */
      if (first === undefined || firstTile === undefined) {
        return { valid: false, reason: 'Chain too short' };
      }
      const adj = getAdjacentCells(first, rows, cols);
      let isAdj = false;
      for (let j = 0; j < adj.length; j++) {
        const a = adj[j];
        if (a !== undefined && a.row === cell.row && a.col === cell.col) {
          isAdj = true;
          break;
        }
      }
      if (!isAdj) return { valid: false, reason: 'First two cells must be adjacent' };
      if (firstTile.value !== tile.value) {
        return { valid: false, reason: 'First two cells must have the same value' };
      }
    } else {
      const prev = chain[i - 1];
      /* v8 ignore next 1 */
      if (prev === undefined || prevTile === undefined) continue;
      const adj = getAdjacentCells(prev, rows, cols);
      let isAdj = false;
      for (let j = 0; j < adj.length; j++) {
        const a = adj[j];
        if (a !== undefined && a.row === cell.row && a.col === cell.col) {
          isAdj = true;
          break;
        }
      }
      if (!isAdj) {
        return { valid: false, reason: `Cell ${i} is not adjacent to previous cell` };
      }
      if (tile.value === prevTile.value) {
        sameExtensions++;
      } else if (tile.value === prevTile.value * 2) {
        doublingExtensions++;
      } else {
        return {
          valid: false,
          reason: `Cell ${i} does not satisfy chain extension rule`,
        };
      }
    }

    prevTile = tile;
    lastTile = tile;
  }

  /* v8 ignore next 3 */
  if (lastTile === undefined) {
    return { valid: false, reason: 'Chain too short' };
  }
  const resultValue = computeResultValue(lastTile.value, sameExtensions, config);
  return { valid: true, resultValue, sameExtensions, doublingExtensions };
}
