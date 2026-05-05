/**
 * Probe: spawn weight distribution across pool sizes.
 *
 *   npx tsx scripts/probe-spawn-weights.ts
 *
 * Shows what fraction of spawns each tier gets for different spawnPoolMin
 * values. As retirement happens and spawnPoolMin advances, the effective
 * spawn distribution shifts. This probe characterizes that shift.
 *
 * Verdict: shows whether top-tier spawn probability amplifies significantly
 * at large pool sizes as tiles are retired and the pool narrows.
 */

import {
  DEFAULT_CONFIG,
  forEachTileValueInRange,
  previousTileValue,
} from '../src/game-kernel/index.js';
import type { GameConfig, TileValue } from '../src/game-kernel/index.js';

function computeWeightTable(
  config: Pick<GameConfig, 'spawnPoolMin' | 'spawnPoolMax' | 'spawnWeights'>
): Array<{ value: TileValue; weight: number; pct: number }> {
  const entries: Array<{ value: TileValue; weight: number }> = [];
  let totalWeight = 0;

  forEachTileValueInRange(config.spawnPoolMin, config.spawnPoolMax, v => {
    const configuredWeight = config.spawnWeights[v];
    const previousTier = previousTileValue(v);
    const weight = configuredWeight ?? (
      v === config.spawnPoolMax ? (config.spawnWeights[previousTier ?? 0 as TileValue] ?? 1) / 2 : 0
    );
    if (weight > 0) {
      entries.push({ value: v, weight });
      totalWeight += weight;
    }
  });

  return entries.map(e => ({
    value: e.value,
    weight: e.weight,
    pct: totalWeight > 0 ? e.weight / totalWeight : 0,
  }));
}

// Pool configs: spawnPoolMin advances as retirement happens.
const poolConfigs: Array<{ label: string; spawnPoolMin: TileValue; spawnPoolMax: TileValue }> = [
  { label: 'start   (2-256)',   spawnPoolMin: 2,   spawnPoolMax: 256 },
  { label: '1st ret (4-256)',   spawnPoolMin: 4,   spawnPoolMax: 256 },
  { label: '2nd ret (8-256)',   spawnPoolMin: 8,   spawnPoolMax: 256 },
  { label: '3rd ret (16-256)',  spawnPoolMin: 16,  spawnPoolMax: 256 },
  { label: '4th ret (32-256)',  spawnPoolMin: 32,  spawnPoolMax: 256 },
  { label: '5th ret (64-256)',  spawnPoolMin: 64,  spawnPoolMax: 256 },
  { label: '6th ret (128-256)', spawnPoolMin: 128, spawnPoolMax: 256 },
];

console.log('\n' + '='.repeat(72));
console.log('  PROBE: Spawn weight distribution');
console.log('  Default weights: {2:128, 4:64, 8:32, 16:16, 32:8, 64:4, 128:2, 256:1}');
console.log('='.repeat(72));

const tierHeaders = ['2', '4', '8', '16', '32', '64', '128', '256'];
const headerLine = '  ' + 'pool'.padEnd(22) +
  tierHeaders.map(h => h.padStart(8)).join('') + '  P(top tier)';
console.log(headerLine);
console.log('  ' + '-'.repeat(96));

const topTierPcts: number[] = [];

for (const poolConfig of poolConfigs) {
  const table = computeWeightTable({
    spawnPoolMin: poolConfig.spawnPoolMin,
    spawnPoolMax: poolConfig.spawnPoolMax,
    spawnWeights: DEFAULT_CONFIG.spawnWeights,
  });

  const byValue = Object.fromEntries(table.map(e => [e.value, e.pct]));
  const row = '  ' + poolConfig.label.padEnd(22) +
    tierHeaders.map(h => {
      const pct = byValue[Number(h)] ?? 0;
      return (pct > 0 ? (pct * 100).toFixed(1) + '%' : '--').padStart(8);
    }).join('') + '  ' + ((byValue[256] ?? 0) * 100).toFixed(2) + '%';

  console.log(row);
  topTierPcts.push(byValue[256] ?? 0);
}

const startPct = topTierPcts[0] ?? 0;
const endPct = topTierPcts[topTierPcts.length - 1] ?? 0;
const amplification = startPct > 0 ? endPct / startPct : Infinity;

console.log('\n  Top-tier (256) spawn probability:');
console.log(`    At game start:            ${(startPct * 100).toFixed(2)}%`);
console.log(`    After 6 retirements:      ${(endPct * 100).toFixed(2)}%`);
console.log(`    Amplification start->end: ${amplification.toFixed(0)}x`);

console.log('\n' + '='.repeat(72));
if (amplification > 3) {
  console.log('  VERDICT: Top-tier spawn probability amplifies significantly with retirement.');
  console.log(`  256-tiles go from ${(startPct * 100).toFixed(1)}% -> ${(endPct * 100).toFixed(1)}% of spawns after 6 retirements.`);
  console.log('  This is expected power-law behavior: smaller pools concentrate at high values.');
  console.log('  Late-game spawn balance differs substantially from early game.');
} else {
  console.log('  VERDICT: Spawn distribution is stable across pool sizes.');
}
console.log('='.repeat(72) + '\n');
