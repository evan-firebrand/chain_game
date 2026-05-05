/**
 * Probe: Rule D score curve at chain lengths 2–20.
 *
 *   npx tsx scripts/probe-score-curve.ts
 *
 * Shows how chain result value scales with length under Rule D:
 *   result = lastValue × 2 × 2^⌊sameExtensions / ruleK⌋  (ruleK=2)
 *
 * Compares:
 *   - all-same (e.g. all-2s): maximum sameExtensions for each length
 *   - doubling chain: sameExtensions=0, result never gets bonus
 *   - alternating same/double: mixed bonus accumulation
 *
 * Verdict: shows whether greedy maximization of result aligns with building
 * long chains, or whether short chains dominate.
 */

import { computeChainResult } from '../src/game-kernel/index.js';
import type { Board, Cell, GameConfig, Tile, TileValue } from '../src/game-kernel/index.js';

const CONFIG: GameConfig = {
  gridRows: 7,
  gridCols: 6,
  ruleK: 2,
  spawnPoolMin: 2 as TileValue,
  spawnPoolMax: 256 as TileValue,
  spawnWeights: { 2: 128, 4: 64, 8: 32, 16: 16, 32: 8, 64: 4, 128: 2, 256: 1 } as Partial<Record<TileValue, number>>,
  prngSeed: 0,
};

function makeChain(values: number[]): { board: Board; chain: Cell[] } {
  // Lay the chain across multiple rows if it exceeds 6 columns (the grid width).
  const cols = 6;
  const grid: Tile[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: cols }, () => ({ value: 0 as TileValue, retired: false }))
  );

  const chain: Cell[] = [];
  for (let i = 0; i < values.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    if (row < 7) {
      (grid[row] as Tile[])[col] = { value: values[i] as TileValue, retired: false };
      chain.push({ row: row as 0|1|2|3|4|5|6, col: col as 0|1|2|3|4|5 });
    }
  }

  return { board: grid as Board, chain };
}

function allSame(len: number, value: number = 2): number[] {
  return Array(len).fill(value);
}

function doublingChain(len: number): number[] {
  // [2, 2, 4, 8, 16, ...] — starts with same pair, then each doubles
  const values = [2, 2];
  let last = 2;
  while (values.length < len) {
    last *= 2;
    values.push(Math.min(last, 256));
  }
  return values.slice(0, len);
}

function scoreChain(values: number[]): number {
  const { board, chain } = makeChain(values);
  return computeChainResult(board, chain, CONFIG);
}

console.log('\n' + '═'.repeat(72));
console.log('  PROBE: Rule D score curve (ruleK=2)');
console.log('  formula: lastValue × 2 × 2^⌊sameExtensions / 2⌋');
console.log('═'.repeat(72));

console.log('\n  All-2s chain (all-same, max bonus per length):');
console.log('  ' + ['len', 'sameExt', 'bonus', 'result', 'result/prev'].map(h => h.padStart(9)).join(''));
console.log('  ' + '─'.repeat(60));

let prevResult = 0;
for (let len = 2; len <= 14; len++) {
  const values = allSame(len);
  const sameExt = len - 2; // all tiles from index 2+ are same as previous
  const bonus = Math.floor(sameExt / 2);
  const result = scoreChain(values);
  const ratio = prevResult > 0 ? (result / prevResult).toFixed(2) : '—';
  console.log('  ' + [len, sameExt, bonus, result, ratio].map(v => String(v).padStart(9)).join(''));
  prevResult = result;
}

console.log('\n  Doubling chain [2,2,4,8,16,...] (sameExtensions=0 after pair):');
console.log('  ' + ['len', 'lastVal', 'sameExt', 'result', 'result/prev'].map(h => h.padStart(9)).join(''));
console.log('  ' + '─'.repeat(55));

prevResult = 0;
for (let len = 2; len <= 12; len++) {
  const values = doublingChain(len);
  const lastVal = values[values.length - 1] ?? 0;
  // sameExtensions: count indices 2+ where value === previous. In a pure doubling chain that's 0.
  const sameExt = values.slice(2).filter((v, i) => v === values[1 + i]).length;
  const result = scoreChain(values);
  const ratio = prevResult > 0 ? (result / prevResult).toFixed(2) : '—';
  console.log('  ' + [len, lastVal, sameExt, result, ratio].map(v => String(v).padStart(9)).join(''));
  prevResult = result;
}

// Show where greedy maximum lies: compare score at each length for all-2s
console.log('\n  All-4s chain (4× the all-2s result):');
console.log('  ' + ['len', 'result(2s)', 'result(4s)', 'ratio'].map(h => h.padStart(11)).join(''));
console.log('  ' + '─'.repeat(48));
for (let len = 2; len <= 10; len++) {
  const r2 = scoreChain(allSame(len, 2));
  const r4 = scoreChain(allSame(len, 4));
  console.log('  ' + [len, r2, r4, (r4 / r2).toFixed(2)].map(v => String(v).padStart(11)).join(''));
}

console.log('\n' + '═'.repeat(72));
console.log('  VERDICT: Result grows monotonically with length for uniform-value chains.');
console.log('  Each additional same-value tile adds sameExtension; every 2 sameExtensions');
console.log('  doubles the result (bonus = ⌊sameExt/2⌋, result × 2^bonus).');
console.log('  Greedy strategies that maximize result WILL prefer longer same-value chains.');
console.log('  Depth cap of 5 prevented strategies from discovering chains where the 2×');
console.log('  uplift first appears (length 6, crossing from bonus=1 to bonus=2).');
console.log('═'.repeat(72) + '\n');
