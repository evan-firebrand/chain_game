/**
 * Archetype baseline study — do skill levels produce meaningfully different outcomes?
 *
 *   npx tsx scripts/studies/archetype-baseline.ts
 *
 * Pre-run predictions (before seeing data):
 *   casual:   slow to retire, dies to clutter, long game, low max tile
 *   engaged:  retires faster due to longer chains, bimodal cliff-or-survive
 *   skilled:  fastest to retire (depth-20 finds long same-value chains early)
 *
 * Key design questions:
 *   1. Does skill produce longer or shorter games? (retirement cliff hypothesis)
 *   2. What is legalChainStartsAfter distribution? (board health)
 *   3. Does anything actually reach retirement? (retirement reachability)
 *   4. STRANDED TILE TRAP: do isolated retired tiles accumulate and kill the game?
 *      Retired tiles stop spawning but remain on the board. If surrounded by
 *      higher-value tiles with no same-value neighbor, they can never be the
 *      start of a chain → permanently stranded → board starvation.
 *      Random/casual never tries to sweep low-value tiles first. Any strategy
 *      that even occasionally clears the lowest tier will outperform.
 *
 * Note: skilled/speedrunner (depth 20) included at N=5 — trend indicator only.
 */

import { runSimulation, randomStrategy } from '../../src/sim-harness/index.js';
import {
  casualStrategy,
  engagedStrategy,
  skilledStrategy,
  speedrunnerStrategy,
} from '../../src/sim-harness/index.js';
import { DEFAULT_CONFIG } from '../../src/game-kernel/index.js';
import type { GameRunResult, SimStrategy } from '../../src/sim-harness/index.js';

const SEED = 1;

// maxChainLength only matters for strategies that use enumerateCandidateChains.
// randomStrategy uses it directly → cap at 8 to avoid OOM.
// Archetype strategies (casual/engaged/skilled) use findBestDeepChain and
// ignore context.maxChainLength entirely.
const archetypes: Array<{ strategy: SimStrategy; runs: number; maxTurns: number; maxChainLength: number; label: string }> = [
  { strategy: randomStrategy,      runs: 20, maxTurns: 300, maxChainLength:  8, label: 'random      (baseline)  ' },
  { strategy: casualStrategy,      runs: 30, maxTurns: 300, maxChainLength: 20, label: 'casual      (depth  5)  ' },
  { strategy: engagedStrategy,     runs: 30, maxTurns: 300, maxChainLength: 20, label: 'engaged     (depth 12)  ' },
  { strategy: skilledStrategy,     runs:  5, maxTurns: 100, maxChainLength: 20, label: 'skilled     (depth 20)* ' },
  { strategy: speedrunnerStrategy, runs:  5, maxTurns: 100, maxChainLength: 20, label: 'speedrunner (depth 20)* ' },
];

function p(arr: readonly number[], pct: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(Math.floor(sorted.length * pct), sorted.length - 1)] ?? 0;
}

function analyzeGames(games: readonly GameRunResult[], _maxTurns: number) {
  const gameLengths = games.map(g => g.finalTurn);
  const maxTiles = games.map(g => g.maxTileReached);
  const naturalDeaths = games.filter(g => g.deathCause === 'no-legal-chain-start').length;
  const cappedGames = games.filter(g => g.deathCause === 'max-turns').length;

  const firstRetirementTurns: number[] = [];
  const retirementCounts: number[] = [];
  const turnsAfterFirstRetirement: number[] = [];
  const legalStartsAfter: number[] = [];
  const chainLengths: number[] = [];
  // Stranded tile tracking: isolated retired tiles per turn
  const isolatedRetiredOverTime: number[] = [];
  let totalZeroStarts = 0;
  let peakIsolatedPerGame: number[] = [];

  for (const game of games) {
    let firstRetirementTurn: number | null = null;
    let gameRetirements = 0;
    let maxIsolatedThisGame = 0;

    for (const turn of game.turns) {
      chainLengths.push(turn.chainLength);
      legalStartsAfter.push(turn.legalChainStartsAfter);
      if (turn.legalChainStartsAfter === 0) totalZeroStarts++;

      isolatedRetiredOverTime.push(turn.isolatedRetiredTileCountAfter);
      if (turn.isolatedRetiredTileCountAfter > maxIsolatedThisGame) {
        maxIsolatedThisGame = turn.isolatedRetiredTileCountAfter;
      }

      const hadRetirement = turn.events.some(e => e.kind === 'retirement-fired');
      if (hadRetirement) {
        gameRetirements++;
        if (firstRetirementTurn === null) firstRetirementTurn = turn.turn;
      }
    }

    retirementCounts.push(gameRetirements);
    peakIsolatedPerGame.push(maxIsolatedThisGame);
    if (firstRetirementTurn !== null) {
      firstRetirementTurns.push(firstRetirementTurn);
      turnsAfterFirstRetirement.push(game.finalTurn - firstRetirementTurn);
    }
  }

  const totalTurns = chainLengths.length;
  return {
    gameLengths, maxTiles, naturalDeaths, cappedGames,
    firstRetirementTurns, retirementCounts, turnsAfterFirstRetirement,
    legalStartsAfter, chainLengths, totalTurns,
    isolatedRetiredOverTime, peakIsolatedPerGame,
    gamesWithRetirement: firstRetirementTurns.length,
    zeroStartPct: totalTurns > 0 ? totalZeroStarts / totalTurns : 0,
  };
}

console.log('\n' + '='.repeat(80));
console.log('  ARCHETYPE BASELINE STUDY');
console.log(`  seed=${SEED}  (* = N=5, trend indicator only)`);
console.log('  retirement triggers when result >= 512 (2-tiles retire first)');
console.log('  stranded tile = retired tile with no same-value neighbor (unplayable forever)');
console.log('='.repeat(80));

const results: Array<{
  label: string; runs: number;
  analysis: ReturnType<typeof analyzeGames>;
}> = [];

for (const { strategy, runs, maxTurns, maxChainLength, label } of archetypes) {
  process.stdout.write(`  running ${label.trim()} (N=${runs})...`);
  const sim = runSimulation({
    config: DEFAULT_CONFIG,
    strategy,
    runs,
    seed: SEED,
    maxTurns,
    maxChainLength,
  });
  const analysis = analyzeGames(sim.games, maxTurns);
  results.push({ label, runs, analysis });
  console.log(' done');
}

// ── Game length ─────────────────────────────────────────────────────────────
console.log('\n  GAME LENGTH (turns until death or cap)');
console.log(`  ${'archetype'.padEnd(30)} ${'N'.padStart(4)} ${'p10'.padStart(6)} ${'med'.padStart(6)} ${'p90'.padStart(6)} ${'nat%'.padStart(6)} ${'cap%'.padStart(6)}`);
console.log('  ' + '-'.repeat(67));
for (const { label, runs, analysis } of results) {
  const { gameLengths, naturalDeaths, cappedGames } = analysis;
  console.log(
    `  ${label.padEnd(30)} ${String(runs).padStart(4)}` +
    ` ${String(p(gameLengths, 0.1)).padStart(6)} ${String(p(gameLengths, 0.5)).padStart(6)} ${String(p(gameLengths, 0.9)).padStart(6)}` +
    ` ${((naturalDeaths / runs) * 100).toFixed(0).padStart(5)}% ${((cappedGames / runs) * 100).toFixed(0).padStart(5)}%`
  );
}

// ── Max tile ────────────────────────────────────────────────────────────────
console.log('\n  MAX TILE REACHED');
const tileBreaks = [16, 32, 64, 128, 256, 512];
console.log('  ' + 'archetype'.padEnd(30) + tileBreaks.map(t => ('>='+t).padStart(8)).join(''));
console.log('  ' + '-'.repeat(78));
for (const { label, runs, analysis } of results) {
  const row = '  ' + label.padEnd(30) +
    tileBreaks.map(t => {
      const n = analysis.maxTiles.filter(v => v >= t).length;
      return ((n / runs) * 100).toFixed(0).padStart(7) + '%';
    }).join('');
  console.log(row);
}

// ── Retirement ──────────────────────────────────────────────────────────────
console.log('\n  RETIREMENT  (need result >= 512 to trigger; retires 2-tiles first)');
console.log(`  ${'archetype'.padEnd(30)} ${'ret%'.padStart(6)} ${'1st turn med'.padStart(14)} ${'surv after med'.padStart(16)}`);
console.log('  ' + '-'.repeat(68));
for (const { label, runs, analysis } of results) {
  const { gamesWithRetirement, firstRetirementTurns, turnsAfterFirstRetirement } = analysis;
  const retPct = ((gamesWithRetirement / runs) * 100).toFixed(0) + '%';
  const fmed = firstRetirementTurns.length > 0 ? String(p(firstRetirementTurns, 0.5)) : '--';
  const smed = turnsAfterFirstRetirement.length > 0 ? String(p(turnsAfterFirstRetirement, 0.5)) : '--';
  console.log(`  ${label.padEnd(30)} ${retPct.padStart(6)} ${fmed.padStart(14)} ${smed.padStart(16)}`);
}

// ── Stranded tile trap ──────────────────────────────────────────────────────
console.log('\n  STRANDED TILE TRAP (isolated retired tiles = tiles that can never be played)');
console.log(`  ${'archetype'.padEnd(30)} ${'peak med'.padStart(10)} ${'peak p90'.padStart(10)} ${'ever>4 %'.padStart(10)}`);
console.log('  ' + '-'.repeat(62));
for (const { label, runs, analysis } of results) {
  const { peakIsolatedPerGame } = analysis;
  const pmed = p(peakIsolatedPerGame, 0.5);
  const pp90 = p(peakIsolatedPerGame, 0.9);
  const overFour = peakIsolatedPerGame.filter(v => v > 4).length;
  console.log(
    `  ${label.padEnd(30)}` +
    ` ${String(pmed).padStart(10)} ${String(pp90).padStart(10)}` +
    ` ${((overFour / runs) * 100).toFixed(0).padStart(9)}%`
  );
}

// ── Board health ────────────────────────────────────────────────────────────
console.log('\n  BOARD HEALTH (legal chain starts remaining after each chain)');
console.log(`  ${'archetype'.padEnd(30)} ${'p10'.padStart(5)} ${'med'.padStart(5)} ${'p90'.padStart(5)} ${'0-starts%'.padStart(11)}`);
console.log('  ' + '-'.repeat(58));
for (const { label, analysis } of results) {
  const { legalStartsAfter, zeroStartPct } = analysis;
  console.log(
    `  ${label.padEnd(30)}` +
    ` ${String(p(legalStartsAfter, 0.1)).padStart(5)} ${String(p(legalStartsAfter, 0.5)).padStart(5)} ${String(p(legalStartsAfter, 0.9)).padStart(5)}` +
    ` ${(zeroStartPct * 100).toFixed(1).padStart(10)}%`
  );
}

// ── Chain lengths ───────────────────────────────────────────────────────────
console.log('\n  CHAIN LENGTH DISTRIBUTION');
console.log(`  ${'archetype'.padEnd(30)} ${'2-5'.padStart(7)} ${'6-10'.padStart(7)} ${'11-20'.padStart(7)} ${'21+'.padStart(7)} ${'med'.padStart(5)}`);
console.log('  ' + '-'.repeat(66));
for (const { label, analysis } of results) {
  const { chainLengths } = analysis;
  const n = chainLengths.length;
  const b = (lo: number, hi: number) =>
    n > 0 ? ((chainLengths.filter(l => l >= lo && l <= hi).length / n) * 100).toFixed(0) + '%' : '--';
  console.log(
    `  ${label.padEnd(30)} ${b(2,5).padStart(7)} ${b(6,10).padStart(7)} ${b(11,20).padStart(7)}` +
    ` ${b(21,999).padStart(7)} ${String(p(chainLengths, 0.5)).padStart(5)}`
  );
}

// ── Interpretation ──────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(80));
console.log('  INTERPRETATION');
console.log('='.repeat(80));

const [rand, casual, engaged] = results;
if (!rand || !casual || !engaged) { console.log('  (insufficient data)'); process.exit(0); }

const randMed   = p(rand.analysis.gameLengths,   0.5);
const casualMed = p(casual.analysis.gameLengths, 0.5);
const engagedMed = p(engaged.analysis.gameLengths, 0.5);

const casualRetPct  = (casual.analysis.gamesWithRetirement  / casual.runs)  * 100;
const engagedRetPct = (engaged.analysis.gamesWithRetirement / engaged.runs) * 100;

console.log(`\n  Survival: random=${randMed} | casual=${casualMed} | engaged=${engagedMed} turns (median)`);

if (randMed < casualMed && casualMed < engagedMed) {
  console.log('  >> SKILL REWARDED: random < casual < engaged. Good gradient.');
} else if (engagedMed < casualMed) {
  console.log('  >> RETIREMENT CLIFF: engaged dies faster than casual despite better chains.');
  console.log('     Longer chains trigger retirement earlier; post-retirement board is harder.');
  console.log('     DESIGN RISK: better play = earlier death. Stranded tiles are the mechanism.');
} else {
  console.log('  >> OUTCOME DOMINATED BY RNG: strategy barely moves the needle.');
}

console.log(`\n  Retirement reachability: casual=${casualRetPct.toFixed(0)}% | engaged=${engagedRetPct.toFixed(0)}%`);
if (casualRetPct < 30) {
  console.log('  >> RETIREMENT IS RARE for casual. Most real players will never see it.');
  console.log('     Retirement is late-game content, not a regular mid-game mechanic.');
}

// Stranded tile comparison
const randStrandedMed   = p(rand.analysis.peakIsolatedPerGame,   0.5);
const casualStrandedMed = p(casual.analysis.peakIsolatedPerGame, 0.5);
const engStrandedMed    = p(engaged.analysis.peakIsolatedPerGame, 0.5);
console.log(`\n  Stranded tiles (peak isolated retired): random=${randStrandedMed} | casual=${casualStrandedMed} | engaged=${engStrandedMed}`);

if (engStrandedMed > casualStrandedMed) {
  console.log('  >> STRANDED TILE TRAP ACTIVE: engaged accumulates more stranded tiles.');
  console.log('     Longer chains deplete same-value clusters faster, leaving isolated tiles.');
  console.log('     Any strategy that sweeps the retiring tier before retirement helps here.');
} else if (engStrandedMed < casualStrandedMed) {
  console.log('  >> Longer chains REDUCE stranded tiles (sweep clusters more completely).');
}

console.log('\n' + '='.repeat(80) + '\n');
