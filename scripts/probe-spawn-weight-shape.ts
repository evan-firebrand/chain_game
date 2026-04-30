/**
 * Probe: Spawn weight shape for large pools.
 *
 * Shows how the probability of spawning high-tier tiles collapses as pool
 * size grows. For pool=4 the top tier gets 10% of spawns; for pool=12
 * it gets ~0.3%. This makes large-pool configurations effectively identical
 * to smaller ones from the player's perspective.
 *
 *   npx tsx scripts/probe-spawn-weight-shape.ts
 */

import { spawnWeights, spawnPool } from "../src/game/spawn";
import { isMainModule } from "./_lib";

const SIZES = [4, 6, 8, 10, 12];
const SAMPLE_PEAK = 512;

export function main(_argv: string[]): void {
  console.log(`\nProbe: spawn weight shape by pool size (peak=${SAMPLE_PEAK})`);
  console.log(`\nWeight distribution (index 0 = lowest-tier spawn):`);

  const rows: Array<{ size: number; pool: number[]; weights: number[] }> = [];
  for (const size of SIZES) {
    const pool = spawnPool(SAMPLE_PEAK, undefined, size);
    const weights = spawnWeights(size);
    rows.push({ size, pool, weights });
  }

  // Header
  const maxSize = Math.max(...SIZES);
  console.log(`\n  ${"size".padEnd(6)}  ${"pool values".padEnd(40)}  P(top tier)  P(2nd tier)`);
  console.log(`  ${"─".repeat(75)}`);

  for (const { size, pool, weights } of rows) {
    const poolStr = pool.map((v) => String(v)).join(", ");
    const pTop = weights[weights.length - 1];
    const pSecond = weights.length >= 2 ? weights[weights.length - 2] : 0;
    console.log(
      `  ${String(size).padEnd(6)}  ${poolStr.padEnd(40)}  ${(pTop * 100).toFixed(2).padStart(8)}%   ${(pSecond * 100).toFixed(2).padStart(8)}%`
    );
  }

  // Visual weight bars per size
  console.log(`\nWeight bars (each row = one pool tier, leftmost = lowest value):`);
  for (const { size, pool, weights } of rows) {
    console.log(`\n  pool size=${size}:`);
    for (let i = 0; i < pool.length; i++) {
      const bar = "█".repeat(Math.round(weights[i] * 80));
      console.log(`    ${String(pool[i]).padStart(6)}  (${(weights[i] * 100).toFixed(2).padStart(5)}%)  ${bar}`);
    }
  }

  // Verdict: collapse ratio
  const pTop4 = spawnWeights(4)[3];
  const collapseRatio = SIZES.map((size) => {
    const w = spawnWeights(size);
    return { size, ratio: w[w.length - 1] / pTop4 };
  });

  console.log(`\nTop-tier spawn rate relative to pool=4 baseline (${(pTop4 * 100).toFixed(1)}%):`);
  for (const { size, ratio } of collapseRatio) {
    console.log(`  pool=${size}: ${(ratio * 100).toFixed(1)}% of baseline`);
  }

  const worstRatio = collapseRatio[collapseRatio.length - 1].ratio;
  if (worstRatio < 0.1) {
    console.log(`\nVERDICT: CONFIRMED — pool=${SIZES[SIZES.length - 1]} top tier fires at ${(worstRatio * 100).toFixed(1)}% the rate of pool=4. High tiers are effectively inaccessible at large pool sizes.`);
  } else {
    console.log(`\nVERDICT: PARTIAL — top-tier collapse is ${((1 - worstRatio) * 100).toFixed(0)}% but may be acceptable. Review pool vs weight algorithm.`);
  }
}

if (isMainModule(import.meta.url)) main(process.argv.slice(2));
