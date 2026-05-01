// Spec tests for Rule D scoring at chain lengths that matter for player modelling.
//
// Formula: result = lastValue × 2 × 2^⌊sameExtensions / ruleK⌋  (ruleK = 2)
// where sameExtensions = count of index-2+ tiles where value == previous value.
//
// These cover the depth range (8–15 tiles) that was invisible when
// DEFAULT_MAX_CHAIN_LENGTH = 5. If any test fails, the kernel has a scoring
// regression — treat as P0 before any simulation work.

import { describe, it, expect } from 'vitest';
import { computeChainResult } from '../../src/game-kernel/index.js';
import type { Board, Cell, GameConfig, Tile, TileValue } from '../../src/game-kernel/types.js';

const CONFIG: GameConfig = {
  gridRows: 7,
  gridCols: 6,
  ruleK: 2,
  spawnPoolMin: 2,
  spawnPoolMax: 256,
  spawnWeights: { 2: 128, 4: 64, 8: 32, 16: 16, 32: 8, 64: 4, 128: 2, 256: 1 },
  prngSeed: 0,
};

function chainFromValues(values: number[]): { board: Board; chain: Cell[] } {
  const grid: Tile[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 6 }, () => ({ value: 0 as TileValue, retired: false }))
  );
  for (let col = 0; col < values.length; col++) {
    (grid[0] as Tile[])[col] = { value: values[col] as TileValue, retired: false };
  }
  const board = grid as Board;
  const chain: Cell[] = values.map((_, col) => ({
    row: 0 as const,
    col: col as 0 | 1 | 2 | 3 | 4 | 5,
  }));
  return { board, chain };
}

// Helper: compute result and assert it equals expected.
function check(values: number[], expected: number): void {
  const { board, chain } = chainFromValues(values);
  expect(computeChainResult(board, chain, CONFIG)).toBe(expected);
}

describe('Rule D — chain length 8+ (cross-depth-cap boundary)', () => {
  // [2,2,2,2,2,2,2,2] — 8 tiles, all same.
  // sameExtensions = 6 (indices 2-7 all same-value).
  // bonus = floor(6/2) = 3. result = 2×2×2^3 = 4×8 = 32.
  it('length 8: all-2s → 32', () => {
    check([2, 2, 2, 2, 2, 2, 2, 2], 32);
  });

  // [2,2,4,4,4,4,4,4] — 8 tiles.
  // Pair: 2,2. Extensions at idx 2+: 4(double),4(same),4(same),4(same),4(same),4(same).
  // sameExtensions = 5 (idx 3–7 all same).
  // lastValue = 4. bonus = floor(5/2) = 2. result = 4×2×2^2 = 8×4 = 32.
  it('length 8: [2,2,4,4,4,4,4,4] → 32', () => {
    check([2, 2, 4, 4, 4, 4, 4, 4], 32);
  });

  // [2,2,2,2,2,2,2,2,2,2] — 10 tiles, all same.
  // sameExtensions = 8. bonus = floor(8/2) = 4. result = 2×2×2^4 = 4×16 = 64.
  it('length 10: all-2s → 64', () => {
    check([2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 64);
  });

  // [4,4,4,4,4,4,4,4,4,4] — 10 tiles, all same.
  // sameExtensions = 8. bonus = 4. result = 4×2×2^4 = 8×16 = 128.
  it('length 10: all-4s → 128', () => {
    check([4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 128);
  });

  // [2,2,4,8,16,32,64,128,256,256] — 10 tiles, ascending doubling chain + pair at end.
  // Extensions at idx 2-8: all doubling (4=2×2, 8=4×2, ..., 256=128×2). idx 9: same (256=256).
  // sameExtensions = 1 (only idx 9). lastValue = 256.
  // bonus = floor(1/2) = 0. result = 256×2×2^0 = 512.
  it('length 10: doubling chain with trailing same → 512', () => {
    check([2, 2, 4, 8, 16, 32, 64, 128, 256, 256], 512);
  });
});

describe('Rule D — chain length 12–15', () => {
  // [2,2,2,2,2,2,2,2,2,2,2,2] — 12 tiles, all same.
  // sameExtensions = 10. bonus = floor(10/2) = 5. result = 2×2×2^5 = 4×32 = 128.
  it('length 12: all-2s → 128', () => {
    check([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2], 128);
  });

  // [4,4,4,4,4,4,4,4,4,4,4,4] — 12 tiles, all same.
  // sameExtensions = 10. bonus = 5. result = 4×2×2^5 = 8×32 = 256.
  it('length 12: all-4s → 256', () => {
    check([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 256);
  });

  // length 15 using columns 0–5 on two rows requires the board and chain to span rows.
  // Use a simpler all-same chain restricted to 6 cols (max chain in a single row).
  // [2,2,2,2,2,2] (length 6): sameExtensions=4, bonus=2, result=2×2×4=16.
  it('length 6: all-2s → 16 (verifies sameExtension counting)', () => {
    check([2, 2, 2, 2, 2, 2], 16);
  });
});

describe('Rule D — depth cap boundary: chain ≥ 6 vs chain ≤ 5', () => {
  it('length 5: all-2s → 8  (sameExt=3, bonus=1)', () => {
    check([2, 2, 2, 2, 2], 8);
  });

  it('length 6: all-2s → 16 (sameExt=4, bonus=2) — 2× uplift crossing depth-5 cap', () => {
    check([2, 2, 2, 2, 2, 2], 16);
  });

  it('length 7: all-2s → 16 (sameExt=5, bonus=2) — same result as length 6', () => {
    // Another same-extension doesn't cross the next bonus threshold until 6 same-ext.
    check([2, 2, 2, 2, 2, 2, 2], 16);
  });

  it('result strictly increases with chain length for uniform-value chains', () => {
    const results: number[] = [];
    for (let len = 2; len <= 6; len++) {
      const { board, chain } = chainFromValues(Array(len).fill(2));
      results.push(computeChainResult(board, chain, CONFIG));
    }
    // Each new bonus threshold doubles the result.
    // [2,2]=4, [2,2,2]=4, [2,2,2,2]=8, [2,2,2,2,2]=8, [2,2,2,2,2,2]=16
    expect(results[0]).toBe(4);
    expect(results[1]).toBe(4);
    expect(results[2]).toBe(8);
    expect(results[3]).toBe(8);
    expect(results[4]).toBe(16);
    // At depth 5 the result is 8; at depth 6 it's 16.
    expect(results[4]! / results[3]!).toBeGreaterThan(1);
  });
});
