// Tests for post-hoc board-analysis helpers in common.ts.
// These helpers don't drive strategy decisions — they're used by study scripts
// to characterize board state during/after games.

import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, createGame, setTile } from '../../src/game-kernel/index.js';
import type { Board, Cell, TileValue } from '../../src/game-kernel/index.js';
import {
  isolatedTilesByTier,
  largestAvailableChain,
  maxTileOnBoard,
  tilesByTier,
} from '../../src/sim-harness/index.js';

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

function emptyBoard(rows: number, cols: number): Board {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
  ) as Board;
}

describe('maxTileOnBoard', () => {
  it('returns 0 for an empty board', () => {
    expect(maxTileOnBoard(emptyBoard(3, 3))).toBe(0);
  });

  it('returns the highest tile value present', () => {
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(1, 1), { value: 16 as TileValue, retired: false });
    board = setTile(board, cell(2, 2), { value: 8 as TileValue, retired: false });
    expect(maxTileOnBoard(board)).toBe(16);
  });

  it('ignores retired flag — returns highest value regardless of retirement', () => {
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 4 as TileValue, retired: true });
    board = setTile(board, cell(1, 1), { value: 8 as TileValue, retired: false });
    expect(maxTileOnBoard(board)).toBe(8);
  });
});

describe('tilesByTier', () => {
  it('returns empty map for an empty board', () => {
    expect(tilesByTier(emptyBoard(3, 3)).size).toBe(0);
  });

  it('counts tiles per value, excluding empties', () => {
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 2), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(1, 0), { value: 8 as TileValue, retired: false });

    const counts = tilesByTier(board);
    expect(counts.get(2 as TileValue)).toBe(2);
    expect(counts.get(4 as TileValue)).toBe(1);
    expect(counts.get(8 as TileValue)).toBe(1);
    expect(counts.size).toBe(3);
  });
});

describe('isolatedTilesByTier', () => {
  it('returns empty map for an empty board', () => {
    expect(isolatedTilesByTier(emptyBoard(3, 3)).size).toBe(0);
  });

  it('only counts tiles with no same-value neighbor', () => {
    // Layout (3×3):
    //   2 2 .
    //   . 4 .
    //   . . 8
    // 2s neighbor each other → not isolated. 4 and 8 are isolated.
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(1, 1), { value: 4 as TileValue, retired: false });
    board = setTile(board, cell(2, 2), { value: 8 as TileValue, retired: false });

    const counts = isolatedTilesByTier(board);
    expect(counts.get(2 as TileValue)).toBeUndefined();
    expect(counts.get(4 as TileValue)).toBe(1);
    expect(counts.get(8 as TileValue)).toBe(1);
  });

  it('counts all tiles regardless of retirement status', () => {
    // The retired-only variant is countIsolatedRetiredTiles; this one is broader.
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: true });
    board = setTile(board, cell(2, 2), { value: 4 as TileValue, retired: false });

    const counts = isolatedTilesByTier(board);
    expect(counts.get(2 as TileValue)).toBe(1);
    expect(counts.get(4 as TileValue)).toBe(1);
  });
});

describe('largestAvailableChain', () => {
  it('returns 0 when no chain is possible', () => {
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(2, 2), { value: 4 as TileValue, retired: false });
    const state = { ...createGame({ ...DEFAULT_CONFIG, prngSeed: 1 }), board };
    expect(largestAvailableChain(state)).toBe(0);
  });

  it('finds the longest valid chain when one is obvious', () => {
    // Two adjacent 2s + adjacent 4 can chain as [2, 2, 4] (Rule D extension).
    let board = emptyBoard(3, 3);
    board = setTile(board, cell(0, 0), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 1), { value: 2 as TileValue, retired: false });
    board = setTile(board, cell(0, 2), { value: 4 as TileValue, retired: false });
    const state = { ...createGame({ ...DEFAULT_CONFIG, prngSeed: 1 }), board };
    expect(largestAvailableChain(state)).toBeGreaterThanOrEqual(3);
  });
});
