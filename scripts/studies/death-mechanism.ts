/**
 * Death-mechanism study — descriptive look at what kills games across archetypes.
 *
 *   npx tsx scripts/studies/death-mechanism.ts --seed 1 --n 30 --max-turns 500
 *
 * Three sub-studies sharing one set of game runs:
 *   Study A — per-turn trajectories: isolated-tile count, legal-start count,
 *             chain length, retirement events. Looking for trajectory SHAPE
 *             (slow decay vs cliff vs periodic recovery).
 *   Study B — counterfactual archetypes: retirementAvoider, sweeper. Compares
 *             survival and stranded-tile peaks against canonical archetypes.
 *             Bootstrap-95% CIs on per-archetype medians.
 *   Study C — death postmortem: for each natural death, the board state in
 *             the last 5/10/20 turns. Per-tier histograms, isolated-by-tier,
 *             pre-death spawn distribution, largest available chain.
 *
 * Prints console summary; dumps JSON manifest to dist/death-mechanism.<ts>.json.
 *
 * NOT trying to falsify hypotheses — we don't know variance or scales yet.
 * Findings doc just describes what we observed. Pilot first (N=5) to check
 * cap rate before the full run.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

import {
  DEFAULT_CONFIG,
  applyAction,
  computeChainResult,
  createGame,
} from '../../src/game-kernel/index.js';
import type {
  GameConfig,
  GameEvent,
  GameState,
  TileValue,
} from '../../src/game-kernel/index.js';

import {
  adaptiveStrategy,
  casualStrategy,
  cleanupPrioritizerStrategy,
  countIsolatedRetiredTiles,
  countLegalChainStarts,
  countRetiredTiles,
  engagedStrategy,
  isolatedTilesByTier,
  largestAvailableChain,
  retirementAvoiderStrategy,
  skilledStrategy,
  speedrunnerStrategy,
  sweeperStrategy,
  tilesByTier,
  weightedHeuristicStrategy,
} from '../../src/sim-harness/index.js';
import type {
  GameRunResult,
  SimStrategy,
  StrategyContext,
  TurnRecord,
} from '../../src/sim-harness/index.js';

// ── CLI parsing ────────────────────────────────────────────────────────────

interface CliArgs {
  readonly seed: number;
  readonly n: number;
  readonly maxTurns: number;
  readonly maxChainLength: number;
  readonly out: string | undefined;
}

function parseArgs(argv: readonly string[]): CliArgs {
  const get = (flag: string, fallback: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
  };
  const num = (flag: string, fallback: number): number => {
    const v = Number(get(flag, String(fallback)));
    if (!Number.isFinite(v)) throw new Error(`invalid ${flag}: ${get(flag, '')}`);
    return v;
  };
  return {
    seed: num('--seed', 1),
    n: num('--n', 30),
    maxTurns: num('--max-turns', 500),
    maxChainLength: num('--max-chain-length', 20),
    out: argv.indexOf('--out') >= 0 ? get('--out', '') : undefined,
  };
}

// ── Game runner with full board snapshots ──────────────────────────────────
// Mirrors src/sim-harness/runner.ts but additionally retains every GameState
// (each is immutable, so storage is just references). Used for postmortem
// analysis where we need to inspect board contents at specific past turns.

interface SnapshotRun {
  readonly seed: number;
  readonly strategyId: string;
  readonly finalTurn: number;
  readonly deathCause: GameRunResult['deathCause'];
  readonly maxTileReached: TileValue;
  readonly states: readonly GameState[];
  readonly turns: readonly TurnRecord[];
}

function lcgNext(state: number): number {
  return (Math.imul(1664525, state) + 1013904223) >>> 0;
}
function lcgFloat(state: number): number {
  return state / 0x100000000;
}
function withSeed(config: GameConfig, seed: number): GameConfig {
  return { ...config, prngSeed: seed };
}
function makeContext(maxChainLength: number, seed: number): StrategyContext {
  let s = seed >>> 0;
  return { maxChainLength, random: (): number => { s = lcgNext(s); return lcgFloat(s); } };
}
function maxOnState(state: GameState): TileValue {
  let m = state.maxTileEver;
  for (const row of state.board) for (const t of row) if (t.value > m) m = t.value;
  return m;
}

function runWithSnapshots(
  strategy: SimStrategy,
  seed: number,
  maxTurns: number,
  maxChainLength: number,
  config: GameConfig
): SnapshotRun {
  let state = createGame(withSeed(config, seed));
  const states: GameState[] = [state];
  const turns: TurnRecord[] = [];
  const ctx = makeContext(maxChainLength, seed ^ 0x9e3779b9);
  let deathCause: GameRunResult['deathCause'] = 'max-turns';

  while (state.phase === 'playing' && state.turn < maxTurns) {
    const decision = strategy.chooseAction(state, ctx);
    const action = decision.action;
    if (action === null) { deathCause = 'strategy-null'; break; }

    const resultValue = computeChainResult(state.board, action.chain, state.config);
    const legalChainStartsBefore = countLegalChainStarts(state.board);
    const retiredTileCountBefore = countRetiredTiles(state.board);
    const isolatedRetiredTileCountBefore = countIsolatedRetiredTiles(state.board);
    const spawnPoolBefore = [state.spawnPoolMin, state.spawnPoolMax] as const;
    const previousEventCount = state.events.length;

    const next = applyAction(state, action);

    const turnRecord: TurnRecord = {
      turn: next.turn,
      chain: action.chain,
      chainLength: action.chain.length,
      resultValue,
      legalChainStartsBefore,
      legalChainStartsAfter: countLegalChainStarts(next.board),
      spawnPoolBefore,
      spawnPoolAfter: [next.spawnPoolMin, next.spawnPoolMax],
      retiredTileCountBefore,
      retiredTileCountAfter: countRetiredTiles(next.board),
      isolatedRetiredTileCountBefore,
      isolatedRetiredTileCountAfter: countIsolatedRetiredTiles(next.board),
      events: next.events.slice(previousEventCount),
      ...(decision.diagnostics === undefined ? {} : { strategyDiagnostics: decision.diagnostics }),
    };
    turns.push(turnRecord);
    state = next;
    states.push(state);
  }

  if (state.phase === 'game-over') deathCause = 'no-legal-chain-start';

  return {
    seed,
    strategyId: strategy.id,
    finalTurn: state.turn,
    deathCause,
    maxTileReached: maxOnState(state),
    states,
    turns,
  };
}

// ── Stats helpers ──────────────────────────────────────────────────────────

function median(xs: readonly number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2 : (s[m] ?? 0);
}
function p(xs: readonly number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(Math.floor(s.length * q), s.length - 1)] ?? 0;
}
function mean(xs: readonly number[]): number {
  return xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Bootstrap 95% CI on a statistic. B=500 resamples — not load-bearing,
// just a sanity band so we don't over-read N=30 noise.
function bootstrap95(
  xs: readonly number[],
  stat: (sample: readonly number[]) => number,
  B = 500,
  prngSeed = 12345
): { stat: number; lo: number; hi: number } {
  const point = stat(xs);
  if (xs.length < 3) return { stat: point, lo: NaN, hi: NaN };
  let s = prngSeed >>> 0;
  const draws: number[] = [];
  for (let b = 0; b < B; b++) {
    const sample: number[] = [];
    for (let i = 0; i < xs.length; i++) {
      s = lcgNext(s);
      const idx = Math.floor(lcgFloat(s) * xs.length);
      sample.push(xs[idx] ?? 0);
    }
    draws.push(stat(sample));
  }
  draws.sort((a, b) => a - b);
  const lo = draws[Math.floor(B * 0.025)] ?? NaN;
  const hi = draws[Math.floor(B * 0.975)] ?? NaN;
  return { stat: point, lo, hi };
}

// ── Trajectory aggregation (Study A) ───────────────────────────────────────

interface TrajectoryBand {
  readonly turns: number;
  readonly mean: readonly number[];
  readonly p10: readonly number[];
  readonly p90: readonly number[];
  readonly n: readonly number[];  // games still alive at this turn
}

function trajectoryBand(
  runs: readonly SnapshotRun[],
  pickValue: (turn: TurnRecord) => number,
  maxTurns: number
): TrajectoryBand {
  const meanArr = new Array<number>(maxTurns).fill(0);
  const p10Arr = new Array<number>(maxTurns).fill(0);
  const p90Arr = new Array<number>(maxTurns).fill(0);
  const nArr = new Array<number>(maxTurns).fill(0);

  for (let t = 0; t < maxTurns; t++) {
    const vals: number[] = [];
    for (const run of runs) {
      if (t < run.turns.length) {
        const turn = run.turns[t];
        if (turn !== undefined) vals.push(pickValue(turn));
      }
    }
    nArr[t] = vals.length;
    if (vals.length > 0) {
      meanArr[t] = mean(vals);
      p10Arr[t] = p(vals, 0.1);
      p90Arr[t] = p(vals, 0.9);
    }
  }
  return { turns: maxTurns, mean: meanArr, p10: p10Arr, p90: p90Arr, n: nArr };
}

// ── ASCII trajectory plot ──────────────────────────────────────────────────
// Renders a trajectory band over time. Width is fixed at 76 chars; height 12.
// Each row is a y-band; each column is a turn bucket. Mark trajectory mean
// with •, the p10/p90 band with shading.

function asciiPlot(
  band: TrajectoryBand,
  label: string,
  yMax: number,
  width = 76,
  height = 12
): string {
  const lines: string[] = [];
  lines.push(`  ${label}  (y ∈ [0, ${yMax}], n at last turn = ${band.n[band.n.length - 1] ?? 0})`);

  const grid: string[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ' ')
  );

  const turnsPerCol = Math.max(1, Math.ceil(band.turns / width));
  for (let col = 0; col < width; col++) {
    const start = col * turnsPerCol;
    const end = Math.min(band.turns, start + turnsPerCol);
    let sumMean = 0; let sumP10 = 0; let sumP90 = 0; let count = 0;
    for (let t = start; t < end; t++) {
      if ((band.n[t] ?? 0) > 0) {
        sumMean += band.mean[t] ?? 0;
        sumP10 += band.p10[t] ?? 0;
        sumP90 += band.p90[t] ?? 0;
        count++;
      }
    }
    if (count === 0) continue;
    const m = sumMean / count;
    const lo = sumP10 / count;
    const hi = sumP90 / count;

    const yToRow = (y: number): number => {
      const r = height - 1 - Math.round((y / yMax) * (height - 1));
      return Math.max(0, Math.min(height - 1, r));
    };
    const rowLo = yToRow(hi);     // p90 is at the TOP of the band (lower row index)
    const rowHi = yToRow(lo);     // p10 is at the BOTTOM
    const rowMean = yToRow(m);

    for (let r = rowLo; r <= rowHi; r++) {
      const row = grid[r];
      if (row !== undefined && row[col] === ' ') row[col] = '·';
    }
    const meanRow = grid[rowMean];
    if (meanRow !== undefined) meanRow[col] = '•';
  }

  lines.push('  ┌' + '─'.repeat(width) + '┐');
  for (const row of grid) {
    lines.push('  │' + row.join('') + '│');
  }
  lines.push('  └' + '─'.repeat(width) + '┘');
  lines.push(`  ${'turn 0'.padEnd(width)} turn ${band.turns}`);
  return lines.join('\n');
}

// ── Study reports ──────────────────────────────────────────────────────────

interface ArchetypeReport {
  readonly id: string;
  readonly games: number;
  readonly naturalDeath: number;
  readonly capped: number;
  readonly strategyNull: number;
  readonly finalTurnMed: { stat: number; lo: number; hi: number };
  readonly maxTileMed: number;
  readonly maxTileMax: number;
  readonly retirementGames: number;
  readonly firstRetirementMed: number | null;
  readonly peakIsolatedRetiredMed: { stat: number; lo: number; hi: number };
  readonly stranded4PlusGames: number;
  readonly recoveredFromHighIsolation: number;  // games where peak > final iso count by ≥ 3
}

function summarize(runs: readonly SnapshotRun[]): ArchetypeReport {
  const id = runs[0]?.strategyId ?? 'unknown';
  const finalTurns = runs.map(r => r.finalTurn);
  const naturalDeath = runs.filter(r => r.deathCause === 'no-legal-chain-start').length;
  const capped = runs.filter(r => r.deathCause === 'max-turns').length;
  const strategyNull = runs.filter(r => r.deathCause === 'strategy-null').length;
  const maxTiles = runs.map(r => r.maxTileReached);

  const peakIsolated: number[] = [];
  const finalIsolated: number[] = [];
  let retirementGames = 0;
  const firstRetirementTurns: number[] = [];

  for (const run of runs) {
    let peak = 0; let final = 0; let firstRet: number | null = null;
    for (const t of run.turns) {
      const c = t.isolatedRetiredTileCountAfter;
      if (c > peak) peak = c;
      final = c;
      if (firstRet === null && t.events.some((e: GameEvent) => e.kind === 'retirement-fired')) {
        firstRet = t.turn;
      }
    }
    peakIsolated.push(peak);
    finalIsolated.push(final);
    if (firstRet !== null) { retirementGames++; firstRetirementTurns.push(firstRet); }
  }

  const recovered = peakIsolated.filter((peak, i) => peak - (finalIsolated[i] ?? 0) >= 3).length;

  return {
    id,
    games: runs.length,
    naturalDeath,
    capped,
    strategyNull,
    finalTurnMed: bootstrap95(finalTurns, median),
    maxTileMed: median(maxTiles),
    maxTileMax: Math.max(0, ...maxTiles),
    retirementGames,
    firstRetirementMed: firstRetirementTurns.length === 0 ? null : median(firstRetirementTurns),
    peakIsolatedRetiredMed: bootstrap95(peakIsolated, median),
    stranded4PlusGames: peakIsolated.filter(v => v > 4).length,
    recoveredFromHighIsolation: recovered,
  };
}

// Study C — death postmortem
interface PostmortemAggregate {
  readonly id: string;
  readonly naturalDeaths: number;
  // Mean tile counts across last 5 turns of all natural-death games, per tier.
  readonly preDeathTilesByTier: ReadonlyMap<TileValue, number>;
  readonly preDeathIsolatedByTier: ReadonlyMap<TileValue, number>;
  // What spawned in the last 5 turns: distribution of spawn values.
  readonly preDeathSpawns: ReadonlyMap<TileValue, number>;
  readonly preDeathLargestChainMed: number;
}

function postmortem(runs: readonly SnapshotRun[]): PostmortemAggregate {
  const id = runs[0]?.strategyId ?? 'unknown';
  const naturals = runs.filter(r => r.deathCause === 'no-legal-chain-start');

  const tilesByTierAccum = new Map<TileValue, number>();
  const isolatedByTierAccum = new Map<TileValue, number>();
  const spawnsAccum = new Map<TileValue, number>();
  const largestChains: number[] = [];
  let snapshotCount = 0;

  for (const run of naturals) {
    const tail = Math.min(5, run.turns.length);
    const startIdx = run.turns.length - tail;

    for (let i = startIdx; i < run.turns.length; i++) {
      // states[0] is the initial state, states[k] is post-action-k. So states[i+1] is post-turn i.
      const state = run.states[i + 1];
      if (state === undefined) continue;
      snapshotCount++;

      for (const [v, c] of tilesByTier(state.board)) {
        tilesByTierAccum.set(v, (tilesByTierAccum.get(v) ?? 0) + c);
      }
      for (const [v, c] of isolatedTilesByTier(state.board)) {
        isolatedByTierAccum.set(v, (isolatedByTierAccum.get(v) ?? 0) + c);
      }

      const turn = run.turns[i];
      if (turn !== undefined) {
        for (const e of turn.events) {
          if (e.kind === 'tiles-spawned') {
            for (const s of e.spawned) {
              spawnsAccum.set(s.value, (spawnsAccum.get(s.value) ?? 0) + 1);
            }
          }
        }
      }
      largestChains.push(largestAvailableChain(state));
    }
  }

  // Convert accumulators to mean per snapshot.
  const meanTiles = new Map<TileValue, number>();
  const meanIsolated = new Map<TileValue, number>();
  if (snapshotCount > 0) {
    for (const [v, total] of tilesByTierAccum) meanTiles.set(v, total / snapshotCount);
    for (const [v, total] of isolatedByTierAccum) meanIsolated.set(v, total / snapshotCount);
  }

  return {
    id,
    naturalDeaths: naturals.length,
    preDeathTilesByTier: meanTiles,
    preDeathIsolatedByTier: meanIsolated,
    preDeathSpawns: spawnsAccum,
    preDeathLargestChainMed: largestChains.length === 0 ? NaN : median(largestChains),
  };
}

// ── Console formatters ─────────────────────────────────────────────────────

function fmt(v: number, digits = 0): string {
  if (!Number.isFinite(v)) return ' --';
  return v.toFixed(digits);
}

function ci(c: { stat: number; lo: number; hi: number }, digits = 0): string {
  if (!Number.isFinite(c.lo) || !Number.isFinite(c.hi)) return fmt(c.stat, digits);
  return `${fmt(c.stat, digits)} [${fmt(c.lo, digits)},${fmt(c.hi, digits)}]`;
}

function printStudyB(reports: readonly ArchetypeReport[]): void {
  console.log('\n' + '═'.repeat(96));
  console.log('  STUDY B — Per-archetype summary (95% bootstrap CIs in [..])');
  console.log('═'.repeat(96));
  console.log(
    '  ' + 'archetype'.padEnd(20)
    + ' ' + 'N'.padStart(3)
    + ' ' + 'nat'.padStart(4)
    + ' ' + 'cap'.padStart(4)
    + ' ' + 'final-turn med'.padStart(20)
    + ' ' + 'maxTile med'.padStart(12)
    + ' ' + 'ret%'.padStart(5)
    + ' ' + 'peakIso med'.padStart(15)
  );
  console.log('  ' + '─'.repeat(94));
  for (const r of reports) {
    const retPct = r.games > 0 ? (r.retirementGames / r.games) * 100 : 0;
    console.log(
      '  ' + r.id.padEnd(20)
      + ' ' + String(r.games).padStart(3)
      + ' ' + String(r.naturalDeath).padStart(4)
      + ' ' + String(r.capped).padStart(4)
      + ' ' + ci(r.finalTurnMed).padStart(20)
      + ' ' + fmt(r.maxTileMed).padStart(12)
      + ' ' + (fmt(retPct, 0) + '%').padStart(5)
      + ' ' + ci(r.peakIsolatedRetiredMed).padStart(15)
    );
  }
  console.log('\n  Recovery (peak isolated retired ↘ final ≥ 3):');
  for (const r of reports) {
    console.log('    ' + r.id.padEnd(20) + ' ' + r.recoveredFromHighIsolation + '/' + r.games);
  }
}

function fmtTier(v: number): string {
  // Compact: 2..1024 as integer, 2^N for N >= 11.
  if (v >= 1024) {
    const exp = Math.round(Math.log2(v));
    return `2^${exp}`;
  }
  return String(v);
}

function tiersAcross(maps: ReadonlyArray<ReadonlyMap<TileValue, number>>): TileValue[] {
  const set = new Set<TileValue>();
  for (const m of maps) for (const v of m.keys()) set.add(v);
  return [...set].sort((a, b) => a - b);
}

function printStudyC(post: readonly PostmortemAggregate[]): void {
  console.log('\n' + '═'.repeat(96));
  console.log('  STUDY C — Death postmortem (mean per-tier counts in last 5 turns of natural deaths)');
  console.log('═'.repeat(96));

  if (post.every(p2 => p2.naturalDeaths === 0)) {
    console.log('  No natural deaths in this run — increase --max-turns and/or --n.');
    return;
  }

  const tilesT = tiersAcross(post.map(p2 => p2.preDeathTilesByTier));
  const isoT = tiersAcross(post.map(p2 => p2.preDeathIsolatedByTier));
  const spawnT = tiersAcross(post.map(p2 => p2.preDeathSpawns));

  const printSection = (
    title: string,
    tiers: readonly TileValue[],
    pick: (a: PostmortemAggregate) => ReadonlyMap<TileValue, number>,
    digits: number,
    extra?: { name: string; pick: (a: PostmortemAggregate) => number }
  ): void => {
    if (tiers.length === 0) {
      console.log(`\n  ${title}: (no data)`);
      return;
    }
    const colW = 7;
    const header = '  ' + 'archetype'.padEnd(20) + ' ' + 'deaths'.padStart(7) + ' '
      + tiers.map(t => fmtTier(t).padStart(colW)).join('')
      + (extra ? ' ' + extra.name.padStart(9) : '');
    console.log(`\n  ${title}:`);
    console.log(header);
    console.log('  ' + '─'.repeat(header.length - 2));
    for (const r of post) {
      const cells = tiers.map(t => fmt(pick(r).get(t) ?? 0, digits).padStart(colW)).join('');
      const tail = extra ? ' ' + fmt(extra.pick(r), 1).padStart(9) : '';
      console.log('  ' + r.id.padEnd(20) + ' ' + String(r.naturalDeaths).padStart(7) + ' ' + cells + tail);
    }
  };

  printSection('TILES', tilesT, r => r.preDeathTilesByTier, 1, {
    name: 'maxChain',
    pick: r => r.preDeathLargestChainMed,
  });
  printSection('ISOLATED (no same-value neighbor)', isoT, r => r.preDeathIsolatedByTier, 1);
  printSection('SPAWNS in last 5 turns (raw counts)', spawnT, r => r.preDeathSpawns, 0);
}

function printStudyA(
  bands: ReadonlyMap<string, { isolated: TrajectoryBand; legalStarts: TrajectoryBand }>
): void {
  console.log('\n' + '═'.repeat(96));
  console.log('  STUDY A — Trajectories (· = p10–p90 band, • = mean)');
  console.log('═'.repeat(96));
  // Compute global yMax for each metric so plots are comparable across archetypes.
  let isoMax = 1; let lsMax = 1;
  for (const { isolated, legalStarts } of bands.values()) {
    for (const v of isolated.p90) if (v > isoMax) isoMax = v;
    for (const v of legalStarts.p90) if (v > lsMax) lsMax = v;
  }
  for (const [id, { isolated, legalStarts }] of bands) {
    console.log('\n  ── ' + id + ' ──');
    console.log(asciiPlot(isolated, 'isolated retired tiles', isoMax));
    console.log(asciiPlot(legalStarts, 'legal chain starts', lsMax));
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

// Random excluded — it OOMs at depth 20 (uses enumerateCandidateChains, not
// findBestDeepChain) and adds noise rather than signal to trajectory analysis.
// Baseline study covers it separately at maxChainLength=8.
function archetypeList(): readonly SimStrategy[] {
  return [
    casualStrategy,
    engagedStrategy,
    skilledStrategy,
    speedrunnerStrategy,
    retirementAvoiderStrategy,
    sweeperStrategy,
    cleanupPrioritizerStrategy,
    weightedHeuristicStrategy,
    adaptiveStrategy,
  ];
}

function main(argv: readonly string[]): void {
  const args = parseArgs(argv);
  console.log('\n' + '═'.repeat(96));
  console.log('  DEATH MECHANISM STUDY');
  console.log(`  seed=${args.seed}  N=${args.n}  maxTurns=${args.maxTurns}  maxChainLength=${args.maxChainLength}`);
  console.log('═'.repeat(96));

  const archetypes = archetypeList();
  const allRuns = new Map<string, SnapshotRun[]>();

  const tStart = Date.now();
  for (const strategy of archetypes) {
    process.stdout.write(`  running ${strategy.id.padEnd(20)} ... `);
    const runs: SnapshotRun[] = [];
    const t0 = Date.now();
    for (let i = 0; i < args.n; i++) {
      runs.push(runWithSnapshots(strategy, args.seed + i, args.maxTurns, args.maxChainLength, DEFAULT_CONFIG));
    }
    allRuns.set(strategy.id, runs);
    console.log(`${runs.length} games in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }
  console.log(`  total: ${((Date.now() - tStart) / 1000).toFixed(1)}s`);

  // ── Study A
  const bands = new Map<string, { isolated: TrajectoryBand; legalStarts: TrajectoryBand }>();
  for (const [id, runs] of allRuns) {
    bands.set(id, {
      isolated: trajectoryBand(runs, t => t.isolatedRetiredTileCountAfter, args.maxTurns),
      legalStarts: trajectoryBand(runs, t => t.legalChainStartsAfter, args.maxTurns),
    });
  }
  printStudyA(bands);

  // ── Study B
  const reports: ArchetypeReport[] = [];
  for (const [, runs] of allRuns) reports.push(summarize(runs));
  printStudyB(reports);

  // ── Study C
  const post: PostmortemAggregate[] = [];
  for (const [, runs] of allRuns) post.push(postmortem(runs));
  printStudyC(post);

  // ── JSON manifest
  const outPath = args.out ?? `dist/death-mechanism.${Date.now()}.json`;
  mkdirSync(dirname(outPath), { recursive: true });
  const manifest = {
    schema: 'death-mechanism-v1',
    args,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - tStart,
    archetypes: reports.map(r => ({
      id: r.id, games: r.games, naturalDeath: r.naturalDeath, capped: r.capped,
      strategyNull: r.strategyNull, finalTurnMed: r.finalTurnMed,
      maxTileMed: r.maxTileMed, maxTileMax: r.maxTileMax,
      retirementGames: r.retirementGames, firstRetirementMed: r.firstRetirementMed,
      peakIsolatedRetiredMed: r.peakIsolatedRetiredMed,
      stranded4PlusGames: r.stranded4PlusGames,
      recoveredFromHighIsolation: r.recoveredFromHighIsolation,
    })),
    postmortem: post.map(p2 => ({
      id: p2.id, naturalDeaths: p2.naturalDeaths,
      preDeathTilesByTier: Object.fromEntries(p2.preDeathTilesByTier),
      preDeathIsolatedByTier: Object.fromEntries(p2.preDeathIsolatedByTier),
      preDeathSpawns: Object.fromEntries(p2.preDeathSpawns),
      preDeathLargestChainMed: p2.preDeathLargestChainMed,
    })),
    trajectories: Object.fromEntries(
      [...bands].map(([id, b]) => [id, {
        isolated: { mean: b.isolated.mean, p10: b.isolated.p10, p90: b.isolated.p90, n: b.isolated.n },
        legalStarts: { mean: b.legalStarts.mean, p10: b.legalStarts.p10, p90: b.legalStarts.p90, n: b.legalStarts.n },
      }])
    ),
  };
  writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(`\n  wrote ${outPath}\n`);
}

main(process.argv.slice(2));
