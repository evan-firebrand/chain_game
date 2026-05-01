/**
 * Probe: Greedy score curve vs chain length.
 *
 * The greedy bot picks argmax of mergeValue(chain) × chainLength.
 * This probe shows where that function peaks for representative chain shapes.
 * If the maximum within chains of length ≤5 is higher than the maximum at
 * longer lengths, greedy has a perverse incentive to stay short — even if
 * a longer chain exists on the board.
 *
 *   npx tsx scripts/probe-greedy-score-curve.ts
 */

import { mergeValue } from "../src/game/chain";
import { isMainModule } from "./_lib";

function greedyScore(values: number[]): number {
  return mergeValue(values) * values.length;
}

// All-same-value chain of length n
function allSame(value: number, n: number): number[] {
  return Array(n).fill(value);
}

// Alternating equal/double chain starting at `startVal`: [v,v,2v,2v,4v,4v,...]
function alternating(startVal: number, n: number): number[] {
  const chain: number[] = [];
  let v = startVal;
  for (let i = 0; i < n; i++) {
    chain.push(v);
    // Every two tiles, double the value
    if (chain.length % 2 === 0) v *= 2;
  }
  return chain;
}

export function main(_argv: string[]): void {
  const MAX_LEN = 20;

  console.log(`\nProbe: greedy score curve — mergeValue(chain) × length`);
  console.log(`\nAll-2s chain (n=2..${MAX_LEN}):`);
  console.log(`  ${"len".padStart(4)}  ${"sum".padStart(6)}  ${"mergeVal".padStart(10)}  ${"score".padStart(8)}  note`);
  console.log(`  ${"─".repeat(60)}`);

  let prevBracket = 0;
  for (let n = 2; n <= MAX_LEN; n++) {
    const vals = allSame(2, n);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mv = mergeValue(vals);
    const score = greedyScore(vals);
    const bracket = Math.ceil(Math.log2(sum));
    const jumpNote = bracket > prevBracket ? " ← power-of-2 boundary" : "";
    const capNote = n === 5 ? " ← MAX_DEPTH" : "";
    console.log(`  ${String(n).padStart(4)}  ${String(sum).padStart(6)}  ${String(mv).padStart(10)}  ${String(score).padStart(8)}${jumpNote}${capNote}`);
    prevBracket = bracket;
  }

  console.log(`\nAlternating chain [2,2,4,4,8,8,...] (n=2..${MAX_LEN}):`);
  console.log(`  ${"len".padStart(4)}  ${"tail".padStart(8)}  ${"sum".padStart(7)}  ${"mergeVal".padStart(10)}  ${"score".padStart(8)}`);
  console.log(`  ${"─".repeat(55)}`);

  for (let n = 2; n <= MAX_LEN; n++) {
    const vals = alternating(2, n);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mv = mergeValue(vals);
    const score = greedyScore(vals);
    const capNote = n === 5 ? "  ← MAX_DEPTH" : "";
    console.log(`  ${String(n).padStart(4)}  ${String(vals[vals.length - 1]).padStart(8)}  ${String(sum).padStart(7)}  ${String(mv).padStart(10)}  ${String(score).padStart(8)}${capNote}`);
  }

  // Find where scores compare: max within depth 5 vs max at depth 10/15/20
  const allSame2 = (n: number) => greedyScore(allSame(2, n));
  const alt = (n: number) => greedyScore(alternating(2, n));

  const maxAt5_same = Math.max(...[2, 3, 4, 5].map(allSame2));
  const maxAt10_same = allSame2(10);
  const maxAt15_same = allSame2(15);

  const maxAt5_alt = Math.max(...[2, 3, 4, 5].map(alt));
  const maxAt15_alt = alt(15);
  const maxAt20_alt = alt(20);

  console.log(`\nScore comparison: within MAX_DEPTH=5 vs longer chains`);
  console.log(`  all-2s:  max score at depth ≤5 = ${maxAt5_same}, at depth 10 = ${maxAt10_same}, at depth 15 = ${maxAt15_same}`);
  console.log(`  alt:     max score at depth ≤5 = ${maxAt5_alt}, at depth 15 = ${maxAt15_alt}, at depth 20 = ${maxAt20_alt}`);

  const altRatio15 = maxAt15_alt / maxAt5_alt;
  const altRatio20 = maxAt20_alt / maxAt5_alt;
  console.log(`  Depth-15 alt chain scores ${altRatio15.toFixed(1)}× a depth-5 chain; depth-20 scores ${altRatio20.toFixed(1)}×`);

  if (maxAt10_same > maxAt5_same || maxAt15_alt > maxAt5_alt * 2) {
    console.log(`\nVERDICT: CONFIRMED — longer chains score significantly higher. Greedy incentivises long chains but MAX_DEPTH=5 prevents finding them. Bot score data understates achievable scores.`);
  } else {
    console.log(`\nVERDICT: PARTIAL — score curve analysis inconclusive for these chain shapes. Review manually.`);
  }
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
