import { describe, it, expect } from 'vitest';
import { computeChainResult } from '../../src/game-kernel/index.js';
import type { Board, Cell, GameConfig, Tile, TileValue } from '../../src/game-kernel/types.js';

const DEFAULT_CONFIG: GameConfig = {
  gridRows: 7,
  gridCols: 6,
  ruleK: 2,
  spawnPoolMin: 2,
  spawnPoolMax: 256,
  spawnWeights: { 2: 128, 4: 64, 8: 32, 16: 16, 32: 8, 64: 4, 128: 2, 256: 1 },
  prngSeed: 0,
};

/**
 * Build a 7x6 board. Cells not listed default to value=0, retired=false.
 */
function makeBoard(cells: { row: number; col: number; value: number }[]): Board {
  const rows = DEFAULT_CONFIG.gridRows;
  const cols = DEFAULT_CONFIG.gridCols;

  const grid: Tile[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
  );

  for (const { row, col, value } of cells) {
    (grid[row] as Tile[])[col] = { value, retired: false };
  }

  return grid as Board;
}

/**
 * Build a chain of adjacent cells in row 0, cols 0..values.length-1,
 * plus the board that holds those values.
 */
function chainFromValues(values: number[]): { board: Board; chain: Cell[] } {
  const cells = values.map((value, col) => ({ row: 0, col, value }));
  const board = makeBoard(cells);
  const chain: Cell[] = values.map((_, col) => ({
    row: 0 as const,
    col: col as 0 | 1 | 2 | 3 | 4 | 5,
  }));
  return { board, chain };
}

describe('computeChainResult — mandatory T1-T8b spec vectors', () => {
  it('T1: [2, 2] → 4', () => {
    const { board, chain } = chainFromValues([2, 2]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(4);
  });

  it('T2: [2, 2, 2] → 4', () => {
    const { board, chain } = chainFromValues([2, 2, 2]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(4);
  });

  it('T3: [2, 2, 2, 2] → 8', () => {
    const { board, chain } = chainFromValues([2, 2, 2, 2]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(8);
  });

  it('T4: [2, 2, 4, 8] → 16', () => {
    const { board, chain } = chainFromValues([2, 2, 4, 8]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(16);
  });

  it('T5: [2, 2, 4, 4, 8] → 16', () => {
    const { board, chain } = chainFromValues([2, 2, 4, 4, 8]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(16);
  });

  it('T6: [2, 2, 2, 2, 4, 4, 8] → 32', () => {
    const { board, chain } = chainFromValues([2, 2, 2, 2, 4, 4, 8]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(32);
  });

  it('T7: [4, 4, 8] → 16', () => {
    const { board, chain } = chainFromValues([4, 4, 8]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(16);
  });

  it('T8a: [2, 2, 2, 2, 2, 2] → 16', () => {
    const { board, chain } = chainFromValues([2, 2, 2, 2, 2, 2]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(16);
  });

  it('T8b: [2, 2, 4, 4, 4, 4, 8] → 32', () => {
    const { board, chain } = chainFromValues([2, 2, 4, 4, 4, 4, 8]);
    expect(computeChainResult(board, chain, DEFAULT_CONFIG)).toBe(32);
  });
});

describe('computeChainResult — ruleK edge cases', () => {
  it('ruleK=0 never divides by zero — result is lastValue × 2', () => {
    const cfg: GameConfig = { ...DEFAULT_CONFIG, ruleK: 0 };
    const { board, chain } = chainFromValues([2, 2, 2, 2, 2, 2]);
    expect(computeChainResult(board, chain, cfg)).toBe(4);
  });
});

describe('computeChainResult — property tests', () => {
  it('always returns a power of 2', () => {
    const isPowerOf2 = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

    const testCases: number[][] = [
      [2, 2],
      [4, 4],
      [8, 8],
      [2, 2, 2],
      [2, 2, 2, 2],
      [4, 4, 8],
      [2, 2, 4, 8],
      [2, 2, 4, 4, 8],
      [8, 8, 16],
      [16, 16, 32],
      [2, 2, 2, 2, 2, 2],
      [4, 4, 4, 4],
    ];

    for (const values of testCases) {
      const { board, chain } = chainFromValues(values);
      const result = computeChainResult(board, chain, DEFAULT_CONFIG);
      expect(
        isPowerOf2(result),
        `Expected ${result} (from chain [${values.join(',')}]) to be a power of 2`
      ).toBe(true);
    }
  });

  it('result is always >= the last tile value × 2', () => {
    const testCases: number[][] = [
      [2, 2],
      [4, 4],
      [2, 2, 4, 8],
      [4, 4, 8],
    ];

    for (const values of testCases) {
      const { board, chain } = chainFromValues(values);
      const result = computeChainResult(board, chain, DEFAULT_CONFIG);
      const lastValue = values[values.length - 1]!;
      expect(
        result,
        `chain [${values.join(',')}]: result ${result} should be >= lastValue*2 (${lastValue * 2})`
      ).toBeGreaterThanOrEqual(lastValue * 2);
    }
  });
});
