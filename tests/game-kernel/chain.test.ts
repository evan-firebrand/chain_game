import { describe, it, expect } from 'vitest';
import { validateChain, hasLegalChainStart, resolveChain, computeChainResult } from '../../src/game-kernel/index.js';
import type { Board, Cell, Tile, TileValue, GameConfig } from '../../src/game-kernel/types.js';

const ROWS = 7;
const COLS = 6;

function makeTile(value: number, retired = false): Tile {
  return { value: value as TileValue, retired };
}

function emptyTile(): Tile {
  return { value: 0 as TileValue, retired: false };
}

/**
 * Build a 7x6 board. Unlisted cells are empty (value=0).
 */
function makeBoard(cells: Array<{ row: number; col: number; value: number }>): Board {
  const grid: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => emptyTile())
  );

  for (const { row, col, value } of cells) {
    (grid[row] as Tile[])[col] = makeTile(value);
  }

  return grid as Board;
}

function cell(row: number, col: number): Cell {
  return { row: row as Cell['row'], col: col as Cell['col'] };
}

describe('validateChain — chain start (first two tiles)', () => {
  it('valid start: two adjacent same-value tiles', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1)]);
    expect(result.valid).toBe(true);
  });

  it('invalid start: two adjacent tiles with different values', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 8 },
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1)]);
    expect(result.valid).toBe(false);
  });

  it('invalid start: same-value tiles that are NOT adjacent', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 2, value: 4 }, // col 1 is empty, not adjacent
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 2)]);
    expect(result.valid).toBe(false);
  });

  it('invalid: chain of length 1 (minimum is 2)', () => {
    const board = makeBoard([{ row: 0, col: 0, value: 4 }]);
    const result = validateChain(board, [cell(0, 0)]);
    expect(result.valid).toBe(false);
  });
});

describe('validateChain — extensions (tile 3 onward)', () => {
  it('valid extension: same value as current end', () => {
    // [4, 4, 4] — second extension is same-value
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 4 },
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    expect(result.valid).toBe(true);
  });

  it('valid extension: double value of current end', () => {
    // [4, 4, 8] — 8 is double of current end 4
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 8 },
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    expect(result.valid).toBe(true);
  });

  it('invalid extension: triple value of current end', () => {
    // [4, 4, 12] would be triple — but 12 isn't a valid tile value; use [2, 2, 8] (quadruple)
    const board = makeBoard([
      { row: 0, col: 0, value: 2 },
      { row: 0, col: 1, value: 2 },
      { row: 0, col: 2, value: 8 }, // 8 is 4× the current end (2), not same or double
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    expect(result.valid).toBe(false);
  });

  it('invalid extension: half the value of current end (going down)', () => {
    // [8, 8, 4] — 4 is half of 8; must go up, not down
    const board = makeBoard([
      { row: 0, col: 0, value: 8 },
      { row: 0, col: 1, value: 8 },
      { row: 0, col: 2, value: 4 },
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1), cell(0, 2)]);
    expect(result.valid).toBe(false);
  });
});

describe('validateChain — path constraints', () => {
  it('invalid: cell reuse in chain', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
    ]);
    // Revisit cell (0,0)
    const result = validateChain(board, [cell(0, 0), cell(0, 1), cell(0, 0)]);
    expect(result.valid).toBe(false);
  });

  it('valid: path revisits a column but not a specific cell', () => {
    // Row 0: col0=4, col1=4, col2=4
    // Row 1: col1=4
    // Chain: (0,0) → (0,1) → (1,1) col is revisited for row 0,1
    // then (1,1)→(0,2) goes back through col 1 vicinity but different cells
    // Simpler: (0,0)→(1,0)→(1,1)→(0,1) — revisits col 0 and col 1 but not same cells
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 1, col: 0, value: 4 },
      { row: 1, col: 1, value: 4 },
      { row: 0, col: 1, value: 4 },
    ]);
    const result = validateChain(board, [
      cell(0, 0),
      cell(1, 0),
      cell(1, 1),
      cell(0, 1),
    ]);
    expect(result.valid).toBe(true);
  });

  it('valid extension: non-adjacent cells make the chain invalid', () => {
    // (0,0) and (0,2) are not adjacent
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 3, value: 4 }, // col 3 is not adjacent to col 1
    ]);
    const result = validateChain(board, [cell(0, 0), cell(0, 1), cell(0, 3)]);
    expect(result.valid).toBe(false);
  });
});

describe('validateChain — 8-way adjacency', () => {
  it('diagonal cells are adjacent (down-right)', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 1, col: 1, value: 4 }, // diagonal
    ]);
    const result = validateChain(board, [cell(0, 0), cell(1, 1)]);
    expect(result.valid).toBe(true);
  });

  it('diagonal cells are adjacent (down-left)', () => {
    const board = makeBoard([
      { row: 0, col: 1, value: 4 },
      { row: 1, col: 0, value: 4 }, // diagonal
    ]);
    const result = validateChain(board, [cell(0, 1), cell(1, 0)]);
    expect(result.valid).toBe(true);
  });

  it('diagonal cells are adjacent (up-right)', () => {
    const board = makeBoard([
      { row: 2, col: 0, value: 4 },
      { row: 1, col: 1, value: 4 }, // diagonal up-right
    ]);
    const result = validateChain(board, [cell(2, 0), cell(1, 1)]);
    expect(result.valid).toBe(true);
  });
});

describe('hasLegalChainStart', () => {
  it('returns true when at least one adjacent same-value pair exists', () => {
    const board = makeBoard([
      { row: 3, col: 2, value: 8 },
      { row: 3, col: 3, value: 8 }, // adjacent same-value pair
    ]);
    expect(hasLegalChainStart(board)).toBe(true);
  });

  it('returns false when no adjacent same-value pairs exist', () => {
    // Every adjacent pair has different values
    const board = makeBoard([
      { row: 0, col: 0, value: 2 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 2 }, // not adjacent to (0,0)
      { row: 1, col: 0, value: 8 },
      { row: 1, col: 1, value: 16 },
    ]);
    expect(hasLegalChainStart(board)).toBe(false);
  });

  it('returns true when only a diagonal same-value pair exists', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 16 },
      { row: 1, col: 1, value: 16 }, // diagonal
    ]);
    expect(hasLegalChainStart(board)).toBe(true);
  });

  it('returns false on completely empty board', () => {
    // All zeros — no non-zero same-value adjacent pairs
    const grid: Tile[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => emptyTile())
    );
    expect(hasLegalChainStart(grid as Board)).toBe(false);
  });
});

// ── resolveChain — happy-path coverage of defensive guards ───────────────
// Lines 80-86 in chain.ts are `if (lastCell === undefined)` and
// `if (lastTile === undefined)`. These are unreachable with a valid chain but
// the *check itself* (the truthy branch) executes on every call.
// Calling resolveChain with valid inputs exercises those lines.

const RESOLVE_CONFIG: Pick<GameConfig, 'ruleK'> = { ruleK: 2 };

describe('resolveChain — happy-path (covers defensive guard lines)', () => {
  it('2-cell same-value chain: sameExtensions=0, result=lastValue×2', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
    ]);
    const result = resolveChain(board, [cell(0, 0), cell(0, 1)], RESOLVE_CONFIG);
    expect(result.sameExtensions).toBe(0);
    expect(result.doublingExtensions).toBe(0);
    expect(result.resultValue).toBe(8); // 4×2 = 8
  });

  it('3-cell same-value chain: sameExtensions=1', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 4 },
    ]);
    const result = resolveChain(board, [cell(0, 0), cell(0, 1), cell(0, 2)], RESOLVE_CONFIG);
    expect(result.sameExtensions).toBe(1);
    expect(result.doublingExtensions).toBe(0);
  });

  it('3-cell doubling chain: doublingExtensions=1, sameExtensions=0', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
      { row: 0, col: 2, value: 8 }, // 8 = 4×2, doubling extension
    ]);
    const result = resolveChain(board, [cell(0, 0), cell(0, 1), cell(0, 2)], RESOLVE_CONFIG);
    expect(result.sameExtensions).toBe(0);
    expect(result.doublingExtensions).toBe(1);
    expect(result.resultValue).toBe(16); // lastTile=8, sameExtensions=0 → 8×2=16
  });

  it('4-cell same-value chain: sameExtensions=2, triggers bonus (ruleK=2 → floor(2/2)=1 extra doubling)', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 2 },
      { row: 0, col: 1, value: 2 },
      { row: 1, col: 1, value: 2 },
      { row: 1, col: 0, value: 2 },
    ]);
    const result = resolveChain(board, [cell(0, 0), cell(0, 1), cell(1, 1), cell(1, 0)], RESOLVE_CONFIG);
    expect(result.sameExtensions).toBe(2);
    // result = lastTile(2) × 2 × 2^floor(2/2) = 2×2×2 = 8
    expect(result.resultValue).toBe(8);
  });
});

describe('computeChainResult — covers resolveChain via public wrapper', () => {
  it('2-cell chain with value 8: result = 16', () => {
    const board = makeBoard([
      { row: 3, col: 3, value: 8 },
      { row: 3, col: 4, value: 8 },
    ]);
    const config: GameConfig = {
      gridRows: ROWS, gridCols: COLS, ruleK: 2,
      spawnPoolMin: 2, spawnPoolMax: 256,
      spawnWeights: {},
      prngSeed: 0,
    };
    expect(computeChainResult(board, [cell(3, 3), cell(3, 4)], config)).toBe(16);
  });
});
