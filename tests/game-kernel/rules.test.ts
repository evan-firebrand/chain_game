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
    (grid[row] as Tile[])[col] = { value: value as TileValue, retired: false };
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

describe('computeChainResult — ruleK differentiation across k values', () => {
  // Documents the finding from `studies/01-skill-depth-spread.md` §A.6:
  // strategies in this codebase enumerate chains of length 2 or 3 only, which
  // means s ≤ 1 same-extensions, so ⌊s/k⌋ = 0 for any k ≥ 2. The kernel rule
  // differentiates k=2/3/4 only at s ≥ 2, i.e. chain length ≥ 4.

  function withK(k: number): GameConfig {
    return { ...DEFAULT_CONFIG, ruleK: k };
  }

  it('chain length 3 (s=1): k=2 and k=3 produce identical results', () => {
    const { board, chain } = chainFromValues([2, 2, 2]);
    const r2 = computeChainResult(board, chain, withK(2));
    const r3 = computeChainResult(board, chain, withK(3));
    const r4 = computeChainResult(board, chain, withK(4));
    expect(r2).toBe(4);
    expect(r3).toBe(4);
    expect(r4).toBe(4);
    expect(r2).toBe(r3);
    expect(r3).toBe(r4);
  });

  it('chain length 3 (s=1): k=1 differs from k≥2', () => {
    const { board, chain } = chainFromValues([2, 2, 2]);
    expect(computeChainResult(board, chain, withK(1))).toBe(8);
    expect(computeChainResult(board, chain, withK(2))).toBe(4);
  });

  it('chain length 4 (s=2): k=2 differs from k=3 (rule works as specified)', () => {
    const { board, chain } = chainFromValues([2, 2, 2, 2]);
    expect(computeChainResult(board, chain, withK(2))).toBe(8);
    expect(computeChainResult(board, chain, withK(3))).toBe(4);
    expect(computeChainResult(board, chain, withK(4))).toBe(4);
  });

  it('chain length 7 (s=5): k=2 differs from k=3, k=3 still equals k=4', () => {
    const { board, chain } = chainFromValues([2, 2, 2, 2, 2, 2, 2]);
    expect(computeChainResult(board, chain, withK(2))).toBe(16);
    expect(computeChainResult(board, chain, withK(3))).toBe(8);
    expect(computeChainResult(board, chain, withK(4))).toBe(8);
  });
});
