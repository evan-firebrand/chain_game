import { describe, it, expect } from 'vitest';
import {
  computeChainResult,
  createGame,
  DEFAULT_CONFIG,
  resolveChain,
} from '../../../src/game-kernel/index.js';
import { resolveChainInPlace } from '../../../src/game-kernel/fast/chain.js';
import { fromPure } from '../../../src/game-kernel/fast/state.js';
import { packTile, packTileObj } from '../../../src/game-kernel/fast/encoding.js';
import { setTileInPlace } from '../../../src/game-kernel/fast/board.js';
import type {
  Board,
  Cell,
  GameConfig,
  Row,
  Col,
  Tile,
  TileValue,
} from '../../../src/game-kernel/types.js';

const ROWS = DEFAULT_CONFIG.gridRows;
const COLS = DEFAULT_CONFIG.gridCols;
const CONFIG: GameConfig = { ...DEFAULT_CONFIG, prngSeed: 42 };

function cell(r: number, c: number): Cell {
  return { row: r as Row, col: c as Col };
}

function makeBoard(layout: { row: number; col: number; value: number }[]): Board {
  const grid: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ value: 0 as TileValue, retired: false })),
  );
  for (const { row, col, value } of layout) {
    grid[row]![col] = { value: value as TileValue, retired: false };
  }
  return grid as Board;
}

function fastFromBoard(board: Board): ReturnType<typeof fromPure> {
  // Use a real GameState as the seed for fromPure (it just uses .config and .board)
  const seed = createGame(CONFIG);
  return fromPure({ ...seed, board });
}

const T_VECTORS = [
  { values: [2, 2], expected: 4 },
  { values: [2, 2, 2], expected: 4 },
  { values: [2, 2, 2, 2], expected: 8 },
  { values: [2, 2, 4, 8], expected: 16 },
  { values: [2, 2, 4, 4, 8], expected: 16 },
  { values: [2, 2, 2, 2, 4, 4, 8], expected: 32 },
  { values: [4, 4, 8], expected: 16 },
  { values: [2, 2, 2, 2, 2, 2], expected: 16 },
  { values: [2, 2, 4, 4, 4, 4, 8], expected: 32 },
];

describe('resolveChainInPlace — T1-T8b mandatory vectors', () => {
  for (const { values, expected } of T_VECTORS) {
    it(`[${values.join(',')}] → ${expected}`, () => {
      // Snake the chain across two rows so chains longer than 6 fit in
      // the 7×6 default geometry. Pattern: row 0 left→right, then row 1
      // right→left so the last cell of row 0 is adjacent to the first
      // cell of row 1.
      const layout = values.map((v, i) => {
        const row = Math.floor(i / COLS);
        const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
        return { row, col, value: v };
      });
      const board = makeBoard(layout);
      const chain: Cell[] = layout.map((p) => cell(p.row, p.col));
      const fast = fastFromBoard(board);
      const result = resolveChainInPlace(fast, chain, CONFIG);
      expect(result.resultValue).toBe(expected);
    });
  }
});

describe('resolveChainInPlace — equivalence with pure resolveChain', () => {
  it('matches pure resolveChain on seed=42 board for first legal pair', () => {
    const pure = createGame(CONFIG);
    const chain: Cell[] = [cell(0, 0), cell(0, 1)];
    const pureResult = resolveChain(pure.board, chain, CONFIG);
    const fast = fromPure(pure);
    const fastResult = resolveChainInPlace(fast, chain, CONFIG);
    expect(fastResult.resultValue).toBe(pureResult.resultValue);
    expect(fastResult.sameExtensions).toBe(pureResult.sameExtensions);
    expect(fastResult.doublingExtensions).toBe(pureResult.doublingExtensions);
  });

  it('matches pure on a 4-cell chain hand-built on seed=42', () => {
    // seed=42 board: row 0 has 2,2,4,2,2,2 — chain (0,0)→(0,1)→(0,2)→(0,3)
    // is 2,2,4,2: validateChainExtension on 4→2 fails, so we use a chain
    // we know works: 2,2,4,8 isn't on the board, but we can mock with
    // a custom board.
    const board = makeBoard([
      { row: 0, col: 0, value: 2 },
      { row: 0, col: 1, value: 2 },
      { row: 0, col: 2, value: 4 },
      { row: 0, col: 3, value: 8 },
    ]);
    const chain = [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)];
    const pureRes = resolveChain(board, chain, CONFIG);
    const fast = fastFromBoard(board);
    const fastRes = resolveChainInPlace(fast, chain, CONFIG);
    expect(fastRes).toEqual(pureRes);
    // Spot-check: T4 is exactly this chain → 16
    expect(fastRes.resultValue).toBe(16);
    expect(computeChainResult(board, chain, CONFIG)).toBe(16);
  });

  it('matches pure on a 6-cell same-value chain', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 2 },
      { row: 0, col: 1, value: 2 },
      { row: 1, col: 1, value: 2 },
      { row: 2, col: 1, value: 2 },
      { row: 2, col: 0, value: 2 },
      { row: 1, col: 0, value: 2 },
    ]);
    const chain = [cell(0, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(2, 0), cell(1, 0)];
    const pureRes = resolveChain(board, chain, CONFIG);
    const fast = fastFromBoard(board);
    const fastRes = resolveChainInPlace(fast, chain, CONFIG);
    expect(fastRes).toEqual(pureRes);
  });
});

describe('resolveChainInPlace — does not mutate the board', () => {
  it('repeated resolves return identical results', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
    ]);
    const fast = fastFromBoard(board);
    const a = resolveChainInPlace(fast, [cell(0, 0), cell(0, 1)], CONFIG);
    const b = resolveChainInPlace(fast, [cell(0, 0), cell(0, 1)], CONFIG);
    expect(a).toEqual(b);
  });

  it('an unrelated mutation between resolves changes the result accordingly', () => {
    const board = makeBoard([
      { row: 0, col: 0, value: 4 },
      { row: 0, col: 1, value: 4 },
    ]);
    const fast = fastFromBoard(board);
    const before = resolveChainInPlace(fast, [cell(0, 0), cell(0, 1)], CONFIG);
    // Mutate (0,1) to 8 — not a legal chain anymore, but resolveChainInPlace
    // is trusted-move and will compute a different lastValue / mismatched
    // bookkeeping. We only assert the result is computed *from the new board*.
    setTileInPlace(fast, 0, 1, packTile(8 as TileValue, false));
    const after = resolveChainInPlace(fast, [cell(0, 0), cell(0, 1)], CONFIG);
    expect(after.resultValue).not.toBe(before.resultValue);
  });
});
