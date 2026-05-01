/**
 * Probe: depth cap impact on simulated play.
 *
 *   npx tsx scripts/probe-chain-depth.ts
 *
 * Shows what fraction of chains each archetype plays beyond 5 tiles.
 * casual (depth 5) should be bounded at 5; engaged (depth 12) should exceed
 * that on boards where longer chains exist.
 *
 * Verdict: CONFIRMED if skilled finds >10% more chains > 5 than casual.
 */

import { runSimulation } from '../src/sim-harness/index.js';
import {
  casualStrategy,
  engagedStrategy,
  skilledStrategy,
} from '../src/sim-harness/index.js';
import { DEFAULT_CONFIG } from '../src/game-kernel/index.js';

// Keep runs and turns low: depth-20 DFS over a 7x6 board is expensive.
// 5 games × 30 turns is enough to confirm the distribution difference.
const RUNS = 5;
const SEED = 42;
const MAX_TURNS = 30;

const strategies = [
  { label: 'casual     (depth  5)', strategy: casualStrategy },
  { label: 'engaged    (depth 12)', strategy: engagedStrategy },
  { label: 'skilled    (depth 20)', strategy: skilledStrategy },
];

function percentile(sorted: number[], p: number): number {
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

console.log('\n' + '='.repeat(72));
console.log('  PROBE: Chain depth cap impact');
console.log(`  N=${RUNS} games per strategy, seed=${SEED}, maxTurns=${MAX_TURNS}`);
console.log('='.repeat(72));
console.log(
  `  ${'strategy'.padEnd(28)} ${'p10'.padStart(5)} ${'med'.padStart(5)} ${'p90'.padStart(5)} ${'max'.padStart(5)} ${'%>5'.padStart(8)}`
);
console.log('  ' + '-'.repeat(64));

const pctAbove5ByLabel: Record<string, number> = {};

for (const { label, strategy } of strategies) {
  const result = runSimulation({
    config: DEFAULT_CONFIG,
    strategy,
    runs: RUNS,
    seed: SEED,
    maxTurns: MAX_TURNS,
    maxChainLength: 30,
  });

  const lengths: number[] = [];
  for (const game of result.games) {
    for (const turn of game.turns) {
      lengths.push(turn.chainLength);
    }
  }
  lengths.sort((a, b) => a - b);

  const p10 = percentile(lengths, 0.1);
  const med = percentile(lengths, 0.5);
  const p90 = percentile(lengths, 0.9);
  const max = lengths[lengths.length - 1] ?? 0;
  const pct = lengths.filter(l => l > 5).length / lengths.length;

  pctAbove5ByLabel[label] = pct;
  console.log(
    `  ${label.padEnd(28)} ${String(p10).padStart(5)} ${String(med).padStart(5)} ` +
    `${String(p90).padStart(5)} ${String(max).padStart(5)} ${(pct * 100).toFixed(0).padStart(7)}%`
  );
}

const casualPct = pctAbove5ByLabel['casual     (depth  5)'] ?? 0;
const skilledPct = pctAbove5ByLabel['skilled    (depth 20)'] ?? 0;
const delta = skilledPct - casualPct;

console.log('\n  Chain bucket summary:');
console.log(`  ${'bucket'.padEnd(12)} ${'casual'.padStart(10)} ${'engaged'.padStart(10)} ${'skilled'.padStart(10)}`);
console.log('  ' + '-'.repeat(46));

const labels = ['casual     (depth  5)', 'engaged    (depth 12)', 'skilled    (depth 20)'];
const allLengths: Record<string, number[]> = {};

for (const { label, strategy } of strategies) {
  const result = runSimulation({
    config: DEFAULT_CONFIG,
    strategy,
    runs: RUNS,
    seed: SEED + 1,
    maxTurns: MAX_TURNS,
    maxChainLength: 30,
  });
  allLengths[label] = [];
  for (const game of result.games) {
    for (const turn of game.turns) {
      allLengths[label]!.push(turn.chainLength);
    }
  }
}

for (const [bucket, min, max] of [['2-5', 2, 5], ['6-10', 6, 10], ['11+', 11, 100]] as const) {
  const cols = labels.map(l => {
    const arr = allLengths[l] ?? [];
    const n = arr.filter(v => v >= min && v <= max).length;
    return (arr.length > 0 ? n / arr.length * 100 : 0).toFixed(0) + '%';
  });
  console.log(`  ${bucket.padEnd(12)} ${cols[0]!.padStart(10)} ${cols[1]!.padStart(10)} ${cols[2]!.padStart(10)}`);
}

console.log('\n' + '='.repeat(72));
if (delta > 0.10) {
  console.log(`  VERDICT: CONFIRMED — depth cap hides ${(delta * 100).toFixed(0)}pp of chain space.`);
  console.log(`  casual: ${(casualPct * 100).toFixed(0)}% of chains exceed 5 tiles`);
  console.log(`  skilled: ${(skilledPct * 100).toFixed(0)}% of chains exceed 5 tiles`);
  console.log('  At depth 5, bots never discover the chains where Rule D bonus doubles (len 6+).');
} else if (delta > 0) {
  console.log(`  VERDICT: PARTIAL — depth cap hides some chain space (delta=${(delta*100).toFixed(0)}pp).`);
  console.log('  Try --runs 20 --maxTurns 100 for a clearer signal.');
} else {
  console.log('  VERDICT: INCONCLUSIVE — no delta at these run counts.');
}
console.log('='.repeat(72) + '\n');
